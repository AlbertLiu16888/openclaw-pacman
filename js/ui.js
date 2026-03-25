// === UI Controller ===
(() => {
    const $ = id => document.getElementById(id);
    const screens = {
        start: $('screen-start'),
        game: $('screen-game'),
        result: $('screen-result'),
        leaderboard: $('screen-leaderboard'),
        admin: $('screen-admin'),
    };

    const canvas = $('game-canvas');
    const game = new PacManGame(canvas);
    let playerName = '';

    // 開機即載入遠端設定（破關訊息、過關分數等）
    CONFIG.loadRemoteConfig();

    // --- Screen Navigation ---
    function showScreen(name) {
        Object.values(screens).forEach(s => s.classList.remove('active'));
        screens[name].classList.add('active');
    }

    // --- Admin Mode ---
    function updateLogoPreview() {
        const src = CONFIG.getLogoSrc();
        const preview = $('logo-preview');
        const deleteBtn = $('btn-logo-delete');
        if (src) {
            preview.innerHTML = `<img src="${src}" alt="Logo Preview">`;
            deleteBtn.style.display = 'block';
        } else {
            preview.innerHTML = '<span class="no-logo">🖼️</span>';
            deleteBtn.style.display = 'none';
        }
    }

    async function checkAdminMode() {
        if (window.location.hash === '#admin') {
            showScreen('admin');
            // 先載入遠端設定再填入表單
            await CONFIG.loadRemoteConfig();
            $('admin-secret').value = CONFIG.secretMessage;
            $('admin-threshold').value = CONFIG.passThreshold;
            $('admin-api-url').value = CONFIG.apiUrl;
            $('admin-logo-url').value = CONFIG.logoUrl;
            updateLogoPreview();

            if (CONFIG.logoUrl && !CONFIG.logoData) {
                $('toggle-logo-url').checked = true;
                $('admin-logo-url').style.display = 'block';
            }
        }
    }
    window.addEventListener('hashchange', checkAdminMode);
    checkAdminMode();

    // --- Logo Upload Handler ---
    $('admin-logo-file').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const dataUrl = ev.target.result;
            $('admin-logo-file').dataset.base64 = dataUrl;
            // Instant preview
            $('logo-preview').innerHTML = `<img src="${dataUrl}" alt="Logo Preview">`;
            $('btn-logo-delete').style.display = 'block';
        };
        reader.readAsDataURL(file);
    });

    // --- Delete Logo ---
    $('btn-logo-delete').addEventListener('click', () => {
        localStorage.removeItem('pac_logo_data');
        localStorage.removeItem('pac_logo_url');
        $('admin-logo-file').value = '';
        $('admin-logo-file').dataset.base64 = '';
        $('admin-logo-url').value = '';
        updateLogoPreview();
        $('admin-status').textContent = 'Logo 已刪除！';
        setTimeout(() => $('admin-status').textContent = '', 2000);
    });

    // --- Toggle URL input ---
    $('toggle-logo-url').addEventListener('change', (e) => {
        $('admin-logo-url').style.display = e.target.checked ? 'block' : 'none';
    });

    // --- Start Screen ---
    const nameInput = $('player-name');
    const btnStart = $('btn-start');

    nameInput.addEventListener('input', () => {
        btnStart.disabled = nameInput.value.trim().length === 0;
    });

    btnStart.addEventListener('click', () => {
        playerName = nameInput.value.trim();
        if (!playerName) return;
        if (typeof SFX !== 'undefined') SFX.unlock();
        startGame();
    });

    nameInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' && nameInput.value.trim()) {
            playerName = nameInput.value.trim();
            startGame();
        }
    });

    $('btn-leaderboard').addEventListener('click', () => {
        showScreen('leaderboard');
        loadLeaderboard();
    });

    // --- Game ---
    async function startGame() {
        // 確保遠端設定已載入（破關訊息等）
        if (!CONFIG._loaded) {
            await CONFIG.loadRemoteConfig();
        }
        showScreen('game');
        $('hud-player').textContent = playerName;
        $('hud-score').textContent = '0';
        $('hud-level').textContent = 'Level 1';
        updateLives(CONFIG.lives);

        game.onScoreChange = score => {
            $('hud-score').textContent = score.toLocaleString();
        };
        game.onLivesChange = lives => {
            updateLives(lives);
        };
        game.onLevelChange = level => {
            $('hud-level').textContent = `Level ${level}`;
        };
        game.onDeath = () => {
            showOverlay('💀', 1200);
        };
        game.onLevelClear = (level) => {
            if (level < CONFIG.clearLevel) {
                showOverlay(`Level ${level} Clear!`, 1800, 'level-up');
            } else {
                showOverlay('🎉 ALL CLEAR!', 1800, 'level-up');
            }
        };
        game.onGameEnd = results => {
            setTimeout(() => showResults(results), 800);
        };

        // Countdown then start
        countdown(3, () => {
            game.start();
        });
    }

    function updateLives(count) {
        const el = $('lives-display');
        el.innerHTML = '';
        for (let i = 0; i < count; i++) {
            const life = document.createElement('div');
            life.className = 'life-icon';
            el.appendChild(life);
        }
    }

    function countdown(n, callback) {
        const overlay = document.createElement('div');
        overlay.id = 'countdown-overlay';
        document.body.appendChild(overlay);

        let count = n;
        function tick() {
            if (count > 0) {
                overlay.innerHTML = `${count}<div class="sub">方向鍵 / 滑動控制</div>`;
                if (typeof SFX !== 'undefined') SFX.countdownBeep(false);
                count--;
                setTimeout(tick, 800);
            } else {
                overlay.textContent = 'GO!';
                if (typeof SFX !== 'undefined') {
                    SFX.countdownBeep(true);
                    SFX.gameStart();
                }
                setTimeout(() => {
                    overlay.remove();
                    callback();
                }, 600);
            }
        }
        tick();
    }

    function showOverlay(text, duration, cls = '') {
        const el = document.createElement('div');
        el.className = 'game-overlay ' + cls;
        el.textContent = text;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), duration);
    }

    // --- Game Controls ---
    // D-Pad buttons with sound & vibration
    function dirInput(dr, dc) {
        game.setDirection(dr, dc);
        if (typeof SFX !== 'undefined') SFX.directionClick();
    }
    $('btn-up').addEventListener('touchstart', e => { e.preventDefault(); dirInput(-1, 0); });
    $('btn-down').addEventListener('touchstart', e => { e.preventDefault(); dirInput(1, 0); });
    $('btn-left').addEventListener('touchstart', e => { e.preventDefault(); dirInput(0, -1); });
    $('btn-right').addEventListener('touchstart', e => { e.preventDefault(); dirInput(0, 1); });
    $('btn-up').addEventListener('click', () => dirInput(-1, 0));
    $('btn-down').addEventListener('click', () => dirInput(1, 0));
    $('btn-left').addEventListener('click', () => dirInput(0, -1));
    $('btn-right').addEventListener('click', () => dirInput(0, 1));

    // Keyboard
    document.addEventListener('keydown', e => {
        // 在輸入框中不攔截鍵盤（允許正常打字）
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        switch (e.key) {
            case 'ArrowUp':
            case 'w':
            case 'W':
                e.preventDefault();
                dirInput(-1, 0);
                break;
            case 'ArrowDown':
            case 's':
            case 'S':
                e.preventDefault();
                dirInput(1, 0);
                break;
            case 'ArrowLeft':
            case 'a':
            case 'A':
                e.preventDefault();
                dirInput(0, -1);
                break;
            case 'ArrowRight':
            case 'd':
            case 'D':
                e.preventDefault();
                dirInput(0, 1);
                break;
        }
    });

    // Swipe detection
    let touchStartX = 0, touchStartY = 0;
    canvas.addEventListener('touchstart', e => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    }, { passive: true });
    canvas.addEventListener('touchend', e => {
        const dx = e.changedTouches[0].clientX - touchStartX;
        const dy = e.changedTouches[0].clientY - touchStartY;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        const minSwipe = 20;

        if (Math.max(absDx, absDy) < minSwipe) return;

        if (absDx > absDy) {
            game.setDirection(0, dx > 0 ? 1 : -1);
        } else {
            game.setDirection(dy > 0 ? 1 : -1, 0);
        }
    }, { passive: true });

    // Sound & Vibration toggles
    $('btn-sound').addEventListener('click', () => {
        if (typeof SFX === 'undefined') return;
        const on = SFX.toggle();
        $('btn-sound').textContent = on ? '🔊' : '🔇';
        $('btn-sound').classList.toggle('off', !on);
    });
    $('btn-vibrate').addEventListener('click', () => {
        if (typeof SFX === 'undefined') return;
        const on = SFX.toggleVibration();
        $('btn-vibrate').textContent = on ? '📳' : '📴';
        $('btn-vibrate').classList.toggle('off', !on);
    });

    // Resize
    window.addEventListener('resize', () => {
        if (game.running) game.resize();
    });

    // --- Results ---
    function showResults(results) {
        showScreen('result');
        $('result-score').textContent = results.score.toLocaleString();
        $('result-level').textContent = results.level;
        $('result-dots').textContent = results.dotsEaten;
        $('result-ghosts').textContent = results.ghostsEaten;

        if (results.passed) {
            $('result-title').textContent = '🎉 挑戰成功！';
            $('result-title').style.color = '#ffcc00';
            showSecretMessages(playerName);
        } else {
            $('result-title').textContent = 'GAME OVER';
            $('result-title').style.color = '#ff4444';
            $('secret-message-area').classList.add('hidden');
        }

        submitScore(playerName, results.score);
    }

    function showSecretMessages(name) {
        const area = $('secret-message-area');
        area.classList.remove('hidden');
        area.innerHTML = '';

        const messages = [
            `恭喜「${name}」挑戰成功！`,
            '請記下接下來的文字訊息',
            `輸入破關訊息「${CONFIG.secretMessage}」獲得積分`,
        ];

        messages.forEach((msg, i) => {
            const line = document.createElement('div');
            line.className = 'fade-line';
            line.textContent = msg;
            line.style.animationDelay = `${i * 1.8 + 0.5}s`;
            area.appendChild(line);
        });
    }

    $('btn-retry').addEventListener('click', () => {
        game.stop();
        startGame();
    });

    $('btn-home').addEventListener('click', () => {
        game.stop();
        showScreen('start');
    });

    // --- Leaderboard ---
    function getLocalScores() {
        try { return JSON.parse(localStorage.getItem('pac_scores') || '[]'); }
        catch { return []; }
    }
    function saveLocalScore(name, score) {
        const scores = getLocalScores();
        const existing = scores.find(s => s.name === name);
        if (existing) {
            if (score > existing.score) {
                existing.score = score;
                existing.date = new Date().toISOString().slice(0, 10);
            }
        } else {
            scores.push({ name, score, date: new Date().toISOString().slice(0, 10) });
        }
        scores.sort((a, b) => b.score - a.score);
        localStorage.setItem('pac_scores', JSON.stringify(scores.slice(0, 10)));
    }

    async function submitScore(name, score) {
        saveLocalScore(name, score);
        const url = CONFIG.apiUrl;
        if (!url) return;
        try {
            await fetch(url, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'addScore', game: 'pacman', name, score }),
            });
        } catch (e) {
            console.warn('Failed to submit score:', e);
        }
    }

    async function loadLeaderboard() {
        const list = $('leaderboard-list');
        list.innerHTML = '<p class="loading">載入中...</p>';

        let scores = [];
        const url = CONFIG.apiUrl;

        if (url) {
            try {
                const res = await fetch(`${url}?action=getScores&game=pacman`);
                const data = await res.json();
                if (Array.isArray(data)) scores = data;
            } catch (e) {
                console.warn('Remote leaderboard failed, using local:', e);
            }
        }

        const localScores = getLocalScores();
        const byName = new Map();
        for (const s of [...scores, ...localScores]) {
            const prev = byName.get(s.name);
            if (!prev || s.score > prev.score) {
                byName.set(s.name, s);
            }
        }
        const merged = [...byName.values()];
        merged.sort((a, b) => b.score - a.score);
        const top = merged.slice(0, 10);

        if (top.length === 0) {
            list.innerHTML = '<p class="loading">尚無紀錄</p>';
            return;
        }

        list.innerHTML = top.map((s, i) => `
            <div class="lb-row">
                <span class="lb-rank">${i + 1}</span>
                <span class="lb-name">${escapeHtml(s.name)}</span>
                <span class="lb-score">${s.score.toLocaleString()}</span>
            </div>
        `).join('');
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    $('btn-back').addEventListener('click', () => showScreen('start'));

    // --- Admin ---
    $('btn-admin-save').addEventListener('click', async () => {
        const secret = $('admin-secret').value;
        const threshold = $('admin-threshold').value;
        const apiUrl = $('admin-api-url').value;
        const logoUrl = $('admin-logo-url').value;

        // 存到 localStorage（本機備份）
        localStorage.setItem('pac_secret', secret);
        localStorage.setItem('pac_threshold', threshold);
        localStorage.setItem('pac_api_url', apiUrl);
        localStorage.setItem('pac_logo_url', logoUrl);

        // 存上傳的 logo base64
        const base64 = $('admin-logo-file').dataset.base64;
        if (base64) {
            localStorage.setItem('pac_logo_data', base64);
        }

        // 同步到 Google Sheets Config（讓所有玩家都能讀到）
        $('admin-status').textContent = '儲存中...';
        try {
            await CONFIG.saveRemoteConfig('secretMessage', secret);
            await CONFIG.saveRemoteConfig('passThreshold', threshold);
            $('admin-status').textContent = '✅ 設定已儲存（本機 + 雲端）！';
        } catch (e) {
            $('admin-status').textContent = '⚠️ 本機已存，雲端同步失敗';
        }
        setTimeout(() => $('admin-status').textContent = '', 3000);
    });

    $('btn-admin-back').addEventListener('click', () => {
        window.location.hash = '';
        showScreen('start');
    });
})();
