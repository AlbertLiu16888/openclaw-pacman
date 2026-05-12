// === UI Controller ===
(() => {
    const $ = id => document.getElementById(id);
    const screens = {
        start: $('screen-start'),
        lobby: $('screen-lobby'),
        waiting: $('screen-waiting'),
        game: $('screen-game'),
        result: $('screen-result'),
        leaderboard: $('screen-leaderboard'),
        admin: $('screen-admin'),
    };

    const canvas = $('game-canvas');
    const game = new PacManGame(canvas);
    let playerName = '';

    // === Battle Mode Variables ===
    let isBattleMode = false;
    let mp = null; // MultiplayerManager
    let opponentFinalResults = null;
    let syncInterval = null;

    const FIREBASE_CONFIG = {
        apiKey: "AIzaSyCgHgg7cwWQdK_3CXbw_j3NznU8owamYsE",
        authDomain: "openclaw-games.firebaseapp.com",
        databaseURL: "https://openclaw-games-default-rtdb.asia-southeast1.firebasedatabase.app",
        projectId: "openclaw-games",
        storageBucket: "openclaw-games.firebasestorage.app",
        messagingSenderId: "722220179558",
        appId: "1:722220179558:web:4819d728e7d45d42f70da7"
    };

    function initFirebase() {
        if (window.firebase && !firebase.apps.length) {
            firebase.initializeApp(FIREBASE_CONFIG);
        }
    }

    // 開機即載入遠端設定
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
            $('logo-preview').innerHTML = `<img src="${dataUrl}" alt="Logo Preview">`;
            $('btn-logo-delete').style.display = 'block';
        };
        reader.readAsDataURL(file);
    });

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

    $('toggle-logo-url').addEventListener('change', (e) => {
        $('admin-logo-url').style.display = e.target.checked ? 'block' : 'none';
    });

    // --- Start Screen ---
    const nameInput = $('player-name');
    const btnStart = $('btn-start');
    const btnBattle = $('btn-battle');

    nameInput.addEventListener('input', () => {
        const hasName = nameInput.value.trim().length > 0;
        btnStart.disabled = !hasName;
        btnBattle.disabled = !hasName;
    });

    btnStart.addEventListener('click', () => {
        playerName = nameInput.value.trim();
        if (!playerName) return;
        if (typeof SFX !== 'undefined') SFX.unlock();
        isBattleMode = false;
        startGame();
    });

    nameInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' && nameInput.value.trim()) {
            playerName = nameInput.value.trim();
            isBattleMode = false;
            startGame();
        }
    });

    // === Battle Mode: Lobby ===
    btnBattle.addEventListener('click', () => {
        playerName = nameInput.value.trim();
        if (!playerName) return;
        if (typeof SFX !== 'undefined') SFX.unlock();
        initFirebase();
        showScreen('lobby');
    });

    $('btn-lobby-back').addEventListener('click', () => showScreen('start'));

    $('btn-create-room').addEventListener('click', async () => {
        mp = new MultiplayerManager('pacman');
        if (!mp.init()) { alert('Firebase 未載入'); return; }
        const code = await mp.createRoom(playerName);
        showWaitingRoom(code);
    });

    $('btn-quick-match').addEventListener('click', async () => {
        mp = new MultiplayerManager('pacman');
        if (!mp.init()) { alert('Firebase 未載入'); return; }
        $('btn-quick-match').disabled = true;
        $('btn-quick-match').textContent = '配對中...';
        const result = await mp.quickMatch(playerName);
        $('btn-quick-match').disabled = false;
        $('btn-quick-match').textContent = '🔀 快速配對';
        if (result.success) {
            showWaitingRoom(result.roomCode);
        }
    });

    $('btn-join-room').addEventListener('click', async () => {
        const code = $('room-code-input').value.trim();
        if (!code || code.length !== 4) { alert('請輸入 4 位房間碼'); return; }
        mp = new MultiplayerManager('pacman');
        if (!mp.init()) { alert('Firebase 未載入'); return; }
        const result = await mp.joinRoom(code, playerName);
        if (result.success) {
            showWaitingRoom(code);
        } else {
            alert(result.error);
        }
    });

    $('room-code-input').addEventListener('keydown', e => {
        if (e.key === 'Enter') $('btn-join-room').click();
    });

    // === Waiting Room ===
    function showWaitingRoom(code) {
        showScreen('waiting');
        $('display-room-code').textContent = code;
        opponentFinalResults = null;

        if (mp.isHost) {
            $('slot-host-name').textContent = playerName;
            $('slot-host').querySelector('.slot-avatar').textContent = '🟡';
            $('slot-guest-name').textContent = '等待對手...';
            $('slot-guest').querySelector('.slot-avatar').textContent = '❓';
            $('btn-ready').style.display = 'none';
            $('btn-start-battle').style.display = 'none';
            $('waiting-message').textContent = '等待對手加入...';
        } else {
            $('slot-guest-name').textContent = playerName;
            $('slot-guest').querySelector('.slot-avatar').textContent = '🟡';
            $('btn-ready').style.display = 'inline-block';
            $('btn-start-battle').style.display = 'none';
            $('waiting-message').textContent = '等待房主開始...';
        }

        setupBattleListeners();
    }

    function setupBattleListeners() {
        mp.on('opponentJoined', opp => {
            if (mp.isHost) {
                $('slot-guest-name').textContent = opp.name;
                $('slot-guest').querySelector('.slot-avatar').textContent = '🟡';
                $('waiting-message').textContent = '對手已加入！等待準備...';
                $('btn-ready').style.display = 'inline-block';
            } else {
                $('slot-host-name').textContent = opp.name;
                $('slot-host').querySelector('.slot-avatar').textContent = '🟡';
            }
        });

        mp.on('opponentUpdate', opp => {
            const slotId = mp.isHost ? 'slot-guest' : 'slot-host';
            const statusId = mp.isHost ? 'slot-guest-status' : 'slot-host-status';
            if (opp.ready) {
                $(slotId).classList.add('ready');
                $(statusId).textContent = '✅ 已準備';
            }
        });

        mp.on('allReady', () => {
            if (mp.isHost) {
                $('btn-start-battle').style.display = 'inline-block';
                $('waiting-message').textContent = '全員就緒！可以開始！';
            }
        });

        mp.on('countdown', () => {
            $('waiting-message').textContent = '3...2...1... 開始！';
        });

        mp.on('gameStart', () => {
            startBattleGame();
        });

        mp.on('opponentState', state => {
            if (state) {
                $('opp-score').textContent = (state.score || 0).toLocaleString();
                $('opp-level').textContent = `Lv${state.level || 1}`;
                $('opp-dots').textContent = `🔵${state.dotsEaten || 0}`;
            }
        });

        mp.on('opponentFinished', results => {
            opponentFinalResults = results;
        });

        mp.on('gameEnd', () => {
            // Both finished, results will be shown by showResults
        });
    }

    $('btn-ready').addEventListener('click', () => {
        mp.setReady(true);
        $('btn-ready').disabled = true;
        $('btn-ready').textContent = '✅ 已準備';
        const mySlot = mp.isHost ? 'slot-host' : 'slot-guest';
        const myStatus = mp.isHost ? 'slot-host-status' : 'slot-guest-status';
        $(mySlot).classList.add('ready');
        $(myStatus).textContent = '✅ 已準備';
    });

    $('btn-start-battle').addEventListener('click', () => {
        if (!mp.isHost) return;
        mp.startGame({});
    });

    $('btn-leave-room').addEventListener('click', async () => {
        if (mp) await mp.leaveRoom();
        mp = null;
        showScreen('lobby');
    });

    // === Start Battle Game ===
    function startBattleGame() {
        isBattleMode = true;
        showScreen('game');
        $('opponent-bar').style.display = 'flex';
        $('opp-name').textContent = mp.opponent ? mp.opponent.name : '對手';
        $('opp-score').textContent = '0';
        $('opp-level').textContent = 'Lv1';
        $('opp-dots').textContent = '🔵0';

        // Shift HUD down for opponent bar
        $('game-hud').style.top = '28px';

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
            stopSyncLoop();
            // Submit final results to multiplayer
            if (mp) {
                mp.endGame({
                    score: results.score,
                    level: results.level,
                    dotsEaten: results.dotsEaten,
                    ghostsEaten: results.ghostsEaten,
                });
            }
            setTimeout(() => showResults(results), 800);
        };

        countdown(3, () => {
            game.start();
            startSyncLoop();
        });
    }

    // === Sync Loop ===
    function startSyncLoop() {
        if (!mp) return;
        syncInterval = setInterval(() => {
            mp.syncState({
                score: game.score || 0,
                level: game.level || 1,
                dotsEaten: game.dotsEaten || 0,
                ghostsEaten: game.ghostsEaten || 0,
                lives: game.lives || 0,
            });
            mp.syncScore(game.score || 0);
        }, 200);
    }

    function stopSyncLoop() {
        if (syncInterval) {
            clearInterval(syncInterval);
            syncInterval = null;
        }
    }

    $('btn-leaderboard').addEventListener('click', () => {
        showScreen('leaderboard');
        loadLeaderboard();
    });

    // --- Game ---
    async function startGame() {
        if (!CONFIG._loaded) {
            await CONFIG.loadRemoteConfig();
        }
        showScreen('game');
        $('opponent-bar').style.display = 'none';
        $('game-hud').style.top = '0';
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
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        switch (e.key) {
            case 'ArrowUp': case 'w': case 'W':
                e.preventDefault(); dirInput(-1, 0); break;
            case 'ArrowDown': case 's': case 'S':
                e.preventDefault(); dirInput(1, 0); break;
            case 'ArrowLeft': case 'a': case 'A':
                e.preventDefault(); dirInput(0, -1); break;
            case 'ArrowRight': case 'd': case 'D':
                e.preventDefault(); dirInput(0, 1); break;
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

        if (isBattleMode && mp) {
            // Battle mode results
            $('result-stats').style.display = 'none';
            $('battle-result-compare').style.display = 'block';

            const myScore = results.score;
            const oppResults = opponentFinalResults || (mp.opponent && mp.opponent.finalResults) || {};
            const oppScore = oppResults.score || 0;

            $('compare-opp-name').textContent = mp.opponent ? mp.opponent.name : '對手';
            $('compare-my-score').textContent = myScore.toLocaleString();
            $('compare-opp-score').textContent = oppScore.toLocaleString();
            $('compare-my-level').textContent = results.level;
            $('compare-opp-level').textContent = oppResults.level || 1;
            $('compare-my-dots').textContent = results.dotsEaten;
            $('compare-opp-dots').textContent = oppResults.dotsEaten || 0;
            $('compare-my-ghosts').textContent = results.ghostsEaten;
            $('compare-opp-ghosts').textContent = oppResults.ghostsEaten || 0;

            // Highlight winners
            function markWinner(myId, oppId, myVal, oppVal) {
                $(myId).classList.remove('winner', 'loser');
                $(oppId).classList.remove('winner', 'loser');
                if (myVal > oppVal) { $(myId).classList.add('winner'); $(oppId).classList.add('loser'); }
                else if (oppVal > myVal) { $(oppId).classList.add('winner'); $(myId).classList.add('loser'); }
            }
            markWinner('compare-my-score', 'compare-opp-score', myScore, oppScore);
            markWinner('compare-my-level', 'compare-opp-level', results.level, oppResults.level || 1);
            markWinner('compare-my-dots', 'compare-opp-dots', results.dotsEaten, oppResults.dotsEaten || 0);
            markWinner('compare-my-ghosts', 'compare-opp-ghosts', results.ghostsEaten, oppResults.ghostsEaten || 0);

            if (myScore > oppScore) {
                $('result-title').textContent = '🎉 你贏了！';
                $('result-title').style.color = '#4caf50';
            } else if (myScore < oppScore) {
                $('result-title').textContent = '😢 你輸了...';
                $('result-title').style.color = '#ff4444';
            } else {
                $('result-title').textContent = '🤝 平手！';
                $('result-title').style.color = '#ffcc00';
            }

            $('secret-message-area').classList.add('hidden');
        } else {
            // Single player results
            $('result-stats').style.display = 'block';
            $('battle-result-compare').style.display = 'none';

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
        if (isBattleMode && mp) {
            // Return to waiting room for rematch
            showScreen('waiting');
            $('btn-ready').style.display = 'inline-block';
            $('btn-ready').disabled = false;
            $('btn-ready').textContent = '✅ 準備';
            $('btn-start-battle').style.display = 'none';
            $('waiting-message').textContent = '等待再次對戰...';
            const mySlot = mp.isHost ? 'slot-host' : 'slot-guest';
            $(mySlot).classList.remove('ready');
            mp.setReady(false);
            opponentFinalResults = null;
        } else {
            startGame();
        }
    });

    $('btn-home').addEventListener('click', async () => {
        game.stop();
        stopSyncLoop();
        if (mp) {
            await mp.leaveRoom();
            mp = null;
        }
        isBattleMode = false;
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

        localStorage.setItem('pac_secret', secret);
        localStorage.setItem('pac_threshold', threshold);
        localStorage.setItem('pac_api_url', apiUrl);
        localStorage.setItem('pac_logo_url', logoUrl);

        const base64 = $('admin-logo-file').dataset.base64;
        if (base64) {
            localStorage.setItem('pac_logo_data', base64);
        }

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
