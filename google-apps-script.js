/**
 * Google Apps Script - 小精靈排行榜後端
 *
 * ※ 可與節奏遊戲共用同一個 Google 試算表，
 *   只要在同一份試算表新增一個分頁叫 "PacMan"
 *   或獨立建一個試算表皆可。
 *
 * 使用方式：
 * 1. Google 試算表的第一個分頁（或指定分頁名 "Sheet1"）
 * 2. A1:C1 標題：name, score, date
 * 3. 擴充功能 > Apps Script > 貼上此程式碼
 * 4. 部署 > 新增部署 > 網頁應用程式
 * 5. 執行身分：自己，存取權限：任何人
 * 6. 複製 URL 貼到遊戲 #admin 後台
 */

function doGet(e) {
  const action = e.parameter.action;
  if (action === 'getScores') {
    return getScores();
  }
  return ContentService.createTextOutput(JSON.stringify({ error: 'Unknown action' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.action === 'addScore') {
      return addScore(data.name, data.score);
    }
    return ContentService.createTextOutput(JSON.stringify({ error: 'Unknown action' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getSheet() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sheet1')
    || SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
}

function getScores() {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  const all = data.slice(1)
    .map(row => ({ name: row[0], score: Number(row[1]), date: row[2] }))
    .filter(s => s.name && !isNaN(s.score));

  // 同名玩家只保留最高分
  const byName = {};
  for (const s of all) {
    if (!byName[s.name] || s.score > byName[s.name].score) {
      byName[s.name] = s;
    }
  }

  const scores = Object.values(byName)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  return ContentService.createTextOutput(JSON.stringify(scores))
    .setMimeType(ContentService.MimeType.JSON);
}

function addScore(name, score) {
  if (!name || typeof score !== 'number') {
    return ContentService.createTextOutput(JSON.stringify({ error: 'Invalid data' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  name = String(name).replace(/<[^>]*>/g, '').substring(0, 12);
  const sheet = getSheet();
  const date = new Date().toISOString().slice(0, 10);
  sheet.appendRow([name, score, date]);
  return ContentService.createTextOutput(JSON.stringify({ success: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
