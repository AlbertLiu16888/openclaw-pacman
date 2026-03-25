// === Game Configuration ===
// 優先讀取遠端 (Google Sheets Config)，fallback 到 localStorage
const CONFIG = {
    _remote: {},       // 從 API 載入的遠端設定
    _loaded: false,    // 遠端設定是否已載入

    get secretMessage() {
        return this._remote.secretMessage
            || localStorage.getItem('pac_secret')
            || 'openthedoor';
    },
    get passThreshold() {
        const remote = parseInt(this._remote.passThreshold);
        if (!isNaN(remote) && remote > 0) return remote;
        return parseInt(localStorage.getItem('pac_threshold')) || 3000;
    },
    get apiUrl() {
        return localStorage.getItem('pac_api_url') || 'https://script.google.com/macros/s/AKfycbwAhuS5A02qLzdvUIzgCabG0FhTJdxlLpQBmAcJzIOgO3GvzMBEzilIzeblsPCnzi-m/exec';
    },
    get logoUrl() {
        return localStorage.getItem('pac_logo_url') || '';
    },
    get logoData() {
        return localStorage.getItem('pac_logo_data') || '';
    },

    getLogoSrc() {
        return this.logoData || this.logoUrl || '';
    },

    // 遊戲識別碼（用於 API 分流）
    gameId: 'pacman',

    // 從 Google Sheets Config 分頁載入遠端設定
    async loadRemoteConfig() {
        const url = this.apiUrl;
        if (!url) return;
        try {
            const res = await fetch(`${url}?action=getConfig&game=${this.gameId}`);
            const data = await res.json();
            if (data && typeof data === 'object' && !data.error) {
                this._remote = data;
                this._loaded = true;
                console.log('Remote config loaded:', data);
            }
        } catch (e) {
            console.warn('Failed to load remote config, using local:', e);
        }
    },

    // 儲存設定到遠端 Google Sheets
    async saveRemoteConfig(key, value) {
        const url = this.apiUrl;
        if (!url) return;
        try {
            await fetch(url, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'setConfig', game: this.gameId, key, value }),
            });
            this._remote[key] = value;
        } catch (e) {
            console.warn('Failed to save remote config:', e);
        }
    },

    // 格子大小 (px)
    tileSize: 20,
    pacSpeed: 5,
    ghostSpeed: 3.8,
    ghostScaredSpeed: 2.5,

    score: {
        dot: 10,
        powerDot: 50,
        ghost: 200,
        fruit: 500,
    },

    powerDuration: 7000,
    levelSpeedBonus: 0.3,
    lives: 3,
    clearLevel: 3,
};
