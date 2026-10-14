/**
 * Generates Google Apps Script code that the user can paste into
 * their spreadsheet's Script Editor. On every edit the script
 * POSTs a webhook to the given URL with HMAC-SHA256 verification.
 */
export function generateAppsScript(webhookUrl: string, secret: string): string {
  return `
// ── FieldScore Sheet Sync Webhook ──────────────────────────
// Paste this code in Extensions → Apps Script for this sheet.
// It fires a webhook on every edit so new rows sync instantly.

var WEBHOOK_URL = "${webhookUrl}";
var SECRET = "${secret}";

function onEdit(e) {
  var sheet = e.source.getActiveSheet();
  var payload = JSON.stringify({
    spreadsheetId: e.source.getId(),
    sheetName: sheet.getName(),
    editedRow: e.range.getRow(),
    timestamp: new Date().toISOString()
  });

  var signature = Utilities.computeHmacSha256Signature(payload, SECRET);
  var hex = signature.map(function(b) {
    return ("0" + (b & 0xFF).toString(16)).slice(-2);
  }).join("");

  UrlFetchApp.fetch(WEBHOOK_URL, {
    method: "post",
    contentType: "application/json",
    payload: payload,
    headers: { "x-webhook-signature": hex },
    muteHttpExceptions: true
  });
}

function installTrigger() {
  ScriptApp.newTrigger("onEdit")
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onEdit()
    .create();
}
`.trim()
}
