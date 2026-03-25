// === Core Game Engine ===

class Entity {
    constructor(row, col) {
        this.row = row;
        this.col = col;
        this.x = col; // fractional position for smooth movement
        this.y = row;
        this.dir = { r: 0, c: 0 }; // current direction
        this.nextDir = { r: 0, c: 0 }; // queued direction
        this.speed = 0; // tiles per second
    }

    // Get current tile
    getTile() {
        return { row: Math.round(this.y), col: Math.round(this.x) };
    }

    // Check if at center of a tile
    atTileCenter(threshold = 0.08) {
        const dx = Math.abs(this.x - Math.round(this.x));
        const dy = Math.abs(this.y - Math.round(this.y));
        return dx < threshold && dy < threshold;
    }

    snapToTile() {
        this.x = Math.round(this.x);
        this.y = Math.round(this.y);
        this.row = Math.round(this.y);
        this.col = Math.round(this.x);
    }
}

class PacManGame {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.map = new GameMap();
        this.running = false;
        this.paused = false;

        this.pacman = null;
        this.ghosts = [];
        this.score = 0;
        this.lives = CONFIG.lives;
        this.level = 1;
        this.dotsEaten = 0;
        this.ghostsEaten = 0;
        this.totalDotsEaten = 0;
        this.totalGhostsEaten = 0;
        this.powerMode = false;
        this.powerTimer = 0;
        this.ghostEatCombo = 0;
        this.fruitActive = false;
        this.fruitTimer = 0;
        this.fruitPos = { row: 17, col: 13 };

        this.mouthAngle = 0;
        this.mouthDir = 1;
        this._raf = null;
        this._lastTime = 0;

        // Callbacks
        this.onScoreChange = null;
        this.onLivesChange = null;
        this.onLevelChange = null;
        this.onGameEnd = null;
        this.onDeath = null;
        this.onLevelClear = null;

        this._boundLoop = this._loop.bind(this);
    }

    init() {
        this.map.reset();
        this.map.loadLogo();
        this.dotsEaten = 0;
        this.ghostsEaten = 0;
        this.powerMode = false;
        this.powerTimer = 0;
        this.ghostEatCombo = 0;
        this.fruitActive = false;
        this.fruitTimer = 0;

        // Create Pac-Man
        this.pacman = new Entity(PACMAN_START.row, PACMAN_START.col);
        this.pacman.speed = CONFIG.pacSpeed + (this.level - 1) * CONFIG.levelSpeedBonus;
        this.pacman.dir = { r: 0, c: -1 };
        this.pacman.mouthAngle = 0;

        // Create ghosts
        const ghostColors = ['#ff0000', '#ffb8ff', '#00ffff', '#ffb852'];
        const ghostNames = ['Blinky', 'Pinky', 'Inky', 'Clyde'];
        this.ghosts = GHOST_STARTS.map((pos, i) => {
            const g = new Entity(pos.row, pos.col);
            g.speed = CONFIG.ghostSpeed + (this.level - 1) * (CONFIG.levelSpeedBonus * 0.5);
            g.color = ghostColors[i];
            g.name = ghostNames[i];
            g.index = i;
            g.scared = false;
            g.eaten = false;
            g.respawning = false;
            g.respawnTimer = 0;
            g.dir = GHOST_INIT_DIRS[i];
            g.lastDecisionTile = null;  // prevent re-evaluating same tile
            return g;
        });
    }

    resize() {
        const maxH = window.innerHeight - 240; // room for HUD + controls
        const maxW = window.innerWidth - 20;
        const mapW = this.map.cols;
        const mapH = this.map.rows;

        let tileSize = Math.floor(Math.min(maxW / mapW, maxH / mapH));
        tileSize = Math.max(tileSize, 8); // minimum
        tileSize = Math.min(tileSize, 24); // maximum

        this.tileSize = tileSize;
        this.canvas.width = mapW * tileSize;
        this.canvas.height = mapH * tileSize;

        const area = document.getElementById('game-area');
        if (area) {
            area.style.width = this.canvas.width + 'px';
            area.style.height = this.canvas.height + 'px';
        }
    }

    start() {
        this.score = 0;
        this.lives = CONFIG.lives;
        this.level = 1;
        this.totalDotsEaten = 0;
        this.totalGhostsEaten = 0;
        this.init();
        this.resize();
        this.running = true;
        this._lastTime = performance.now();
        this._loop();
    }

    stop() {
        this.running = false;
        if (this._raf) cancelAnimationFrame(this._raf);
        if (typeof SFX !== 'undefined') SFX.stopScaredSound();
    }

    setDirection(dr, dc) {
        if (!this.running || this.paused) return;
        this.pacman.nextDir = { r: dr, c: dc };
    }

    _loop() {
        if (!this.running) return;
        this._raf = requestAnimationFrame(this._boundLoop);

        const now = performance.now();
        const dt = Math.min((now - this._lastTime) / 1000, 0.05); // cap delta
        this._lastTime = now;

        if (this.paused) {
            this._render();
            return;
        }

        this._updatePacman(dt);
        this._updateGhosts(dt);
        this._checkCollisions();
        this._updatePower(dt);
        this._updateFruit(dt);
        this._render();
    }

    _updatePacman(dt) {
        const pac = this.pacman;
        const map = this.map;

        // Animate mouth
        this.mouthAngle += this.mouthDir * dt * 8;
        if (this.mouthAngle > 0.35) this.mouthDir = -1;
        if (this.mouthAngle < 0.02) this.mouthDir = 1;

        // Try queued direction at tile center
        if (pac.atTileCenter()) {
            const tile = pac.getTile();
            const nr = tile.row + pac.nextDir.r;
            const nc = tile.col + pac.nextDir.c;
            if (!map.isWall(nr, nc)) {
                pac.dir = { ...pac.nextDir };
                pac.snapToTile();
            }
        }

        // Move
        const moveAmount = pac.speed * dt;
        const newX = pac.x + pac.dir.c * moveAmount;
        const newY = pac.y + pac.dir.r * moveAmount;

        // Check wall collision in movement direction
        const nextTileR = Math.round(newY + pac.dir.r * 0.5);
        const nextTileC = Math.round(newX + pac.dir.c * 0.5);

        if (map.isWall(nextTileR, nextTileC)) {
            // If approaching wall and near center, stop
            if (pac.atTileCenter(0.15)) {
                pac.snapToTile();
                return;
            }
        }

        pac.x = newX;
        pac.y = newY;

        // Tunnel wrap
        if (pac.x < -0.5) pac.x = map.cols - 0.5;
        if (pac.x > map.cols - 0.5) pac.x = -0.5;

        // Eat dots
        const tile = pac.getTile();
        if (pac.atTileCenter(0.3)) {
            const eaten = map.eatDot(tile.row, tile.col);
            if (eaten === 'dot') {
                this.score += CONFIG.score.dot;
                this.dotsEaten++;
                this.totalDotsEaten++;
                if (typeof SFX !== 'undefined') SFX.eatDot();
                if (this.onScoreChange) this.onScoreChange(this.score);
            } else if (eaten === 'power') {
                this.score += CONFIG.score.powerDot;
                this.dotsEaten++;
                this.totalDotsEaten++;
                if (typeof SFX !== 'undefined') SFX.eatPowerDot();
                this._activatePower();
                if (this.onScoreChange) this.onScoreChange(this.score);
            }

            // Spawn fruit at 70 dots
            if (this.dotsEaten === 70 && !this.fruitActive) {
                this.fruitActive = true;
                this.fruitTimer = 10; // 10 seconds
            }

            // Check level clear
            if (this.dotsEaten >= this.map.totalDots) {
                this._levelClear();
                return;
            }
        }

        // Eat fruit
        if (this.fruitActive && pac.atTileCenter(0.4)) {
            if (tile.row === this.fruitPos.row && tile.col === this.fruitPos.col) {
                this.score += CONFIG.score.fruit;
                this.fruitActive = false;
                if (typeof SFX !== 'undefined') SFX.eatFruit();
                if (this.onScoreChange) this.onScoreChange(this.score);
            }
        }
    }

    _activatePower() {
        this.powerMode = true;
        this.powerTimer = CONFIG.powerDuration / 1000;
        this.ghostEatCombo = 0;
        this.ghosts.forEach(g => {
            if (!g.eaten && !g.respawning) g.scared = true;
        });
        if (typeof SFX !== 'undefined') SFX.startScaredSound();
    }

    _updatePower(dt) {
        if (!this.powerMode) return;
        this.powerTimer -= dt;
        if (this.powerTimer <= 0) {
            this.powerMode = false;
            this.ghosts.forEach(g => g.scared = false);
            if (typeof SFX !== 'undefined') SFX.stopScaredSound();
        }
    }

    _updateFruit(dt) {
        if (!this.fruitActive) return;
        this.fruitTimer -= dt;
        if (this.fruitTimer <= 0) {
            this.fruitActive = false;
        }
    }

    _updateGhosts(dt) {
        for (const ghost of this.ghosts) {
            // === Respawning at corner (after being eaten) ===
            if (ghost.respawning) {
                ghost.respawnTimer -= dt;
                if (ghost.respawnTimer <= 0) {
                    ghost.respawning = false;
                    ghost.eaten = false;
                    ghost.scared = false;
                    ghost.x = GHOST_STARTS[ghost.index].col;
                    ghost.y = GHOST_STARTS[ghost.index].row;
                    ghost.snapToTile();
                    ghost.dir = GHOST_INIT_DIRS[ghost.index];
                }
                continue;
            }

            // === Eaten: show eyes flying back to corner, then respawn ===
            if (ghost.eaten) {
                const home = GHOST_STARTS[ghost.index];
                const dx = home.col - ghost.x;
                const dy = home.row - ghost.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 0.5) {
                    ghost.respawning = true;
                    ghost.respawnTimer = 1.5; // 1.5s cooldown at corner
                    ghost.x = home.col;
                    ghost.y = home.row;
                } else {
                    const spd = CONFIG.ghostSpeed * 3;
                    ghost.x += (dx / dist) * spd * dt;
                    ghost.y += (dy / dist) * spd * dt;
                }
                continue;
            }

            // === Normal AI movement ===
            const speed = ghost.scared ? CONFIG.ghostScaredSpeed :
                          (CONFIG.ghostSpeed + (this.level - 1) * CONFIG.levelSpeedBonus * 0.5);

            // Direction decision at tile centers (with dedup to prevent snap-back loop)
            if (ghost.atTileCenter(0.15)) {
                const tile = ghost.getTile();
                const tileKey = tile.row * 100 + tile.col;

                // Only decide once per tile visit
                if (ghost.lastDecisionTile !== tileKey) {
                    ghost.lastDecisionTile = tileKey;
                    ghost.snapToTile();

                    const dirs = [
                        { r: -1, c: 0 }, { r: 1, c: 0 },
                        { r: 0, c: -1 }, { r: 0, c: 1 }
                    ];

                    const reverse = { r: -ghost.dir.r, c: -ghost.dir.c };
                    const possible = dirs.filter(d => {
                        const nr = tile.row + d.r;
                        const nc = tile.col + d.c;
                        if (d.r === reverse.r && d.c === reverse.c) return false;
                        return this.map.canGhostPass(nr, nc);
                    });

                    if (possible.length === 0) {
                        ghost.dir = reverse;
                    } else if (ghost.scared) {
                        ghost.dir = possible[Math.floor(Math.random() * possible.length)];
                    } else {
                        let target;
                        const pac = this.pacman.getTile();

                        switch (ghost.name) {
                            case 'Blinky':
                                // Direct chase
                                target = pac;
                                break;
                            case 'Pinky':
                                // Aim 4 tiles ahead of Pac-Man
                                target = {
                                    row: pac.row + this.pacman.dir.r * 4,
                                    col: pac.col + this.pacman.dir.c * 4
                                };
                                break;
                            case 'Inky': {
                                const blinky = this.ghosts[0];
                                const ahead = {
                                    row: pac.row + this.pacman.dir.r * 2,
                                    col: pac.col + this.pacman.dir.c * 2
                                };
                                target = {
                                    row: ahead.row + (ahead.row - blinky.getTile().row),
                                    col: ahead.col + (ahead.col - blinky.getTile().col)
                                };
                                break;
                            }
                            case 'Clyde': {
                                const d = Math.abs(pac.row - tile.row) + Math.abs(pac.col - tile.col);
                                target = d > 8 ? pac : GHOST_SCATTER[ghost.index];
                                break;
                            }
                            default:
                                target = pac;
                        }

                        let bestDir = possible[0];
                        let bestDist = Infinity;
                        for (const d of possible) {
                            const nr = tile.row + d.r;
                            const nc = tile.col + d.c;
                            const dist = Math.pow(target.row - nr, 2) + Math.pow(target.col - nc, 2);
                            if (dist < bestDist) {
                                bestDist = dist;
                                bestDir = d;
                            }
                        }
                        ghost.dir = bestDir;
                    }
                }
            } else {
                // Moved away from tile center — clear decision lock
                ghost.lastDecisionTile = null;
            }

            // Move ghost
            ghost.x += ghost.dir.c * speed * dt;
            ghost.y += ghost.dir.r * speed * dt;

            // Wall collision safety: if ghost somehow enters a wall, snap back
            const nextR = Math.round(ghost.y + ghost.dir.r * 0.5);
            const nextC = Math.round(ghost.x + ghost.dir.c * 0.5);
            if (!this.map.canGhostPass(nextR, nextC)) {
                if (ghost.atTileCenter(0.2)) {
                    ghost.snapToTile();
                    // Force find any valid direction
                    const tile = ghost.getTile();
                    const allDirs = [
                        { r: -1, c: 0 }, { r: 1, c: 0 },
                        { r: 0, c: -1 }, { r: 0, c: 1 }
                    ];
                    const valid = allDirs.filter(d =>
                        this.map.canGhostPass(tile.row + d.r, tile.col + d.c)
                    );
                    if (valid.length > 0) {
                        ghost.dir = valid[Math.floor(Math.random() * valid.length)];
                        ghost.lastDecisionTile = null; // allow re-decide
                    }
                }
            }

            // Tunnel wrap
            if (ghost.x < -0.5) ghost.x = this.map.cols - 0.5;
            if (ghost.x > this.map.cols - 0.5) ghost.x = -0.5;
        }
    }

    _checkCollisions() {
        const pac = this.pacman;
        for (const ghost of this.ghosts) {
            if (ghost.eaten || ghost.respawning) continue;
            const dx = pac.x - ghost.x;
            const dy = pac.y - ghost.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 0.7) {
                if (ghost.scared) {
                    // Eat ghost
                    ghost.eaten = true;
                    ghost.scared = false;
                    this.ghostEatCombo++;
                    const points = CONFIG.score.ghost * Math.pow(2, this.ghostEatCombo - 1);
                    this.score += points;
                    this.ghostsEaten++;
                    this.totalGhostsEaten++;
                    if (typeof SFX !== 'undefined') SFX.eatGhost(this.ghostEatCombo);
                    if (this.onScoreChange) this.onScoreChange(this.score);
                } else {
                    // Pac-Man dies
                    if (typeof SFX !== 'undefined') {
                        SFX.stopScaredSound();
                        SFX.death();
                    }
                    this._pacDeath();
                    return;
                }
            }
        }
    }

    _pacDeath() {
        this.lives--;
        if (this.onLivesChange) this.onLivesChange(this.lives);

        if (this.lives <= 0) {
            this._gameOver();
            return;
        }

        // Reset positions but keep score and dots
        this.paused = true;
        if (this.onDeath) this.onDeath();

        setTimeout(() => {
            this.pacman.x = PACMAN_START.col;
            this.pacman.y = PACMAN_START.row;
            this.pacman.row = PACMAN_START.row;
            this.pacman.col = PACMAN_START.col;
            this.pacman.dir = { r: 0, c: -1 };
            this.pacman.nextDir = { r: 0, c: -1 };

            this.ghosts.forEach((g, i) => {
                g.x = GHOST_STARTS[i].col;
                g.y = GHOST_STARTS[i].row;
                g.row = GHOST_STARTS[i].row;
                g.col = GHOST_STARTS[i].col;
                g.dir = GHOST_INIT_DIRS[i];
                g.scared = false;
                g.eaten = false;
                g.respawning = false;
                g.respawnTimer = 0;
                g.lastDecisionTile = null;
            });

            this.powerMode = false;
            this.paused = false;
        }, 1500);
    }

    _levelClear() {
        this.paused = true;
        if (typeof SFX !== 'undefined') {
            SFX.stopScaredSound();
            SFX.levelClear();
        }
        if (this.onLevelClear) this.onLevelClear(this.level);

        // Check if game complete
        if (this.level >= CONFIG.clearLevel) {
            setTimeout(() => this._gameComplete(), 2000);
            return;
        }

        setTimeout(() => {
            this.level++;
            if (this.onLevelChange) this.onLevelChange(this.level);
            this.init();
            this.resize();
            this.paused = false;
        }, 2000);
    }

    _gameComplete() {
        this.running = false;
        if (typeof SFX !== 'undefined') SFX.victory();
        if (this.onGameEnd) {
            this.onGameEnd({
                score: this.score,
                level: this.level,
                dotsEaten: this.totalDotsEaten,
                ghostsEaten: this.totalGhostsEaten,
                passed: true,
                lives: this.lives,
            });
        }
    }

    _gameOver() {
        this.running = false;
        if (typeof SFX !== 'undefined') SFX.gameOver();
        if (this.onGameEnd) {
            this.onGameEnd({
                score: this.score,
                level: this.level,
                dotsEaten: this.totalDotsEaten,
                ghostsEaten: this.totalGhostsEaten,
                passed: this.score >= CONFIG.passThreshold,
                lives: 0,
            });
        }
    }

    // === Rendering ===
    _render() {
        const { ctx, tileSize } = this;
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);

        // Draw map
        this.map.render(ctx, tileSize);

        // Draw fruit
        if (this.fruitActive) {
            const fx = this.fruitPos.col * tileSize + tileSize / 2;
            const fy = this.fruitPos.row * tileSize + tileSize / 2;
            ctx.fillStyle = '#ff0000';
            ctx.beginPath();
            ctx.arc(fx, fy, tileSize * 0.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#00ff00';
            ctx.fillRect(fx - 1, fy - tileSize * 0.5, 2, tileSize * 0.2);
        }

        // Draw ghosts
        for (const ghost of this.ghosts) {
            this._drawGhost(ghost);
        }

        // Draw Pac-Man
        this._drawPacman();
    }

    _drawPacman() {
        const { ctx, tileSize, pacman } = this;
        const x = pacman.x * tileSize + tileSize / 2;
        const y = pacman.y * tileSize + tileSize / 2;
        const r = tileSize * 0.45;

        // Direction angle
        let angle = 0;
        if (pacman.dir.c === 1) angle = 0;
        else if (pacman.dir.c === -1) angle = Math.PI;
        else if (pacman.dir.r === -1) angle = -Math.PI / 2;
        else if (pacman.dir.r === 1) angle = Math.PI / 2;

        const mouth = this.mouthAngle * Math.PI;

        ctx.fillStyle = '#ffcc00';
        ctx.beginPath();
        ctx.arc(x, y, r, angle + mouth, angle + Math.PI * 2 - mouth);
        ctx.lineTo(x, y);
        ctx.closePath();
        ctx.fill();

        // Eye
        const eyeX = x + Math.cos(angle - 0.5) * r * 0.4;
        const eyeY = y + Math.sin(angle - 0.5) * r * 0.4;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(eyeX, eyeY, r * 0.15, 0, Math.PI * 2);
        ctx.fill();
    }

    _drawGhost(ghost) {
        const { ctx, tileSize } = this;
        const x = ghost.x * tileSize + tileSize / 2;
        const y = ghost.y * tileSize + tileSize / 2;
        const r = tileSize * 0.45;

        if (ghost.eaten) {
            // Just eyes
            this._drawGhostEyes(x, y, r, ghost);
            return;
        }

        let color = ghost.color;
        if (ghost.scared) {
            // Flash when about to end
            if (this.powerTimer < 2 && Math.sin(Date.now() / 100) > 0) {
                color = '#ffffff';
            } else {
                color = '#2222ff';
            }
        }

        // Body
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y - r * 0.1, r, Math.PI, 0);
        ctx.lineTo(x + r, y + r * 0.8);
        // Wavy bottom
        const wave = 3;
        for (let i = wave; i >= 0; i--) {
            const wx = x + r - (i * 2 * r / wave);
            const wy = y + r * 0.8 + (i % 2 === 0 ? r * 0.2 : 0);
            ctx.lineTo(wx, wy);
        }
        ctx.closePath();
        ctx.fill();

        // Eyes
        if (ghost.scared) {
            // Scared face
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(x - r * 0.3, y - r * 0.15, r * 0.15, 0, Math.PI * 2);
            ctx.arc(x + r * 0.3, y - r * 0.15, r * 0.15, 0, Math.PI * 2);
            ctx.fill();
            // Wavy mouth
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x - r * 0.4, y + r * 0.3);
            for (let i = 0; i < 4; i++) {
                ctx.lineTo(x - r * 0.4 + (i + 0.5) * r * 0.2, y + r * (i % 2 === 0 ? 0.15 : 0.35));
            }
            ctx.stroke();
        } else {
            this._drawGhostEyes(x, y, r, ghost);
        }
    }

    _drawGhostEyes(x, y, r, ghost) {
        const { ctx } = this;
        // White of eyes
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.ellipse(x - r * 0.3, y - r * 0.15, r * 0.22, r * 0.28, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(x + r * 0.3, y - r * 0.15, r * 0.22, r * 0.28, 0, 0, Math.PI * 2);
        ctx.fill();

        // Pupils - look toward pac-man
        const pac = this.pacman;
        const dx = pac.x - ghost.x;
        const dy = pac.y - ghost.y;
        const angle = Math.atan2(dy, dx);
        const pupilOff = r * 0.08;

        ctx.fillStyle = '#0000ff';
        ctx.beginPath();
        ctx.arc(x - r * 0.3 + Math.cos(angle) * pupilOff, y - r * 0.15 + Math.sin(angle) * pupilOff, r * 0.12, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + r * 0.3 + Math.cos(angle) * pupilOff, y - r * 0.15 + Math.sin(angle) * pupilOff, r * 0.12, 0, Math.PI * 2);
        ctx.fill();
    }

    getResults() {
        return {
            score: this.score,
            level: this.level,
            dotsEaten: this.totalDotsEaten,
            ghostsEaten: this.totalGhostsEaten,
            passed: this.score >= CONFIG.passThreshold,
        };
    }
}
