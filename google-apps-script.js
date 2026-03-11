/**
 * NadiCare Hackathon — Google Apps Script
 * ══════════════════════════════════════════
 * HOW TO SET UP:
 *
 * 1. Open your Google Sheet (create one if needed: sheets.google.com)
 * 2. Click  Extensions → Apps Script
 * 3. Delete all existing code in the editor
 * 4. Paste THIS ENTIRE FILE into the editor
 * 5. Click  Save  (floppy disk icon)
 * 6. Click  Deploy → New deployment
 * 7. Choose type:  Web app
 *    - Description: "NadiCare Evaluator"
 *    - Execute as:  Me
 *    - Who has access:  Anyone
 * 8. Click  Deploy → Authorize  (grant permissions to your account)
 * 9. Copy the  Web app URL  that appears (looks like:
 *    https://script.google.com/macros/s/AKfy.../exec)
 * 10. Open  server.js  in your project and paste the URL as the value of
 *     GOOGLE_SCRIPT_URL  (line ~10)
 * 11. Restart the Node server:  node server.js
 *
 * That's it! Every evaluation submitted will now auto-appear in your Sheet.
 */

const SHEET_NAME = "NadiCare Evaluations";

const HEADERS = [
  "Timestamp",
  "Evaluator",
  "Team Name",
  "Problem Statement",
  "Innovation & Creativity",
  "Technical Skills",
  "Presentation & Communication",
  "Impact & Feasibility",
  "UI/UX & Design",
  "Total Score",
  "Max Possible",
  "Remarks"
];

function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);

    // Write header row
    sheet.appendRow(HEADERS);

    // Style header row
    const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
    headerRange.setBackground("#FF6B00");
    headerRange.setFontColor("#FFFFFF");
    headerRange.setFontWeight("bold");
    headerRange.setFontSize(11);

    // Freeze header row
    sheet.setFrozenRows(1);

    // Set column widths
    sheet.setColumnWidth(1, 160); // Timestamp
    sheet.setColumnWidth(2, 110); // Evaluator
    sheet.setColumnWidth(3, 140); // Team
    sheet.setColumnWidth(4, 380); // Problem Statement
    sheet.setColumnWidths(5, 5, 130); // Criteria scores
    sheet.setColumnWidth(10, 110); // Total
    sheet.setColumnWidth(11, 100); // Max
    sheet.setColumnWidth(12, 260); // Remarks
  }

  return sheet;
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const sheet   = getOrCreateSheet();

    const scores  = payload.scores || {};
    const row = [
      payload.timestamp    || new Date().toLocaleString(),
      payload.evaluator    || "",
      payload.team         || "",
      payload.problem      || "",
      scores.innovation    ?? "",
      scores.technical     ?? "",
      scores.presentation  ?? "",
      scores.impact        ?? "",
      scores.design        ?? "",
      payload.total        ?? "",
      50,
      payload.remarks      || ""
    ];

    sheet.appendRow(row);

    // Colour-code the total score cell (last appended row, col 10)
    const lastRow   = sheet.getLastRow();
    const totalCell = sheet.getRange(lastRow, 10);
    const total     = Number(payload.total);
    if      (total >= 40) totalCell.setBackground("#d4edda"); // green
    else if (total >= 25) totalCell.setBackground("#fff3cd"); // yellow
    else                  totalCell.setBackground("#f8d7da"); // red

    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Used by Google to verify the script is reachable
function doGet() {
  return ContentService
    .createTextOutput("NadiCare evaluator script is active ✓")
    .setMimeType(ContentService.MimeType.TEXT);
}
