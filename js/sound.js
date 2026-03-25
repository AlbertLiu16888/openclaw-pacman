// === Sound & Vibration System (Web Audio API — no external files) ===

class SoundManager {
    constructor() {
        this.ctx = null;       // AudioContext (lazy init on first user gesture)
        this.enabled = true;
        this.vibrationEnabled = true;
        this.volume = 0.35;
        this._unlocked = false;

        // Vibration API support check
        this.canVibrate = !!(navigator.vibrate);
    }

    // Must call from a user gesture (click/touch) to unlock AudioContext
    unlock() {
        if (this._unlocked) return;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            // iOS requires a silent buffer play to unlock
            const buf = this.ctx.createBuffer(1, 1, 22050);
            const src = this.ctx.createBufferSource();
            src.buffer = buf;
            src.connect(this.ctx.destination);
            src.start(0);
            this._unlocked = true;
        } catch (e) {
            console.warn('AudioContext unlock failed:', e);
        }
    }

    _ensureCtx() {
        if (!this.ctx) this.unlock();
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        return !!this.ctx;
    }

    // --- Vibration helpers ---
    vibrate(pattern) {
        if (!this.vibrationEnabled || !this.canVibrate) return;
        try { navigator.vibrate(pattern); } catch (e) {}
    }

    vibrateShort()  { this.vibrate(15); }
    vibrateMedium() { this.vibrate(40); }
    vibrateLong()   { this.vibrate(80); }
    vibratePattern(p) { this.vibrate(p); }

    // --- Low-level synth helpers ---
    _osc(type, freq, startTime, duration, vol = this.volume) {
        if (!this.enabled || !this._ensureCtx()) return;
        const ctx = this.ctx;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(vol, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration + 0.05);
    }

    _noise(startTime, duration, vol = 0.1) {
        if (!this.enabled || !this._ensureCtx()) return;
        const ctx = this.ctx;
        const bufferSize = ctx.sampleRate * duration;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * vol;
        }
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(vol, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        src.connect(gain);
        gain.connect(ctx.destination);
        src.start(startTime);
    }

    _sweep(type, freqStart, freqEnd, startTime, duration, vol = this.volume) {
        if (!this.enabled || !this._ensureCtx()) return;
        const ctx = this.ctx;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freqStart, startTime);
        osc.frequency.exponentialRampToValueAtTime(freqEnd, startTime + duration);
        gain.gain.setValueAtTime(vol, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration + 0.05);
    }

    // === Game Sound Effects ===

    // 吃豆子 — classic "waka" alternating tone
    _wakaToggle = false;
    eatDot() {
        if (!this.enabled || !this._ensureCtx()) return;
        const t = this.ctx.currentTime;
        const freq = this._wakaToggle ? 420 : 500;
        this._wakaToggle = !this._wakaToggle;
        this._osc('sine', freq, t, 0.07, this.volume * 0.5);
        this.vibrateShort();
    }

    // 吃大力丸
    eatPowerDot() {
        if (!this.enabled || !this._ensureCtx()) return;
        const t = this.ctx.currentTime;
        this._sweep('square', 200, 800, t, 0.15, this.volume * 0.4);
        this._sweep('sine', 300, 1200, t + 0.05, 0.2, this.volume * 0.3);
        this.vibrateMedium();
    }

    // 鬼變藍持續音效（低沉脈衝）
    _scaredLoop = null;
    startScaredSound() {
        if (!this.enabled || !this._ensureCtx()) return;
        this.stopScaredSound();
        const ctx = this.ctx;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.value = 120;
        lfo.type = 'sine';
        lfo.frequency.value = 6;
        lfoGain.gain.value = 30;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        gain.gain.value = this.volume * 0.15;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        lfo.start();
        this._scaredLoop = { osc, gain, lfo, lfoGain };
    }

    stopScaredSound() {
        if (this._scaredLoop) {
            try {
                this._scaredLoop.osc.stop();
                this._scaredLoop.lfo.stop();
                this._scaredLoop.osc.disconnect();
                this._scaredLoop.lfo.disconnect();
                this._scaredLoop.gain.disconnect();
                this._scaredLoop.lfoGain.disconnect();
            } catch (e) {}
            this._scaredLoop = null;
        }
    }

    // 吃鬼 — ascending exciting tone
    eatGhost(combo = 1) {
        if (!this.enabled || !this._ensureCtx()) return;
        const t = this.ctx.currentTime;
        const baseFreq = 300 + combo * 80;
        this._sweep('square', baseFreq, baseFreq * 3, t, 0.12, this.volume * 0.4);
        this._sweep('sine', baseFreq * 1.5, baseFreq * 4, t + 0.05, 0.15, this.volume * 0.3);
        this._osc('sine', baseFreq * 2, t + 0.12, 0.08, this.volume * 0.25);
        this.vibratePattern([30, 20, 50]);
    }

    // 吃水果
    eatFruit() {
        if (!this.enabled || !this._ensureCtx()) return;
        const t = this.ctx.currentTime;
        this._osc('sine', 600, t, 0.08, this.volume * 0.4);
        this._osc('sine', 800, t + 0.08, 0.08, this.volume * 0.4);
        this._osc('sine', 1000, t + 0.16, 0.12, this.volume * 0.5);
        this.vibrateMedium();
    }

    // Pac-Man 死亡 — descending spiral
    death() {
        if (!this.enabled || !this._ensureCtx()) return;
        const t = this.ctx.currentTime;
        for (let i = 0; i < 8; i++) {
            const freq = 800 - i * 80;
            this._osc('sine', freq, t + i * 0.1, 0.12, this.volume * 0.4);
        }
        this._sweep('sine', 400, 80, t + 0.8, 0.5, this.volume * 0.3);
        this.vibratePattern([50, 30, 50, 30, 100]);
    }

    // 過關 — happy ascending fanfare
    levelClear() {
        if (!this.enabled || !this._ensureCtx()) return;
        const t = this.ctx.currentTime;
        const notes = [523, 587, 659, 784, 880, 1047]; // C5 to C6
        notes.forEach((freq, i) => {
            this._osc('square', freq, t + i * 0.12, 0.14, this.volume * 0.3);
            this._osc('sine', freq * 1.5, t + i * 0.12 + 0.02, 0.1, this.volume * 0.15);
        });
        this.vibratePattern([30, 20, 30, 20, 30, 20, 80]);
    }

    // 遊戲開始 — classic intro jingle
    gameStart() {
        if (!this.enabled || !this._ensureCtx()) return;
        const t = this.ctx.currentTime;
        // Simple 8-note pac-man style intro
        const melody = [
            [262, 0.12], [330, 0.12], [392, 0.12], [330, 0.12],
            [262, 0.2],  [392, 0.12], [349, 0.2],  [262, 0.3],
        ];
        let time = t;
        for (const [freq, dur] of melody) {
            this._osc('sine', freq, time, dur * 0.9, this.volume * 0.35);
            this._osc('square', freq * 2, time, dur * 0.5, this.volume * 0.08);
            time += dur;
        }
        this.vibratePattern([20, 40, 20, 40, 20]);
    }

    // 遊戲結束 — somber descending tone
    gameOver() {
        if (!this.enabled || !this._ensureCtx()) return;
        const t = this.ctx.currentTime;
        this._osc('sine', 440, t, 0.3, this.volume * 0.35);
        this._osc('sine', 349, t + 0.3, 0.3, this.volume * 0.35);
        this._osc('sine', 293, t + 0.6, 0.3, this.volume * 0.3);
        this._osc('sine', 261, t + 0.9, 0.6, this.volume * 0.25);
        this.vibrateLong();
    }

    // 勝利 — triumphant fanfare
    victory() {
        if (!this.enabled || !this._ensureCtx()) return;
        const t = this.ctx.currentTime;
        const fanfare = [
            [523, 0.15], [523, 0.15], [523, 0.15], [523, 0.4],
            [415, 0.4], [466, 0.4], [523, 0.15], [466, 0.1], [523, 0.6],
        ];
        let time = t;
        for (const [freq, dur] of fanfare) {
            this._osc('square', freq, time, dur * 0.85, this.volume * 0.3);
            this._osc('sine', freq, time, dur * 0.9, this.volume * 0.25);
            time += dur;
        }
        this.vibratePattern([50, 30, 50, 30, 50, 30, 150]);
    }

    // 倒數計時嗶聲
    countdownBeep(final = false) {
        if (!this.enabled || !this._ensureCtx()) return;
        const t = this.ctx.currentTime;
        if (final) {
            this._osc('square', 880, t, 0.15, this.volume * 0.4);
            this._osc('sine', 1760, t, 0.1, this.volume * 0.2);
        } else {
            this._osc('sine', 600, t, 0.1, this.volume * 0.3);
        }
        this.vibrateShort();
    }

    // 方向鍵按下 — subtle click
    directionClick() {
        if (!this.enabled || !this._ensureCtx()) return;
        const t = this.ctx.currentTime;
        this._osc('sine', 1200, t, 0.02, this.volume * 0.15);
        this.vibrateShort();
    }

    // 切換音效開關
    toggle() {
        this.enabled = !this.enabled;
        if (!this.enabled) this.stopScaredSound();
        return this.enabled;
    }

    // 切換震動開關
    toggleVibration() {
        this.vibrationEnabled = !this.vibrationEnabled;
        return this.vibrationEnabled;
    }
}

// Global singleton
const SFX = new SoundManager();
