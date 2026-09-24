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
const SMART_MUET_BACKEND_URL     = 'https://script.google.com/macros/s/AKfycbziPu490skQA8JNPIMvTPJkdIYHqEK8esT32bjaJcFmmsSFcU7rAKW5wpLR7xe96xGg/exec';

// Expose configuration to page-level scripts that use the window namespace.
window.SMART_MUET_BACKEND_ENABLED = SMART_MUET_BACKEND_ENABLED;
window.SMART_MUET_BACKEND_URL = SMART_MUET_BACKEND_URL;

// ── Primary save function (called after every attempt) ────────────────
async function saveSmartMuetAttempt(payload, action = 'saveAttempt') {
  _saveAttemptLocally(payload);  // Always save locally first
  const audioTooLarge=!!payload.audioConsent && (payload.audioBase64||'').length>4000000;
  const outgoing=audioTooLarge?{...payload,audioBase64:''}:payload;

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
      body:    JSON.stringify({ ...outgoing, action })
    });
    const receipt=outgoing.audioConsent && outgoing.audioBase64 && outgoing.attemptId
      ? await confirmSmartMuetAudio(payload)
      : null;
    return { ok:true, sent:true, audioTooLarge, audioConfirmed:receipt?.stored===true, audioStatus:receipt?.audioStatus||'unconfirmed', note:'Attempt sent; verify component sheet.' };
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

window.saveSmartMuetAttempt = saveSmartMuetAttempt;
window.sendRegistration = sendRegistration;

// Read-only, anonymous receipt: returns audio status only for this attempt and learner.
function confirmSmartMuetAudio(payload) {
  return new Promise(resolve=>{
    const callback='muetAudioReceipt'+Math.random().toString(36).slice(2);
    const script=document.createElement('script');
    let finished=false;
    const finish=result=>{if(finished)return;finished=true;clearTimeout(timer);delete window[callback];script.remove();resolve(result)};
    window[callback]=result=>finish(result);
    const query=new URLSearchParams({action:'audio_status',attemptId:payload.attemptId,
      studentRegNo:payload.studentRegNo||'',studentEmail:payload.studentEmail||'',callback});
    script.src=SMART_MUET_BACKEND_URL+'?'+query;
    script.onerror=()=>finish(null);
    const timer=setTimeout(()=>finish(null),9000);
    document.head.append(script);
  });
}
window.confirmSmartMuetAudio=confirmSmartMuetAudio;

async function saveSmartMuetBadges(profile,badgeIds) {
  if(!profile || (!profile.regNo&&!profile.email) || !badgeIds.length)return {sent:false};
  if(!SMART_MUET_BACKEND_ENABLED || !SMART_MUET_BACKEND_URL)return {sent:false};
  try {
    await fetch(SMART_MUET_BACKEND_URL,{method:'POST',mode:'no-cors',
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body:JSON.stringify({action:'saveBadges',studentName:profile.name||'',studentEmail:profile.email||'',studentRegNo:profile.regNo||'',badges:badgeIds})});
    return {sent:true};
  } catch(e){return {sent:false};}
}
window.saveSmartMuetBadges=saveSmartMuetBadges;

if(document.body && /page-(?:v1|v2|mock1)-speaking/.test(document.body.className)){
  const panel=document.createElement('label');
  panel.style.cssText='display:flex;align-items:flex-start;gap:10px;margin:12px 0;padding:12px;border:2px solid #111;border-radius:12px;background:#fff;line-height:1.45;font-size:14px;color:#111';
  panel.innerHTML='<input type="checkbox" id="smartMuetAudioConsent" style="width:20px;height:20px;flex:none;margin-top:2px"><span>I consent to storing my Speaking recording in a private Drive folder for this pilot. If unchecked, only my transcript and practice result are sent.</span>';
  const hero=document.querySelector('.hero');
  if(hero)hero.insertAdjacentElement('afterend',panel);
  document.querySelectorAll('.rec audio').forEach((player,index)=>{
    const backup=document.createElement('a');
    backup.href='#';
    backup.textContent='Download backup recording';
    backup.style.cssText='display:inline-block;margin:8px 0;font-size:13px;font-weight:700;text-decoration:underline;color:#07579b';
    backup.addEventListener('click',event=>{
      if(!player.src.startsWith('blob:')){event.preventDefault();alert('Record and stop this task first.');return;}
      backup.href=player.src;
      backup.download='Smart-MUET-speaking-task-'+(index===0?'A':'B')+(player.src.includes('mp4')?'.m4a':'.webm');
    });
    player.insertAdjacentElement('afterend',backup);
  });
}
window.smartMuetAudioConsent=()=>document.getElementById('smartMuetAudioConsent')?.checked===true;

// ── Local attempt log (always runs, keeps last 200) ───────────────────
function _saveAttemptLocally(payload) {
  try {
    const key = 'muet_attempt_log';
    const log = JSON.parse(localStorage.getItem(key) || '[]');
    const {audioBase64, ...withoutAudio}=payload;
    log.push({ ...withoutAudio, _savedAt: new Date().toISOString() });
    if (log.length > 200) log.splice(0, log.length - 200);
    localStorage.setItem(key, JSON.stringify(log));
  } catch(_) {}
}
