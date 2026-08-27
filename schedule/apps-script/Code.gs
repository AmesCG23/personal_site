/**
 * Backend for the /schedule/ day-picker poll. Deployed as a Web App bound to the
 * "Scheduling Polls" Google Sheet. See README.md in this folder for setup steps.
 *
 * Sheet layout (see the Sheet's own README tab for the human-readable version):
 *   <slug>_Config:    B1 = poll title; rows 4+ = Date (YYYY-MM-DD text) | Label
 *   <slug>_Responses: row 1 = Name | <date columns...> | UpdatedAt; rows 2+ = data
 */

function doGet(e) {
  var poll = ((e && e.parameter && e.parameter.poll) || '').trim();
  if (!poll) return jsonOut({ error: 'Missing poll parameter' });

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var configSheet = ss.getSheetByName(poll + '_Config');
  var responsesSheet = ss.getSheetByName(poll + '_Responses');
  if (!configSheet || !responsesSheet) {
    return jsonOut({ error: 'Poll not found: ' + poll });
  }

  var days = readDays(configSheet);
  var title = String(configSheet.getRange('B1').getValue() || poll);
  var responses = readResponses(responsesSheet, days);

  return jsonOut({ poll: poll, title: title, days: days, responses: responses });
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOut({ error: 'Invalid request body' });
  }

  var poll = String(body.poll || '').trim();
  var name = String(body.name || '').trim();
  var selectedDays = body.days || [];

  if (!poll || !name) return jsonOut({ error: 'Missing poll or name' });

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var configSheet = ss.getSheetByName(poll + '_Config');
  var responsesSheet = ss.getSheetByName(poll + '_Responses');
  if (!configSheet || !responsesSheet) {
    return jsonOut({ error: 'Poll not found: ' + poll });
  }

  var days = readDays(configSheet);

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var header = ensureHeader(responsesSheet, days);

    var rowIndex = -1;
    var lastRow = responsesSheet.getLastRow();
    if (lastRow >= 2) {
      var names = responsesSheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var i = 0; i < names.length; i++) {
        if (String(names[i][0]).trim().toLowerCase() === name.toLowerCase()) {
          rowIndex = i + 2;
          break;
        }
      }
    }
    if (rowIndex === -1) {
      rowIndex = responsesSheet.getLastRow() + 1;
      responsesSheet.getRange(rowIndex, 1).setValue(name);
    }

    days.forEach(function (d) {
      var col = header.indexOf(d.date) + 1;
      var checked = selectedDays.indexOf(d.date) !== -1;
      responsesSheet.getRange(rowIndex, col).setValue(checked);
    });

    var updatedAtCol = header.indexOf('UpdatedAt') + 1;
    responsesSheet.getRange(rowIndex, updatedAtCol).setValue(new Date());
  } finally {
    lock.releaseLock();
  }

  return doGet({ parameter: { poll: poll } });
}

/** Reads the Date/Label rows (from row 4 down) out of a <slug>_Config sheet. */
function readDays(configSheet) {
  var lastRow = configSheet.getLastRow();
  if (lastRow < 4) return [];
  var values = configSheet.getRange(4, 1, lastRow - 3, 2).getValues();
  var days = [];
  values.forEach(function (row) {
    var date = row[0];
    if (!date) return;
    days.push({ date: String(date).trim(), label: String(row[1] || date).trim() });
  });
  return days;
}

/**
 * Ensures the header row has a column for every day in `days`, appending new
 * columns (before UpdatedAt) as needed. Never reorders existing columns, so
 * previously recorded responses are never displaced.
 */
function ensureHeader(sheet, days) {
  var lastCol = sheet.getLastColumn();
  if (lastCol === 0) {
    var header = ['Name'].concat(days.map(function (d) { return d.date; })).concat(['UpdatedAt']);
    sheet.getRange(1, 1, 1, header.length).setValues([header]);
    return header;
  }

  var header = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var updatedAtIdx = header.indexOf('UpdatedAt');
  if (updatedAtIdx === -1) {
    sheet.getRange(1, lastCol + 1).setValue('UpdatedAt');
    header.push('UpdatedAt');
    updatedAtIdx = header.length - 1;
  }

  var missing = days.filter(function (d) { return header.indexOf(d.date) === -1; });
  if (missing.length) {
    var insertAt = updatedAtIdx + 1; // 1-based column number of the UpdatedAt column
    sheet.insertColumnsBefore(insertAt, missing.length);
    missing.forEach(function (d, i) {
      sheet.getRange(1, insertAt + i).setValue(d.date);
    });
    header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  }

  return header;
}

/** Reads every response row, projecting each into the current `days` order. */
function readResponses(sheet, days) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var lastCol = sheet.getLastColumn();
  var header = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var updatedAtIdx = header.indexOf('UpdatedAt');
  var data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  var results = [];
  data.forEach(function (row) {
    var name = row[0];
    if (!name) return;
    var dayFlags = days.map(function (d) {
      var idx = header.indexOf(d.date);
      return idx === -1 ? false : row[idx] === true;
    });
    var updatedAt = updatedAtIdx !== -1 && row[updatedAtIdx] ? String(row[updatedAtIdx]) : '';
    results.push({ name: String(name), days: dayFlags, updatedAt: updatedAt });
  });
  return results;
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Convenience menu for creating new polls without hand-duplicating tabs. */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Scheduler')
    .addItem('Create new poll...', 'createPollPrompt')
    .addToUi();
}

function createPollPrompt() {
  var ui = SpreadsheetApp.getUi();
  var slugResp = ui.prompt(
    'New poll',
    'URL slug for the new poll (letters, numbers, hyphens only):',
    ui.ButtonSet.OK_CANCEL
  );
  if (slugResp.getSelectedButton() !== ui.Button.OK) return;
  var slug = slugResp.getResponseText().trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
  if (!slug) {
    ui.alert('Invalid slug.');
    return;
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss.getSheetByName(slug + '_Config')) {
    ui.alert('A poll with that slug already exists.');
    return;
  }

  var titleResp = ui.prompt('Poll title', 'Display title for this poll:', ui.ButtonSet.OK_CANCEL);
  if (titleResp.getSelectedButton() !== ui.Button.OK) return;
  var title = titleResp.getResponseText().trim() || slug;

  var templateConfig = ss.getSheetByName('_TEMPLATE_Config');
  var templateResponses = ss.getSheetByName('_TEMPLATE_Responses');
  if (!templateConfig || !templateResponses) {
    ui.alert('Could not find _TEMPLATE_Config / _TEMPLATE_Responses tabs to copy.');
    return;
  }

  var config = templateConfig.copyTo(ss).setName(slug + '_Config');
  templateResponses.copyTo(ss).setName(slug + '_Responses');
  config.getRange('B1').setValue(title);
  ss.setActiveSheet(config);

  ui.alert(
    'Created "' + slug + '". Fill in the Date/Label rows in ' + slug + '_Config, then share:\n\n' +
    'https://amesgrawert.com/schedule/?poll=' + slug
  );
}
