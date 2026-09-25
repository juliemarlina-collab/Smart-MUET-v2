/***************************************************************
 * SMART MUET GUIDE — pilot backend with badge and private audio storage
 * Built from the previously supplied Code.gs; preserve your current deployment
 * until the test sequence below succeeds.
 *
 * SETUP STEPS:
 * 1. Open your Google Sheet
 * 2. Extensions → Apps Script → paste this file as Code.gs
 * 3. Confirm SPREADSHEET_ID below matches your existing backend sheet.
 * 4. Run validatePilotSetup() once; grant Sheet and Drive permissions.
 * 5. Deploy → Manage deployments → Edit → New version (or New Deployment)
 *    Execute as: Me
 *    Who has access: Anyone (even anonymous)
 * 6. If the /exec URL changes, update js/backend-config.js before upload.
 * 7. Test one consenting and one non-consenting Speaking attempt.
 ***************************************************************/

var SPREADSHEET_ID = '1feG63-xQQChGxvcvlQ1xVIvjZBHJhF-153qlEw_3QmQ';
var AUDIO_FOLDER_PROPERTY = 'SMART_MUET_PRIVATE_AUDIO_FOLDER_ID';
var MAX_AUDIO_BASE64_LENGTH = 4000000; // Approx. 3 MB decoded; keep pilot uploads small.
var PILOT_BADGES = {first:'First Step',prep:'PREP Starter',discussion:'Discussion Builder',passage:'Passage Hunter',audio:'Audio Focus',essay:'Essay Builder',vault:'Vault Finisher',climber:'Band Climber'};

var SHEET = {
  STUDENTS:  'Students',
  ATTEMPTS:  'Attempts',
  SPEAKING:  'Speaking',
  READING:   'Reading',
  LISTENING: 'Listening',
  WRITING:   'Writing',
  BADGES:    'Badges',
  LOG:       'Activity_Log'
};

/***************************************************************
 * SETUP VALIDATION (NEW - RUN THIS FIRST!)
 ***************************************************************/
function validateSetup() {
  if (!SPREADSHEET_ID || SPREADSHEET_ID.indexOf('PASTE_') === 0) {
    throw new Error(
      '❌ SETUP ERROR:\n\n' +
      'Your Google Sheet ID is not set.\n\n' +
      'TO FIX:\n' +
      '1. Open your Google Sheet in a browser\n' +
      '2. Copy the ID from the URL: docs.google.com/spreadsheets/d/[THIS_IS_YOUR_ID]/edit\n' +
      '3. In Code.gs, line 17, replace PASTE_YOUR_GOOGLE_SHEET_ID_HERE with your ID\n' +
      '4. Run validateSetup() again from the run menu\n' +
      '5. Then run setupSheets()\n\n' +
      'Your Sheet ID should look like: 1a2b3c4d5e6f7g8h9i0j...'
    );
  }
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    setupIfNeeded_();
    return ContentService.createTextOutput(
      '✓ Smart MUET Guide backend is ready!\n' +
      'Sheet ID: ' + SPREADSHEET_ID + '\n' +
      'Status: Sheets configured and verified.\n' +
      'Next: Deploy as Web App and paste URL in backend-config.js'
    ).setMimeType(ContentService.MimeType.TEXT);
  } catch(e) {
    throw new Error('Cannot access spreadsheet: ' + String(e) + '\n\nDouble-check your Sheet ID.');
  }
}

// Run once in the Apps Script editor before deploying this pilot version.
// This prompts for the Drive permission and prepares private storage.
function validatePilotSetup() {
  validateSetup();
  setupSheets();
  var folder=privateAudioFolder_();
  Logger.log('Pilot ready. Private audio folder ID: '+folder.getId());
  return {status:'ok',audioFolderId:folder.getId()};
}

/***************************************************************
 * ROUTING
 ***************************************************************/
function doGet(e) {
  var params = e && e.parameter ? e.parameter : {};
  var action = clean(params.action);
  try {
    setupIfNeeded_();
    if (action === 'ping') return json({ status:'ok', message:'Smart MUET Guide backend running.', ts: new Date().toISOString() });
    if (action === 'student_status') return json(handleStudentStatus(params));
    if (action === 'class_results') return json(handleClassResults(params));
    if (action === 'audio_status') return audioStatusResponse_(params);
    if (action === 'attempt_status') return attemptStatusResponse_(params);
    if (action === 'mock_result') return mockResultResponse_(params);
    return json({ status:'error', message:'Unknown GET action: ' + action });
  } catch(err) {
    return json({ status:'error', message: String(err) });
  }
}

function doPost(e) {
  try {
    setupIfNeeded_();
    var raw  = e && e.postData ? e.postData.contents : '{}';
    var data = JSON.parse(raw);
    var action = clean(data.action);

    if (action === 'register' || action === 'registerUser') return json(handleRegister(data));
    if (action === 'gradeMockAttempt') {
      var mockLock=LockService.getScriptLock();
      if(!mockLock.tryLock(20000))return json({status:'error',message:'Busy; retry.'});
      try{return json(handleGradeMock_(data));}finally{mockLock.releaseLock();}
    }
    if (action === 'saveAttempt' || action === 'saveSpeakingAttempt' ||
        action === 'saveWritingAttempt' || action === 'saveReadingAttempt' ||
        action === 'saveListeningAttempt') {
      var lock=LockService.getScriptLock();
      if (!lock.tryLock(20000)) return json({status:'error',message:'Busy; retry this attempt.'});
      try {return json(handleSaveAttempt(data));} finally {lock.releaseLock();}
    }
    if (action === 'saveBadges') return json(handleSaveBadges_(data));
    if (action === 'profile_update' || action === 'updateProfile') return json(handleProfileUpdate(data));
    return json({ status:'error', message:'Unknown POST action: ' + action });
  } catch(err) {
    logSafe('ERROR', '', '', String(err));
    return json({ status:'error', message: String(err) });
  }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/***************************************************************
 * SETUP
 ***************************************************************/
function setupSheets() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  makeSheet(ss, SHEET.STUDENTS, [
    'Timestamp','Student Name','Email','Reg No',
    'Class / Group','Target Band','Registered On','Last Seen','Status'
  ]);

  makeSheet(ss, SHEET.ATTEMPTS, [
    'Timestamp','Student Name','Email','Reg No','Class / Group',
    'Vault ID','Component','Task Type','Raw Score','Total Items',
    'Score /90','Estimated Band','XP Earned','Feedback','Next Action',
    'Badge Earned','Status','Answer Text'
  ]);
  ensureColumns_(ss.getSheetByName(SHEET.ATTEMPTS), ['Attempt ID']);
  makeSheet(ss,'Mock_Results',['Attempt ID','Component','Correct','Total','Score /90','Answered','Answer Key JSON','Timestamp']);

  makeSheet(ss, SHEET.SPEAKING, [
    'Timestamp','Student Name','Email','Reg No','Vault ID',
    'Task Type','Topic ID','Topic Title','Prompt',
    'PREP Point','PREP Reason','PREP Example','PREP Close',
    'Transcript','Score /90','Band'
  ]);
  ensureColumns_(ss.getSheetByName(SHEET.SPEAKING), ['Attempt ID','Audio File ID','Audio Status']);
  ensureColumns_(ss.getSheetByName(SHEET.ATTEMPTS), ['Attempt ID']);

  makeSheet(ss, SHEET.READING, [
    'Timestamp','Student Name','Email','Reg No','Vault ID',
    'Raw Score','Total Questions','Score /90','Band',
    'Weak Question Types','XP Earned'
  ]);

  makeSheet(ss, SHEET.LISTENING, [
    'Timestamp','Student Name','Email','Reg No','Vault ID',
    'Raw Score','Total Questions','Score /90','Band',
    'Notes Taken','XP Earned'
  ]);

  makeSheet(ss, SHEET.WRITING, [
    'Timestamp','Student Name','Email','Reg No','Vault ID',
    'Task Type','Topic','Word Count','Score /90','Band',
    'Task Fulfilment','Organisation','Language','Vocabulary',
    'Answer Preview','XP Earned'
  ]);

  makeSheet(ss, SHEET.BADGES, [
    'Timestamp','Student Name','Email','Reg No','Badge','Source','Awarded'
  ]);
  ensureColumns_(ss.getSheetByName(SHEET.BADGES), ['Badge ID']);

  makeSheet(ss, SHEET.LOG, [
    'Timestamp','Action','Student Name','Email','Reg No','Details'
  ]);

  Logger.log('Smart MUET Guide sheets ready.');
}

function setupIfNeeded_() {
  if (!SPREADSHEET_ID || SPREADSHEET_ID.indexOf('PASTE_') === 0) {
    throw new Error('SPREADSHEET_ID not set. Run validateSetup() first.');
  }
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  if (!ss.getSheetByName(SHEET.STUDENTS)) setupSheets();
  ensureColumns_(ss.getSheetByName(SHEET.SPEAKING), ['Attempt ID','Audio File ID','Audio Status']);
  ensureColumns_(ss.getSheetByName(SHEET.BADGES), ['Badge ID']);
  ensureColumns_(ss.getSheetByName(SHEET.ATTEMPTS), ['Attempt ID']);
  if(!ss.getSheetByName('Mock_Results'))makeSheet(ss,'Mock_Results',['Attempt ID','Component','Correct','Total','Score /90','Answered','Answer Key JSON','Timestamp']);
}

function ensureColumns_(sh, names) {
  if (!sh) throw new Error('Required sheet is missing; run setupSheets().');
  var headers=sh.getRange(1,1,1,Math.max(1,sh.getLastColumn())).getValues()[0];
  names.forEach(function(name){if (headers.indexOf(name)<0){sh.getRange(1,headers.length+1).setValue(name);headers.push(name);}});
}

function makeSheet(ss, name, headers) {
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    var r = sh.getRange(1, 1, 1, headers.length);
    r.setBackground('#071B3D');
    r.setFontColor('#FFFFFF');
    r.setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

/***************************************************************
 * REGISTRATION
 ***************************************************************/
function handleRegister(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sh = ss.getSheetByName(SHEET.STUDENTS);
  var now = new Date();

  var name       = clean(data.studentName || data.name || '');
  var email      = clean(data.studentEmail || data.email || '').toLowerCase();
  var regNo      = clean(data.studentRegNo || data.regNo || '').toUpperCase();
  var classGroup = clean(data.classGroup || data.group || '');
  var targetBand = clean(data.targetBand || '4.0');
  var registered = clean(data.registeredAt || now.toISOString());

  if (!email && !regNo) return { status:'error', message:'Email or Reg No required.' };

  var row = findStudent_(sh, email, regNo);
  if (row > 0) {
    // Update existing
    setCell_(sh, row, 'Last Seen', now);
    setCell_(sh, row, 'Status', 'Active');
    if (name) setCell_(sh, row, 'Student Name', name);
    if (classGroup) setCell_(sh, row, 'Class / Group', classGroup);
    if (targetBand) setCell_(sh, row, 'Target Band', targetBand);
    logSafe('REGISTER_UPDATE', name, email, regNo);
    return { status:'ok', message:'Profile updated.', returning:true };
  }

  // New registration
  sh.appendRow([now, name, email, regNo, classGroup, targetBand, now, now, 'Registered']);
  logSafe('REGISTER_NEW', name, email, regNo);
  return { status:'ok', message:'Registration saved.', returning:false };
}

/***************************************************************
 * SAVE ATTEMPT
 ***************************************************************/
function handleSaveAttempt(data) {
  var ss  = SpreadsheetApp.openById(SPREADSHEET_ID);
  var now = new Date();
  var attemptId=clean(data.attemptId);
  if(attemptId && !/^[a-zA-Z0-9_-]{16,100}$/.test(attemptId))return {status:'error',message:'Invalid attempt ID.'};
  var attemptSheet=ss.getSheetByName(SHEET.ATTEMPTS);
  if(attemptId && findAttemptById_(attemptSheet,attemptId)) {
    if(clean(data.component).toLowerCase()==='speaking' && data.audioConsent===true && data.audioBase64) {
      var priorSpeaking=findSpeakingAttempt_(ss,data);
      if(priorSpeaking && !clean(ss.getSheetByName(SHEET.SPEAKING).getRange(priorSpeaking,18).getValue())) {
        try {var retryAudio=savePilotAudio_(ss,priorSpeaking,data);setCell_(ss.getSheetByName(SHEET.SPEAKING),priorSpeaking,'Audio File ID',retryAudio.getId());setCell_(ss.getSheetByName(SHEET.SPEAKING),priorSpeaking,'Audio Status','saved');} catch(e) {logSafe('AUDIO_ERROR','','',String(e));}
      }
    }
    return {status:'ok',message:'Existing attempt reused.'};
  }

  var name       = clean(data.studentName || '');
  var email      = clean(data.studentEmail || '').toLowerCase();
  var regNo      = clean(data.studentRegNo || '').toUpperCase();
  var classGroup = clean(data.classGroup || '');
  var vaultId    = clean(data.vaultId || 'VAULT-01');
  var component  = clean(data.component || '').toLowerCase();
  var taskType   = clean(data.taskType || '');
  var rawScore   = number_(data.rawScore, data.rubricRaw, data.correct, 0);
  var totalItems = number_(data.totalItems, data.rubricMax, data.totalQuestions, 90);
  var score90    = number_(data.score90, data.scaledScore);
  if (score90 === null) score90 = totalItems > 0 ? Math.round(rawScore / totalItems * 90) : 0;
  var band       = clean(data.estimatedBand || data.band || '');
  var xp         = Number(data.xpEarned || 0);
  var feedback   = clean(data.feedback || '');

  // Repeated sends from a weak mobile connection reuse the existing speaking row.
  if (component==='speaking' && data.attemptId) {
    var prior=findSpeakingAttempt_(ss,data);
    if (prior) {
      var priorSheet=ss.getSheetByName(SHEET.SPEAKING);
      var priorAudio=clean(priorSheet.getRange(prior,18).getValue());
      if (!priorAudio && data.audioConsent===true && data.audioBase64) {
        try {
          var retryFile=savePilotAudio_(ss,prior,data);
          setCell_(priorSheet,prior,'Audio File ID',retryFile.getId());
          setCell_(priorSheet,prior,'Audio Status','saved');
          priorAudio=retryFile.getId();
        } catch(retryError) {setCell_(priorSheet,prior,'Audio Status','error');logSafe('AUDIO_ERROR',name,email,String(retryError));}
      }
      return {status:'ok',message:'Existing speaking attempt reused.',audioStatus:priorAudio?'saved':'pending'};
    }
  }

  // Log to Attempts sheet
  var sh = ss.getSheetByName(SHEET.ATTEMPTS);
  sh.appendRow([now, name, email, regNo, classGroup, vaultId, component, taskType, rawScore, totalItems, score90, band, xp, feedback, '', '', clean(data.status), data.answerText || '', attemptId]);

  // Log to component-specific sheet if component is valid.
  var speakingRow=null, audioStatus='not_requested';
  if (component === 'speaking') speakingRow=appendSpeaking_(ss, now, data, score90, band);
  if (component === 'writing') appendWriting_(ss, now, data, score90, band);
  if (component === 'reading') appendObjective_(ss.getSheetByName(SHEET.READING), now, data, score90, band, 'reading');
  if (component === 'listening') appendObjective_(ss.getSheetByName(SHEET.LISTENING), now, data, score90, band, 'listening');

  if (speakingRow && data.audioConsent === true && data.audioBase64) {
    try {
      var audioFile=savePilotAudio_(ss, speakingRow, data);
      audioStatus='saved';
      setCell_(ss.getSheetByName(SHEET.SPEAKING), speakingRow, 'Audio File ID', audioFile.getId());
    } catch(audioError) {
      audioStatus='error';
      logSafe('AUDIO_ERROR',name,email,String(audioError));
    }
    setCell_(ss.getSheetByName(SHEET.SPEAKING), speakingRow, 'Audio Status', audioStatus);
  }

  logSafe('SAVE_ATTEMPT', name, email, component);
  return { status:'ok', message:'Attempt saved.', audioStatus:audioStatus };
}

/***************************************************************
 * HELPERS
 ***************************************************************/
function clean(str) {
  return String(str || '').trim();
}

function number_() {
  for (var i = 0; i < arguments.length; i++) {
    if (arguments[i] === null || arguments[i] === undefined || arguments[i] === '') continue;
    var n = Number(arguments[i]);
    if (isFinite(n)) return n;
  }
  return null;
}

function identity_(data) {
  return {
    name: clean(data.studentName || data.name || ''),
    email: clean(data.studentEmail || data.email || '').toLowerCase(),
    regNo: clean(data.studentRegNo || data.regNo || '').toUpperCase()
  };
}

function appendSpeaking_(ss, now, data, score90, band) {
  var sh = ss.getSheetByName(SHEET.SPEAKING), id = identity_(data), prep = data.prepNotes || {};
  sh.appendRow([now,id.name,id.email,id.regNo,clean(data.vaultId),clean(data.taskType),
    clean(data.topicId),clean(data.topicTitle),clean(data.prompt),clean(prep.point),
    clean(prep.reason),clean(prep.example),clean(prep.close || prep.discussionPlan),
    clean(data.transcript),score90,band,clean(data.attemptId),'',data.audioConsent===true?'pending':'not_requested']);
  return sh.getLastRow();
}

function appendWriting_(ss, now, data, score90, band) {
  var sh = ss.getSheetByName(SHEET.WRITING), id = identity_(data);
  sh.appendRow([now,id.name,id.email,id.regNo,clean(data.vaultId),
    clean(data.taskType || ('Task ' + (data.taskNumber || ''))),
    clean(data.topic || data.prompt || data.topicTitle),Number(data.wordCount || 0),score90,band,
    number_(data.taskFulfilment,0),number_(data.organisation,0),number_(data.language,0),
    number_(data.vocabulary,0),clean(data.answerText || data.answer || '').slice(0,500),
    Number(data.xpEarned || 0)]);
}

function appendObjective_(sh, now, data, score90, band, component) {
  var id = identity_(data);
  var extra = component === 'reading' ? clean(data.weakQuestionTypes) : clean(data.notesTaken);
  sh.appendRow([now,id.name,id.email,id.regNo,clean(data.vaultId),
    number_(data.rawScore,data.correct,0),number_(data.totalQuestions,data.totalItems,0),
    score90,band,extra,Number(data.xpEarned || 0)]);
}

function savePilotAudio_(ss,row,data) {
  var id=identity_(data), attemptId=clean(data.attemptId);
  if (!id.email && !id.regNo) throw new Error('Audio requires a learner identifier.');
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,40}$/i.test(attemptId)) throw new Error('Invalid attempt ID.');
  if (findStudent_(ss.getSheetByName(SHEET.STUDENTS),id.email,id.regNo)<2) throw new Error('Learner is not registered.');
  var mime=clean(data.audioMimeType).split(';')[0];
  var extensions={'audio/webm':'webm','audio/mp4':'m4a','audio/ogg':'ogg','audio/wav':'wav'};
  if (!extensions[mime]) throw new Error('Unsupported audio format.');
  var encoded=clean(data.audioBase64);
  if (!encoded || encoded.length>MAX_AUDIO_BASE64_LENGTH || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) throw new Error('Audio too large or invalid (maximum about 3 MB).');
  var bytes=Utilities.base64Decode(encoded);
  if (bytes.length>3000000) throw new Error('Audio too large.');
  var sh=ss.getSheetByName(SHEET.SPEAKING), existing=clean(sh.getRange(row,18).getValue());
  if (existing) return DriveApp.getFileById(existing);
  var folder=privateAudioFolder_();
  var fileName=clean(data.vaultId).replace(/[^a-z0-9-]/gi,'_')+'_'+clean(data.taskType).replace(/[^a-z0-9-]/gi,'_')+'_'+attemptId+'.'+extensions[mime];
  return folder.createFile(Utilities.newBlob(bytes,mime,fileName));
}

function privateAudioFolder_() {
  var props=PropertiesService.getScriptProperties(),folderId=props.getProperty(AUDIO_FOLDER_PROPERTY);
  var folder=folderId?DriveApp.getFolderById(folderId):DriveApp.createFolder('Smart MUET Pilot Speaking Audio - Private');
  if(folder.getSharingAccess()!==DriveApp.Access.PRIVATE)throw new Error('Audio folder is shared; set it to Restricted before continuing.');
  if(!folderId)props.setProperty(AUDIO_FOLDER_PROPERTY,folder.getId());
  return folder;
}

function findSpeakingAttempt_(ss,data) {
  var attemptId=clean(data.attemptId), id=identity_(data);
  if (!attemptId || (!id.email&&!id.regNo))return 0;
  var sh=ss.getSheetByName(SHEET.SPEAKING),end=sh.getLastRow();
  if (end<2)return 0;
  var rows=sh.getRange(2,1,end-1,sh.getLastColumn()).getValues();
  for(var i=rows.length-1;i>=0;i--){
    if(clean(rows[i][16])===attemptId && ((id.email&&clean(rows[i][2]).toLowerCase()===id.email)||(id.regNo&&clean(rows[i][3]).toUpperCase()===id.regNo)))return i+2;
  }
  return 0;
}

function audioStatusResponse_(params) {
  var callback=clean(params.callback);
  if (!/^[A-Za-z_$][0-9A-Za-z_$]{0,70}$/.test(callback)) return json({status:'error',message:'Invalid callback.'});
  var attemptId=clean(params.attemptId),stored=false, state='not_found';
  if (/^[a-zA-Z0-9_-]{16,100}$/.test(attemptId)) {
    var sh=SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET.SPEAKING);
    if (sh.getLastRow()>1) {
      var rows=sh.getRange(2,1,sh.getLastRow()-1,sh.getLastColumn()).getValues();
      for(var i=rows.length-1;i>=0;i--){
        if (clean(rows[i][16])===attemptId) {
          stored=!!clean(rows[i][17]); state=clean(rows[i][18])||'pending'; break;
        }
      }
    }
  }
  return ContentService.createTextOutput(callback+'('+JSON.stringify({status:'ok',stored:stored,audioStatus:state})+');').setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function findAttemptById_(sh,attemptId) {
  if(!attemptId || sh.getLastRow()<2)return false;
  var headers=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  var col=headers.indexOf('Attempt ID')+1;
  if(!col)return false;
  return !!sh.getRange(2,col,sh.getLastRow()-1,1).createTextFinder(attemptId).matchEntireCell(true).findNext();
}

// Only returns whether a random attempt ID exists. No student data is exposed.
function attemptStatusResponse_(params) {
  var callback=clean(params.callback);
  if(!/^[a-zA-Z_$][\w$]{0,80}$/.test(callback))return json({status:'error',message:'Invalid callback.'});
  var id=clean(params.attemptId);
  var stored=/^[a-zA-Z0-9_-]{16,100}$/.test(id) && findAttemptById_(SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET.ATTEMPTS),id);
  return ContentService.createTextOutput(callback+'('+JSON.stringify({status:'ok',stored:stored})+');').setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function handleGradeMock_(data) {
  var id=clean(data.attemptId),component=clean(data.component).toLowerCase();
  if(!/^[a-zA-Z0-9_-]{16,100}$/.test(id) || !MOCK_01_KEYS[component] || clean(data.vaultId)!=='MOCK-01')return {status:'error',message:'Invalid mock submission.'};
  var ss=SpreadsheetApp.openById(SPREADSHEET_ID),attempts=ss.getSheetByName(SHEET.ATTEMPTS),results=ss.getSheetByName('Mock_Results');
  if(results.getLastRow()>1 && results.getRange(2,1,results.getLastRow()-1,1).createTextFinder(id).matchEntireCell(true).findNext())return {status:'ok',message:'Existing mock result reused.'};
  var responses=data.responses||{},keys=MOCK_01_KEYS[component],correct=0,answered=0;
  Object.keys(keys).forEach(function(q){
    if(Object.prototype.hasOwnProperty.call(responses,q)){
      answered++;
      if(String(responses[q])===String(keys[q]))correct++;
    }
  });
  var total=Object.keys(keys).length,score90=Math.round(correct/total*90);
  data.rawScore=correct;data.totalItems=total;data.score90=score90;
  data.status=answered===total?'Complete':'Incomplete';
  data.answerText=JSON.stringify(responses);
  // The same attempt ID is used for safe retries, while the answer key is held on the server.
  var result=findAttemptById_(attempts,id)?{status:'ok'}:handleSaveAttempt(data);
  if(result.status==='ok')results.appendRow([id,component,correct,total,score90,answered,JSON.stringify(keys),new Date()]);
  return result;
}

function mockResultResponse_(params) {
  var callback=clean(params.callback),id=clean(params.attemptId);
  if(!/^[a-zA-Z_$][\w$]{0,80}$/.test(callback))return json({status:'error',message:'Invalid callback.'});
  var result={status:'pending'};
  if(/^[a-zA-Z0-9_-]{16,100}$/.test(id)){
    var sh=SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Mock_Results');
    if(sh && sh.getLastRow()>1){
      var rows=sh.getRange(2,1,sh.getLastRow()-1,7).getValues();
      for(var i=rows.length-1;i>=0;i--)if(clean(rows[i][0])===id){result={status:'ok',correct:rows[i][2],total:rows[i][3],score90:rows[i][4],answered:rows[i][5],answers:JSON.parse(rows[i][6])};break;}
    }
  }
  return ContentService.createTextOutput(callback+'('+JSON.stringify(result)+');').setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function handleSaveBadges_(data) {
  var id=identity_(data), items=data.badges;
  if ((!id.email && !id.regNo) || !Array.isArray(items)) return {status:'error',message:'Learner and badge list required.'};
  var ss=SpreadsheetApp.openById(SPREADSHEET_ID);
  if (findStudent_(ss.getSheetByName(SHEET.STUDENTS),id.email,id.regNo)<2)return {status:'error',message:'Learner is not registered.'};
  var eligible=eligibleBadgeIds_(ss,id);
  var lock=LockService.getScriptLock();lock.waitLock(20000);
  try {
    var sh=ss.getSheetByName(SHEET.BADGES),rows=sh.getLastRow()>1?sh.getRange(2,1,sh.getLastRow()-1,sh.getLastColumn()).getValues():[];
    var existing={};
    rows.forEach(function(row){if ((id.email && clean(row[2]).toLowerCase()===id.email)||(id.regNo && clean(row[3]).toUpperCase()===id.regNo))existing[clean(row[7])]=true;});
    var added=0;
    items.slice(0,8).forEach(function(badgeId){
      badgeId=clean(badgeId);
      if (!Object.prototype.hasOwnProperty.call(PILOT_BADGES,badgeId)||!eligible[badgeId]||existing[badgeId])return;
      sh.appendRow([new Date(),id.name,id.email,id.regNo,PILOT_BADGES[badgeId],'Progress dashboard','Yes',badgeId]);
      existing[badgeId]=true;added++;
    });
    return {status:'ok',added:added};
  }finally{lock.releaseLock();}
}

function eligibleBadgeIds_(ss,id) {
  var sh=ss.getSheetByName(SHEET.ATTEMPTS);
  var rows=sh.getLastRow()>1?sh.getRange(2,1,sh.getLastRow()-1,18).getValues():[];
  var mine=rows.filter(function(r){return (id.email&&clean(r[2]).toLowerCase()===id.email)||(id.regNo&&clean(r[3]).toUpperCase()===id.regNo);});
  var eligible={first:mine.length>0,prep:false,discussion:false,passage:false,audio:false,essay:false,vault:false,climber:false};
  var stages={};
  mine.forEach(function(r){
    var stage=clean(r[5]),component=clean(r[6]).toLowerCase(),task=clean(r[7]).toLowerCase();
    var completed=clean(r[16]).toLowerCase()==='complete';
    var points=Number(r[10]);
    if (!stages[stage])stages[stage]={};
    if(component==='speaking'){
      if(task==='task a'){eligible.prep=true;stages[stage].sa=points;}
      if(task==='task b'){eligible.discussion=true;stages[stage].sb=points;}
    }
    if(component==='writing'){
      if(task==='task 1')stages[stage].w1=points;
      if(task==='task 2'){eligible.essay=true;stages[stage].w2=points;}
    }
    if(component==='reading'&&completed){eligible.passage=true;stages[stage].reading=points;}
    if(component==='listening'&&completed){eligible.audio=true;stages[stage].listening=points;}
  });
  var totals=[];
  ['VAULT-01','VAULT-02','MOCK-01'].forEach(function(stage){
    var s=stages[stage]||{};
    if(['sa','sb','w1','w2','reading','listening'].every(function(k){return Number.isFinite(s[k]);})){
      eligible.vault=true;
      totals.push(s.reading+s.listening+(s.sa+s.sb)/2+s.w1+s.w2);
    }
  });
  eligible.climber=totals.length>=2 && totals.some(function(total,i){return i>0&&total>totals[i-1];});
  return eligible;
}

function findStudent_(sh, email, regNo) {
  if (sh.getLastRow() < 2) return -1;
  var data = sh.getRange(2, 1, sh.getLastRow() - 1, 4).getValues();
  for (var i = 0; i < data.length; i++) {
    if ((email && data[i][2] === email) || (regNo && data[i][3] === regNo)) {
      return i + 2;
    }
  }
  return -1;
}

function setCell_(sh, row, colName, value) {
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var col = headers.indexOf(colName) + 1;
  if (col > 0) sh.getRange(row, col).setValue(value);
}

function logSafe(action, name, email, detail) {
  try {
    var sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET.LOG);
    sh.appendRow([new Date(), action, name, email, '', detail]);
  } catch(e) {}
}

function handleStudentStatus(params) {
  return { status:'ok', message:'Method not yet implemented' };
}

function handleClassResults(params) {
  return { status:'ok', message:'Method not yet implemented' };
}

function handleProfileUpdate(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sh = ss.getSheetByName(SHEET.STUDENTS);
  var id = identity_(data), row = findStudent_(sh, id.email, id.regNo);
  if (row < 2) return { status:'error', message:'Student profile not found.' };
  if (id.name) setCell_(sh,row,'Student Name',id.name);
  if (data.classGroup || data.group) setCell_(sh,row,'Class / Group',clean(data.classGroup || data.group));
  if (data.targetBand) setCell_(sh,row,'Target Band',clean(data.targetBand));
  setCell_(sh,row,'Last Seen',new Date());
  setCell_(sh,row,'Status','Active');
  logSafe('PROFILE_UPDATE',id.name,id.email,id.regNo);
  return { status:'ok', message:'Profile updated.' };
}
// VAULT_01 SOURCES
const VAULT_01_SOURCES = {
  speaking: 'https://drive.google.com/file/d/1u7UsgSkAuuvyMAT9kmS58s0EgMFmo9SD/view?usp=drive_web',
  reading: 'https://drive.google.com/file/d/1aS7A1KZrR4yOKy69jBSnzDtcUy5Or4Be/view?usp=drive_web',
  listening: 'https://drive.google.com/file/d/1ha9t4hGx-CdCa0Ukxp9P9vDxBVqwZUXr/view?usp=drive_web',
  writing: 'https://drive.google.com/file/d/1_3_TabJ163jNgIu4ns6Xdd6Utwha4joo/view?usp=drive_web',
  audio_tracks: [
    'https://drive.google.com/file/d/1QQj-1FvvZUddWZwo8LeipWk55mPePYum/view?usp=drive_web', // Track 1
    'https://drive.google.com/file/d/112QBpHeyqud6f4UjBy_F_-HDJnWLmTYP/view?usp=drive_web', // Track 2
    'https://drive.google.com/file/d/1JVpMKOYpyvKUVy7-2gwcpUIpXfEHQC2K/view?usp=drive_web', // Track 3
    'https://drive.google.com/file/d/16hCkjfiQSaVwvTyC-1kx7GV1liFq013h/view?usp=drive_web', // Track 4
    'https://drive.google.com/file/d/1-LEHYtc22LskHNUe32tC7bqio6jLS6F6/view?usp=drive_web', // Track 5
    'https://drive.google.com/file/d/1tgXGA_NX-UuQe-MdCZFQb2zPN0QKs2LV/view?usp=drive_web', // Track 6
    'https://drive.google.com/file/d/1iFzDIUACYJMhhzZsX45RERBKvSNmFBk-/view?usp=drive_web', // Track 7
    'https://drive.google.com/file/d/1AZRh_FI-yGae-MI-o1MR-kw02RvHeqhu/view?usp=drive_web', // Track 8
    'https://drive.google.com/file/d/1MD-FtTZuYOS1czO_AP_oK2sUZXNQOyiA/view?usp=drive_web'  // Track 9
  ],
  speakingImage: 'https://drive.google.com/file/d/1co-ZnvmAbI82klw0KtHos5w4VCTKaE9Q/view?usp=drive_web'
};

// Function to get Vault 01 source
function getVault01Source(component) {
  if (VAULT_01_SOURCES[component]) {
    return VAULT_01_SOURCES[component];
  }
  return null;
}

// Function to get audio track
function getVault01AudioTrack(trackNumber) {
  if (trackNumber >= 1 && trackNumber <= 9) {
    return VAULT_01_SOURCES.audio_tracks[trackNumber - 1];
  }
  return null;
}
function testVault01() {
  var results = [];
  var sources = VAULT_01_SOURCES;
  
  // Test main papers
  var paperTests = ['speaking', 'reading', 'listening', 'writing'];
  paperTests.forEach(paper => {
    var url = sources[paper];
    var response = UrlFetchApp.fetch(url, {muteHttpExceptions: true});
    results.push({
      component: paper,
      url: url,
      status: response.getResponseCode(),
      accessible: response.getResponseCode() === 200
    });
  });
  
  // Test audio tracks
  sources.audio_tracks.forEach((url, idx) => {
    var response = UrlFetchApp.fetch(url, {muteHttpExceptions: true});
    results.push({
      component: 'audio_' + (idx + 1),
      url: url,
      status: response.getResponseCode(),
      accessible: response.getResponseCode() === 200
    });
  });
  
  // Log results
  Logger.log(JSON.stringify(results, null, 2));
  return results;
}
// VAULT_02 SOURCES
const VAULT_02_SOURCES = {
  speaking: 'https://drive.google.com/file/d/1ba2qCEzLHgxAol6zjVdAdtGvPJcNOcxB/view?usp=drive_web',
  reading: 'https://drive.google.com/file/d/1XN80eak2RaTEg0JT7MKos5LZh3of8Ivc/view?usp=drive_web',
  listening: 'https://drive.google.com/file/d/1duyTtYN40FyIeyyqKn7UbDiTiFKZrPGU/view?usp=drive_web',
  writing: 'https://drive.google.com/file/d/15ObEv7FXIYMRT8pKB4etZ3A2AAOiNGFw/view?usp=drive_web',
  audio_tracks: [
    'https://drive.google.com/file/d/1ypmTJocFPctxWYW16KduMMW_YY7eBC-s/view?usp=drive_web', // Track 1
    'https://drive.google.com/file/d/1Lx8k4w1ek-JfyC7X6FrwrBdyWgD3CsWA/view?usp=drive_web', // Track 2
    'https://drive.google.com/file/d/1wALDt7CdS_bfqnTk6eQk0dt33y9GoU8U/view?usp=drive_web', // Track 3
    'https://drive.google.com/file/d/1tG3ti9PuYkcLNR-PtTrSj7TD_mqX2_FK/view?usp=drive_web', // Track 4
    'https://drive.google.com/file/d/1ds38TIXvKdhG9gbB58XCWor8VAwIWTjl/view?usp=drive_web', // Track 5
    'https://drive.google.com/file/d/1u5h6rrZLfTbj6-cHuvM1773AHfGQ6NbH/view?usp=drive_web', // Track 6
    'https://drive.google.com/file/d/113O1yZbyjzVa5FqWkxEXFqVPo65c3AZW/view?usp=drive_web'  // Track 7
  ]
};

// Function to get Vault 02 source
function getVault02Source(component) {
  if (VAULT_02_SOURCES[component]) {
    return VAULT_02_SOURCES[component];
  }
  return null;
}

// Function to get audio track
function getVault02AudioTrack(trackNumber) {
  if (trackNumber >= 1 && trackNumber <= 7) {
    return VAULT_02_SOURCES.audio_tracks[trackNumber - 1];
  }
  return null;
}
// VAULT_03 SOURCES
const VAULT_03_SOURCES = {
  speaking: 'https://drive.google.com/file/d/1gAV1Ym0xy9fAkkmDurbP3gSOGG5jqYO1/view?usp=drive_web',
  reading: 'https://drive.google.com/file/d/1xUCzPWx6BDeMjQ11crZd7XCg35a7C2Fr/view?usp=drive_web',
  readingAnswerKey: 'https://drive.google.com/file/d/18xwcMbrMHHjZ5OuOesnBBFA0cSzDtYtl/view?usp=drive_web',
  listening: 'https://drive.google.com/file/d/15BxfbXKpEb6PjthP4fWPWHXIXGidfUCs/view?usp=drive_web',
  writing: 'https://drive.google.com/file/d/1jFVOdxPaiNsbC1JTRfXfITWVK_jqwHUB/view?usp=drive_web',
  audio_tracks: [
    'https://drive.google.com/file/d/1c80My3EfidSRMh0xzXFJT9btUPHNAYfy/view?usp=drive_web', // Track 1
    'https://drive.google.com/file/d/19ktftS7dz8jHJ76NWKhsJw4E8sUdpfbQ/view?usp=drive_web', // Track 2
    'https://drive.google.com/file/d/1qyVtb4DpNkEdwVMutQ5CDFLhtXfhK_2B/view?usp=drive_web', // Track 3
    'https://drive.google.com/file/d/1xSspI7oSrsJIzPttmIJNelgoeSmkH93n/view?usp=drive_web', // Track 4
    'https://drive.google.com/file/d/1M8CPT9dIHfIUZEd2k0JaRjdc8Jt_v5V-/view?usp=drive_web', // Track 5
    'https://drive.google.com/file/d/1-QZqrbxGpY8PEzMhZq7dc1xDNMYxKDXi/view?usp=drive_web', // Track 6
    'https://drive.google.com/file/d/1Py-jxoraubTE5ByarOxw0EhtqctGNZHO/view?usp=drive_web'  // Track 7
  ]
};

// Function to get Vault 03 source
function getVault03Source(component) {
  if (VAULT_03_SOURCES[component]) {
    return VAULT_03_SOURCES[component];
  }
  return null;
}

// Function to get audio track
function getVault03AudioTrack(trackNumber) {
  if (trackNumber >= 1 && trackNumber <= 7) {
    return VAULT_03_SOURCES.audio_tracks[trackNumber - 1];
  }
  return null;
}
function testVault03() {
  var results = [];
  var sources = VAULT_03_SOURCES;
  
  // Test main papers
  var paperTests = ['speaking', 'reading', 'readingAnswerKey', 'listening', 'writing'];
  paperTests.forEach(paper => {
    var url = sources[paper];
    var response = UrlFetchApp.fetch(url, {muteHttpExceptions: true});
    results.push({
      component: paper,
      url: url,
      status: response.getResponseCode(),
      accessible: response.getResponseCode() === 200
    });
  });
  
  // Test audio tracks
  sources.audio_tracks.forEach((url, idx) => {
    var response = UrlFetchApp.fetch(url, {muteHttpExceptions: true});
    results.push({
      component: 'audio_' + (idx + 1),
      url: url,
      status: response.getResponseCode(),
      accessible: response.getResponseCode() === 200
    });
  });
  
  // Log results
  Logger.log(JSON.stringify(results, null, 2));
  return results;
}

// Keep this key table only in the private Apps Script project. Never upload Code.gs to GitHub.
var MOCK_01_KEYS = {"reading":{"1":"B","2":"A","3":"C","4":"A","5":"A","6":"B","7":"C","8":"C","9":"B","10":"C","11":"B","12":"B","13":"A","14":"B","15":"B","16":"A","17":"A","18":"C","19":"C","20":"A","21":"B","22":"G","23":"E","24":"D","25":"A","26":"C","27":"D","28":"A","29":"B","30":"C","31":"A","32":"B","33":"C","34":"D","35":"C","36":"C","37":"C","38":"B","39":"C","40":"A"},"listening":{"0":0,"1":2,"2":2,"3":1,"4":0,"5":0,"6":1,"7":1,"8":1,"9":2,"10":0,"11":2,"12":1,"13":2,"14":4,"15":2,"16":1,"17":0,"18":1,"19":0,"20":1,"21":2,"22":1,"23":0,"24":1,"25":1,"26":2,"27":1,"28":0,"29":0}};
