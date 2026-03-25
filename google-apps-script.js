/**
 * Google Apps Script - 小精靈遊戲後端
 *
 * 功能：排行榜 + 遊戲設定（破關訊息、過關分數等）
 *
 * 需要兩個分頁：
 *   1. "Sheet1"  — 排行榜（A:name, B:score, C:date）
 *   2. "Config"  — 遊戲設定（A:key, B:value）
 *
 * Config 分頁預設內容：
 *   A1: key           B1: value
 *   A2: secretMessage  B2: 楚融生日快樂
 *   A3: passThreshold  B3: 3000
 *
 * 部署：擴充功能 > Apps Script > 貼上 > 部署 > 網頁應用程式
 *       執行身分：自己，存取權限：任何人
 */

function doGet(e) {
  const action = e.parameter.action;
  if (action === 'getScores') return getScores();
  if (action === 'getConfig') return getConfig();
  return jsonResponse({ error: 'Unknown action' });
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.action === 'addScore') return addScore(data.name, data.score);
    if (data.action === 'setConfig') return setConfig(data.key, data.value);
    return jsonResponse({ error: 'Unknown action' });
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// === Sheets ===
function getSheet() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sheet1')
    || SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
}

function getConfigSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Config');
  if (!sheet) {
    // Auto-create Config sheet with defaults
    sheet = ss.insertSheet('Config');
    sheet.appendRow(['key', 'value']);
    sheet.appendRow(['secretMessage', 'openthedoor']);
    sheet.appendRow(['passThreshold', '3000']);
  }
  return sheet;
}

// === Leaderboard ===
function getScores() {
  var sheet = getSheet();
  var data = sheet.getDataRange().getValues();
  var all = data.slice(1)
    .map(function(row) { return { name: row[0], score: Number(row[1]), date: row[2] }; })
    .filter(function(s) { return s.name && !isNaN(s.score); });

  var byName = {};
  for (var i = 0; i < all.length; i++) {
    var s = all[i];
    if (!byName[s.name] || s.score > byName[s.name].score) {
      byName[s.name] = s;
    }
  }

  var scores = Object.keys(byName).map(function(k) { return byName[k]; });
  scores.sort(function(a, b) { return b.score - a.score; });
  scores = scores.slice(0, 10);

  return jsonResponse(scores);
}

function addScore(name, score) {
  if (!name || typeof score !== 'number') {
    return jsonResponse({ error: 'Invalid data' });
  }
  name = String(name).replace(/<[^>]*>/g, '').substring(0, 12);
  var sheet = getSheet();
  var date = new Date().toISOString().slice(0, 10);
  sheet.appendRow([name, score, date]);
  return jsonResponse({ success: true });
}

// === Config ===
function getConfig() {
  var sheet = getConfigSheet();
  var data = sheet.getDataRange().getValues();
  var config = {};
  for (var i = 1; i < data.length; i++) {
    if (data[i][0]) {
      config[data[i][0]] = data[i][1];
    }
  }
  return jsonResponse(config);
}

function setConfig(key, value) {
  if (!key) return jsonResponse({ error: 'Missing key' });
  var sheet = getConfigSheet();
  var data = sheet.getDataRange().getValues();

  // Find existing key and update
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      return jsonResponse({ success: true, key: key, value: value });
    }
  }

  // Key not found, add new row
  sheet.appendRow([key, value]);
  return jsonResponse({ success: true, key: key, value: value });
}
