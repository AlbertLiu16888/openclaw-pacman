// === Map Definition ===
// 0 = path (dot), 1 = wall, 2 = empty (no dot), 3 = power dot,
// 4 = ghost house, 5 = ghost door, 6 = logo area (empty center)
// P = pac-man start, G = ghost start

const MAP_TEMPLATE = [
    // 28 columns x 31 rows (classic inspired, with center logo area)
    "1111111111111111111111111111",
    "1000000000000110000000000001",
    "1011110111110110111110111101",
    "1311110111110110111110111131",
    "1011110111110110111110111101",
    "1000000000000000000000000001",
    "1011110110111111110110111101",
    "1011110110111111110110111101",
    "1000000110000110000110000001",
    "1111110111110110111110111111",
    "2222210111110110111110122222",
    "2222210110000000000110122222",
    "2222210110111551110110122222",
    "1111110000166666610001111111",
    "2222220010166666610100222222",
    "2222220010166666610100222222",
    "1111110010111111110100111111",
    "2222210110000000000110122222",
    "2222210110111111110110122222",
    "1111110110111111110110111111",
    "1000000000000110000000000001",
    "1011110111110110111110111101",
    "1011110111110110111110111101",
    "1300110000000020000000110031",
    "1110110110111111110110110111",
    "1110110110111111110110110111",
    "1000000110000110000110000001",
    "1011111111110110111111111101",
    "1011111111110110111111111101",
    "1000000000000000000000000001",
    "1111111111111111111111111111",
];

// Pac-Man start position (row, col) - the '2' at row 23, col 13
const PACMAN_START = { row: 23, col: 13 };

// Ghost start positions (inside ghost house)
const GHOST_STARTS = [
    { row: 13, col: 12 },  // Blinky (red)
    { row: 14, col: 13 },  // Pinky (pink)
    { row: 14, col: 14 },  // Inky (cyan)
    { row: 15, col: 13 },  // Clyde (orange)
];

// Ghost exit target (above the door, in open path)
const GHOST_EXIT = { row: 11, col: 13 };

// Ghost door position (for eaten ghosts returning)
const GHOST_DOOR = { row: 12, col: 13 };

class GameMap {
    constructor() {
        this.grid = [];
        this.rows = 0;
        this.cols = 0;
        this.totalDots = 0;
        this.logoImage = null;
        this.logoLoaded = false;
        this.reset();
    }

    reset() {
        this.grid = MAP_TEMPLATE.map(row => row.split('').map(Number));
        this.rows = this.grid.length;
        this.cols = this.grid[0].length;
        this.totalDots = 0;
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.grid[r][c] === 0 || this.grid[r][c] === 3) {
                    this.totalDots++;
                }
            }
        }
    }

    loadLogo() {
        const src = CONFIG.getLogoSrc();
        if (!src) {
            this.logoLoaded = false;
            this.logoImage = null;
            return;
        }
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            this.logoImage = img;
            this.logoLoaded = true;
        };
        img.onerror = () => {
            this.logoLoaded = false;
            this.logoImage = null;
        };
        img.src = src;
    }

    isWall(row, col) {
        if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return true;
        const cell = this.grid[row][col];
        return cell === 1 || cell === 4 || cell === 5;
    }

    isGhostHouse(row, col) {
        if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return false;
        return this.grid[row][col] === 4 || this.grid[row][col] === 5 || this.grid[row][col] === 6;
    }

    canGhostPass(row, col) {
        if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return false;
        const cell = this.grid[row][col];
        // Normal ghosts can only walk on paths (0,2,3), NOT through door(5) or house(4,6)
        return cell === 0 || cell === 2 || cell === 3;
    }

    eatDot(row, col) {
        if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return null;
        const cell = this.grid[row][col];
        if (cell === 0) {
            this.grid[row][col] = 2;
            return 'dot';
        }
        if (cell === 3) {
            this.grid[row][col] = 2;
            return 'power';
        }
        return null;
    }

    // 繪製地圖
    render(ctx, tileSize) {
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const x = c * tileSize;
                const y = r * tileSize;
                const cell = this.grid[r][c];

                if (cell === 1) {
                    // Wall
                    ctx.fillStyle = '#1a1aff';
                    ctx.fillRect(x, y, tileSize, tileSize);
                    // Inner shadow
                    ctx.fillStyle = '#0000aa';
                    ctx.fillRect(x + 1, y + 1, tileSize - 2, tileSize - 2);
                    ctx.fillStyle = '#2222cc';
                    ctx.fillRect(x + 2, y + 2, tileSize - 4, tileSize - 4);
                } else if (cell === 0) {
                    // Dot
                    ctx.fillStyle = '#ffcc00';
                    ctx.beginPath();
                    ctx.arc(x + tileSize / 2, y + tileSize / 2, 2, 0, Math.PI * 2);
                    ctx.fill();
                } else if (cell === 3) {
                    // Power dot (blinking)
                    const blink = Math.sin(Date.now() / 200) > 0;
                    if (blink) {
                        ctx.fillStyle = '#ffcc00';
                        ctx.beginPath();
                        ctx.arc(x + tileSize / 2, y + tileSize / 2, 5, 0, Math.PI * 2);
                        ctx.fill();
                    }
                } else if (cell === 5) {
                    // Ghost door
                    ctx.fillStyle = '#ffaacc';
                    ctx.fillRect(x, y + tileSize / 2 - 2, tileSize, 4);
                }
            }
        }

        // Draw logo in center (logo area is rows 13-15, cols 5-10 area roughly)
        if (this.logoLoaded && this.logoImage) {
            // Logo area: tiles marked as 6
            let minR = Infinity, maxR = 0, minC = Infinity, maxC = 0;
            for (let r = 0; r < this.rows; r++) {
                for (let c = 0; c < this.cols; c++) {
                    if (this.grid[r][c] === 6) {
                        minR = Math.min(minR, r);
                        maxR = Math.max(maxR, r);
                        minC = Math.min(minC, c);
                        maxC = Math.max(maxC, c);
                    }
                }
            }
            if (minR !== Infinity) {
                const lx = minC * tileSize + 2;
                const ly = minR * tileSize + 2;
                const lw = (maxC - minC + 1) * tileSize - 4;
                const lh = (maxR - minR + 1) * tileSize - 4;
                // Maintain aspect ratio
                const imgRatio = this.logoImage.width / this.logoImage.height;
                const areaRatio = lw / lh;
                let drawW, drawH, drawX, drawY;
                if (imgRatio > areaRatio) {
                    drawW = lw;
                    drawH = lw / imgRatio;
                    drawX = lx;
                    drawY = ly + (lh - drawH) / 2;
                } else {
                    drawH = lh;
                    drawW = lh * imgRatio;
                    drawX = lx + (lw - drawW) / 2;
                    drawY = ly;
                }
                ctx.globalAlpha = 0.8;
                ctx.drawImage(this.logoImage, drawX, drawY, drawW, drawH);
                ctx.globalAlpha = 1;
            }
        }
    }

    // Tunnel wrap: if out of bounds horizontally, wrap around
    wrapPosition(row, col) {
        if (col < 0) col = this.cols - 1;
        if (col >= this.cols) col = 0;
        return { row, col };
    }
}
