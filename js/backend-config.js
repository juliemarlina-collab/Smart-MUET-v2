/**
 * Smart MUET Guide — backend-config.js v2.0
 * ELU · POLIPD · Jules Marlina binti Hasan
 *
 * HOW TO ACTIVATE:
 * 1. Open muet-appscript.gs in Google Apps Script
 * 2. Paste your Sheet ID, run setupSheets(), run testFullFlow()
 * 3. Deploy as Web App (Execute as: Me, Anyone access)
 * 4. Paste the deployed URL below
 * 5. Set SMART_MUET_BACKEND_ENABLED = true
 */

const SMART_MUET_BACKEND_ENABLED = true;
const SMART_MUET_BACKEND_URL     = 'https://script.google.com/macros/s/AKfycbxykw1lbRGwtBAg18s6MY04E3CQ3U9lIwRLJrCFQI1FoJosY4bpWTdaP7-Wca4cqtGmzA/exec';

// ── Primary save function (called after every attempt) ────────────────
async function saveSmartMuetAttempt(payload) {
  _saveAttemptLocally(payload);  // Always save locally first

  if (!SMART_MUET_BACKEND_ENABLED) return { ok:false, localOnly:true };
  if (!SMART_MUET_BACKEND_URL || SMART_MUET_BACKEND_URL.includes('PASTE_')) {
    return { ok:false, localOnly:true, note:'Backend URL not configured' };
  }

  try {
    // Use no-cors for Apps Script — we cannot read the response
    // Verify data arrived by checking your Google Sheet directly
    await fetch(SMART_MUET_BACKEND_URL, {
      method:  'POST',
      mode:    'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body:    JSON.stringify({ action: 'saveAttempt', ...payload })
    });
    return { ok:true, sent:true, note:'no-cors mode — verify in Google Sheet' };
  } catch(err) {
    return { ok:false, error: String(err) };
  }
}

// ── Registration send ─────────────────────────────────────────────────
async function sendRegistration(profile) {
  if (!SMART_MUET_BACKEND_ENABLED || !SMART_MUET_BACKEND_URL || SMART_MUET_BACKEND_URL.includes('PASTE_')) return;
  try {
    await fetch(SMART_MUET_BACKEND_URL, {
      method: 'POST', mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action:       'register',
        studentName:  profile.name,
        studentEmail: profile.email,
        studentRegNo: profile.regNo,
        classGroup:   profile.group,
        targetBand:   profile.targetBand,
        registeredAt: profile.createdAt
      })
    });
  } catch(_) {}
}

// ── Local attempt log (always runs, keeps last 200) ───────────────────
function _saveAttemptLocally(payload) {
  try {
    const key = 'muet_attempt_log';
    const log = JSON.parse(localStorage.getItem(key) || '[]');
    log.push({ ...payload, _savedAt: new Date().toISOString() });
    if (log.length > 200) log.splice(0, log.length - 200);
    localStorage.setItem(key, JSON.stringify(log));
  } catch(_) {}
}
