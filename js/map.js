// === Map Definition ===
// 0 = path (dot), 1 = wall, 2 = empty (no dot), 3 = power dot,
// 4 = ghost house, 5 = ghost door, 6 = logo area (empty center)
// P = pac-man start, G = ghost start

const MAP_TEMPLATE = [
    // 28 columns x 31 rows (classic Pac-Man inspired, center logo area)
    "1111111111111111111111111111",  // 0
    "1000000000000110000000000001",  // 1
    "1011110111110110111110111101",  // 2
    "1311110111110110111110111131",  // 3
    "1011110111110110111110111101",  // 4
    "1000000000000000000000000001",  // 5
    "1011110110111111110110111101",  // 6
    "1011110110111111110110111101",  // 7
    "1000000110000110000110000001",  // 8
    "1111110111110110111110111111",  // 9
    "2222210110000000000110122222",  // 10
    "2222210110011111100110122222",  // 11
    "2222210110015555100110122222",  // 12 (door = 4 tiles wide)
    "1111110000016666610001111111",  // 13
    "2222220010016666610100222222",  // 14
    "2222220010016666610100222222",  // 15
    "1111110010011111100100111111",  // 16
    "2222210110000000000110122222",  // 17
    "2222210110111111110110122222",  // 18
    "1111110110111111110110111111",  // 19
    "1000000000000110000000000001",  // 20
    "1011110111110110111110111101",  // 21
    "1011110111110110111110111101",  // 22
    "1300110000000020000000110031",  // 23
    "1110110110111111110110110111",  // 24
    "1110110110111111110110110111",  // 25
    "1000000110000110000110000001",  // 26
    "1011111111110110111111111101",  // 27
    "1011111111110110111111111101",  // 28
    "1000000000000000000000000001",  // 29
    "1111111111111111111111111111",  // 30
];

// Pac-Man start position
const PACMAN_START = { row: 23, col: 13 };

// Ghost start positions (inside ghost house)
const GHOST_STARTS = [
    { row: 13, col: 13 },  // Blinky (red) - center
    { row: 14, col: 12 },  // Pinky (pink)
    { row: 14, col: 14 },  // Inky (cyan)
    { row: 15, col: 13 },  // Clyde (orange)
];

// Ghost exit waypoints: inside house → door → above door → scatter point
const GHOST_DOOR = { row: 12, col: 13 };   // door line
const GHOST_EXIT = { row: 10, col: 13 };    // safe open corridor above house
const GHOST_SCATTER = [                       // scatter targets (4 corners)
    { row: 1, col: 26 },   // Blinky → top-right
    { row: 1, col: 1 },    // Pinky → top-left
    { row: 29, col: 26 },  // Inky → bottom-right
    { row: 29, col: 1 },   // Clyde → bottom-left
];

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
