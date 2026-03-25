// === Game Configuration ===
const CONFIG = {
    // 管理設定（可透過 #admin 後台調整）
    get secretMessage() {
        return localStorage.getItem('pac_secret') || 'openthedoor';
    },
    get passThreshold() {
        return parseInt(localStorage.getItem('pac_threshold')) || 3000;
    },
    get apiUrl() {
        return localStorage.getItem('pac_api_url') || 'https://script.google.com/macros/s/AKfycbwHvZvRb3ivgQJWKL6jHlwVfohgKvo9g9j_yLn-kwe7yFeacwyNw3PcVpvyzQMfkl2s/exec';
    },
    get logoUrl() {
        return localStorage.getItem('pac_logo_url') || '';
    },
    get logoData() {
        return localStorage.getItem('pac_logo_data') || '';
    },

    // 取得 Logo (優先使用上傳的 base64，其次用 URL)
    getLogoSrc() {
        return this.logoData || this.logoUrl || '';
    },

    // 格子大小 (px)
    tileSize: 20,

    // Pac-Man 速度 (tiles per second)
    pacSpeed: 5,

    // 鬼速度
    ghostSpeed: 3.8,
    ghostScaredSpeed: 2.5,

    // 分數
    score: {
        dot: 10,
        powerDot: 50,
        ghost: 200,     // 第一隻鬼，連續加倍
        fruit: 500,
    },

    // 大力丸效果時間 (ms)
    powerDuration: 7000,

    // 每關加速
    levelSpeedBonus: 0.3,

    // 初始生命
    lives: 3,

    // 過關條件：吃完所有豆子 + 存活到第3關即為破關
    clearLevel: 3,
};
