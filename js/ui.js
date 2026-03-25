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

    // --- Screen Navigation ---
    function showScreen(name) {
        Object.values(screens).forEach(s => s.classList.remove('active'));
        screens[name].classList.add('active');
    }

    // --- Admin Mode ---
    function checkAdminMode() {
        if (window.location.hash === '#admin') {
            showScreen('admin');
            $('admin-secret').value = CONFIG.secretMessage;
            $('admin-threshold').value = CONFIG.passThreshold;
            $('admin-api-url').value = CONFIG.apiUrl;
            $('admin-logo-url').value = CONFIG.logoUrl;
            // Show current logo preview
            const src = CONFIG.getLogoSrc();
            if (src) {
                $('logo-preview').innerHTML = `<img src="${src}" alt="Logo Preview">`;
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
            $('logo-preview').innerHTML = `<img src="${dataUrl}" alt="Logo Preview">`;
            // Store temporarily, save on button click
            $('admin-logo-file').dataset.base64 = dataUrl;
        };
        reader.readAsDataURL(file);
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
    function startGame() {
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
                count--;
                setTimeout(tick, 800);
            } else {
                overlay.textContent = 'GO!';
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
    // D-Pad buttons
    $('btn-up').addEventListener('touchstart', e => { e.preventDefault(); game.setDirection(-1, 0); });
    $('btn-down').addEventListener('touchstart', e => { e.preventDefault(); game.setDirection(1, 0); });
    $('btn-left').addEventListener('touchstart', e => { e.preventDefault(); game.setDirection(0, -1); });
    $('btn-right').addEventListener('touchstart', e => { e.preventDefault(); game.setDirection(0, 1); });
    $('btn-up').addEventListener('click', () => game.setDirection(-1, 0));
    $('btn-down').addEventListener('click', () => game.setDirection(1, 0));
    $('btn-left').addEventListener('click', () => game.setDirection(0, -1));
    $('btn-right').addEventListener('click', () => game.setDirection(0, 1));

    // Keyboard
    document.addEventListener('keydown', e => {
        switch (e.key) {
            case 'ArrowUp':
            case 'w':
            case 'W':
                e.preventDefault();
                game.setDirection(-1, 0);
                break;
            case 'ArrowDown':
            case 's':
            case 'S':
                e.preventDefault();
                game.setDirection(1, 0);
                break;
            case 'ArrowLeft':
            case 'a':
            case 'A':
                e.preventDefault();
                game.setDirection(0, -1);
                break;
            case 'ArrowRight':
            case 'd':
            case 'D':
                e.preventDefault();
                game.setDirection(0, 1);
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
                body: JSON.stringify({ action: 'addScore', name, score }),
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
                const res = await fetch(`${url}?action=getScores`);
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
    $('btn-admin-save').addEventListener('click', () => {
        localStorage.setItem('pac_secret', $('admin-secret').value);
        localStorage.setItem('pac_threshold', $('admin-threshold').value);
        localStorage.setItem('pac_api_url', $('admin-api-url').value);
        localStorage.setItem('pac_logo_url', $('admin-logo-url').value);

        // Save uploaded logo base64
        const base64 = $('admin-logo-file').dataset.base64;
        if (base64) {
            localStorage.setItem('pac_logo_data', base64);
        }

        $('admin-status').textContent = '設定已儲存！';
        setTimeout(() => $('admin-status').textContent = '', 2000);
    });

    $('btn-admin-back').addEventListener('click', () => {
        window.location.hash = '';
        showScreen('start');
    });
})();
