// Community Event Sign-ups (from Project Alpha)
// Paste this whole file into https://script.new, then click Run.
// It makes, in your own Google Drive:
//   - a sign-up form in English, Chinese and Malay
//   - a sheet that collects the answers
//   - an A4 QR poster (Google Doc) ready to print
//   - a report the morning after the event: Excel copy + headcount, emailed to you
// Everything goes into one Drive folder, and the links are emailed to you.

var EVENT_NAME = '{{EVENT}}';      // e.g. Family Day 2026
var EVENT_DATE = '{{DATE}}';       // year-month-day, e.g. 2026-09-26
var ORGANISER  = '{{ORGANISER}}';  // e.g. Taman Sejahtera Residents' Association

// ---------------------------------------------------------------------------

function setup() {
  checkSettings();
  var tz = Session.getScriptTimeZone();
  var day = Utilities.parseDate(EVENT_DATE + ' 12:00', tz, 'yyyy-MM-dd HH:mm');
  var nice = Utilities.formatDate(day, tz, 'EEEE, d MMMM yyyy');
  var title = ORGANISER + ' - ' + EVENT_NAME;

  var folder = DriveApp.createFolder(title);

  // 1. The form
  var form = FormApp.create(title + ' - Registration');
  form.setTitle(EVENT_NAME);
  form.setDescription(
    ORGANISER + '\n' + nice + '\n\n' +
    'EN: Please register your attendance.\n' +
    '中文：请填写以下资料报名出席。\n' +
    'BM: Sila daftar kehadiran anda.'
  );
  form.setCollectEmail(false);
  form.setAllowResponseEdits(false);
  form.setLimitOneResponsePerUser(false);

  form.addTextItem().setTitle('Name / 姓名 / Nama').setRequired(true);
  form.addTextItem()
    .setTitle('Phone Number / 电话号码 / No. Telefon')
    .setHelpText('e.g. 012-345 6789')
    .setValidation(FormApp.createTextValidation()
      .requireTextMatchesPattern('^[0-9+\\-\\s]{9,15}$')
      .setHelpText('Please enter a valid phone number / 请输入有效电话号码 / Sila masukkan nombor telefon yang sah')
      .build())
    .setRequired(true);
  form.addParagraphTextItem().setTitle('Address / 地址 / Alamat').setRequired(true);
  form.addTextItem()
    .setTitle('Number of Attendees / 出席人数 / Bilangan Kehadiran')
    .setHelpText('Including yourself / 包括您本人 / Termasuk diri anda')
    .setValidation(FormApp.createTextValidation()
      .requireNumberBetween(1, 30)
      .setHelpText('Enter a number 1-30 / 请输入1至30 / Masukkan nombor 1-30')
      .build())
    .setRequired(true);
  form.setConfirmationMessage(
    'Thank you! See you on ' + Utilities.formatDate(day, tz, 'd MMMM') + '.\n' +
    '谢谢！到时见。\n' +
    'Terima kasih! Jumpa nanti.'
  );

  // 2. The answers sheet
  var ss = SpreadsheetApp.create(title + ' - Responses');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  var link = form.getPublishedUrl();

  // 3. The QR poster
  var qr = UrlFetchApp.fetch('https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=10&data=' +
    encodeURIComponent(link)).getBlob().setName('qr.png');
  var doc = DocumentApp.create(title + ' - QR poster');
  var body = doc.getBody();
  body.setMarginTop(50).setMarginBottom(50);
  var center = DocumentApp.HorizontalAlignment.CENTER;
  body.getParagraphs()[0].setText(ORGANISER).setAlignment(center).editAsText().setFontSize(16);
  body.appendParagraph(EVENT_NAME).setAlignment(center).editAsText().setFontSize(30).setBold(true);
  body.appendParagraph(nice).setAlignment(center).editAsText().setFontSize(16).setBold(false);
  body.appendParagraph('').setAlignment(center);
  body.appendParagraph('').setAlignment(center).appendInlineImage(qr).setWidth(330).setHeight(330);
  body.appendParagraph('Scan to register  |  扫码报名  |  Imbas untuk daftar')
    .setAlignment(center).editAsText().setFontSize(18).setBold(true);
  body.appendParagraph(link).setAlignment(center).editAsText().setFontSize(9).setBold(false);
  doc.saveAndClose();

  // Everything into the one folder
  [form.getId(), ss.getId(), doc.getId()].forEach(function (id) {
    DriveApp.getFileById(id).moveTo(folder);
  });

  // 4. The report, the morning after the event
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sendReport') ScriptApp.deleteTrigger(t);
  });
  var morning = new Date(day.getTime() + 21 * 3600 * 1000); // next day, 9am
  var reportLine;
  if (morning > new Date()) {
    ScriptApp.newTrigger('sendReport').timeBased().at(morning).create();
    reportLine = 'Report: arrives by email on ' + Utilities.formatDate(morning, tz, 'EEEE d MMMM, h a') + '.';
  } else {
    reportLine = 'Report: the event date has passed, so no report is scheduled. Run sendReport any time.';
  }

  PropertiesService.getScriptProperties().setProperties({
    folder: folder.getId(), sheet: ss.getId(), title: title
  });

  var msg =
    'Your sign-up is ready.\n\n' +
    'Share this link, or print the poster:\n' + link + '\n\n' +
    'QR poster (File > Print): ' + doc.getUrl() + '\n' +
    'Answers sheet: ' + ss.getUrl() + '\n' +
    'Edit the form: ' + form.getEditUrl() + '\n' +
    'Folder: ' + folder.getUrl() + '\n\n' + reportLine;
  MailApp.sendEmail(Session.getActiveUser().getEmail(), title + ' - sign-up ready', msg);
  Logger.log(msg);
}

// Runs by itself the morning after the event. You can also run it by hand.
function sendReport() {
  var p = PropertiesService.getScriptProperties().getProperties();
  if (!p.sheet) throw new Error('Run setup first.');
  var ss = SpreadsheetApp.openById(p.sheet);
  var data = ss.getSheets()[0].getDataRange().getValues();
  var head = data[0];
  var col = head.length - 1;
  for (var i = 0; i < head.length; i++) if (/Attendees/i.test(head[i])) col = i;
  var regs = data.length - 1, people = 0;
  for (var r = 1; r < data.length; r++) people += Number(data[r][col]) || 0;

  var folder = DriveApp.getFolderById(p.folder);
  var xlsx = UrlFetchApp.fetch('https://docs.google.com/spreadsheets/d/' + p.sheet + '/export?format=xlsx', {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }
  }).getBlob().setName(p.title + ' - Attendees (final).xlsx');
  var file = folder.createFile(xlsx);
  var summary = p.title + '\n\nRegistrations: ' + regs + '\nTotal attendees: ' + people +
    '\n\nExcel copy: ' + file.getUrl() + '\nLive sheet: ' + ss.getUrl() + '\nFolder: ' + folder.getUrl();
  folder.createFile('Summary.txt', summary);
  MailApp.sendEmail(Session.getActiveUser().getEmail(), p.title + ' - registration report', summary);

  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sendReport') ScriptApp.deleteTrigger(t);
  });
  Logger.log(summary);
}

function checkSettings() {
  if (/\{\{/.test(EVENT_NAME + EVENT_DATE + ORGANISER) || !EVENT_NAME || !ORGANISER) {
    throw new Error('Fill in EVENT_NAME, EVENT_DATE and ORGANISER at the top first.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(EVENT_DATE)) {
    throw new Error('EVENT_DATE must look like 2026-09-26 (year-month-day).');
  }
}
