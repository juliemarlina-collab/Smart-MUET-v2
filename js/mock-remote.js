(function(){
  'use strict';
  function resultReceipt(id){
    return new Promise(resolve=>{
      const callback='muetMockResult'+Math.random().toString(36).slice(2);
      const script=document.createElement('script');let done=false;
      const finish=value=>{if(done)return;done=true;clearTimeout(timer);delete window[callback];script.remove();resolve(value)};
      window[callback]=finish;
      script.src=window.SMART_MUET_BACKEND_URL+'?'+new URLSearchParams({action:'mock_result',attemptId:id,callback});
      script.onerror=()=>finish(null);
      const timer=setTimeout(()=>finish(null),5000);
      document.head.append(script);
    });
  }
  async function pollResult(id){
    for(let i=0;i<4;i++){
      const result=await resultReceipt(id);
      if(result?.status==='ok')return result;
      if(i<3)await new Promise(resolve=>setTimeout(resolve,1500*(i+1)));
    }
    return null;
  }
  async function submit({component,total,base,box,timeRemaining}){
    const profile=JSON.parse(localStorage.getItem('muet_profile')||'{}');
    const id=crypto.randomUUID(),responses={};
    for(let i=0;i<total;i++){
      const q=base+i,selected=document.querySelector(`input[name="q${q}"]:checked`);
      if(selected)responses[q]=selected.value;
      document.querySelectorAll(`input[name="q${q}"]`).forEach(input=>input.disabled=true);
    }
    box.classList.add('show');box.textContent='Submitting for scoring… Your responses remain on this device if delivery fails.';
    const payload={attemptId:id,vaultId:'MOCK-01',component,studentName:profile.name||'',studentEmail:profile.email||'',studentRegNo:profile.regNo||'',classGroup:profile.group||'',responses,answerText:JSON.stringify(responses),taskType:'Mock 1',timeRemaining};
    await window.saveSmartMuetAttempt(payload,'gradeMockAttempt');
    // The Mock result may already be stored while the generic Attempts receipt
    // is still unavailable. The result receipt is the authority for scoring.
    const result=await pollResult(id);
    if(!result){
      localStorage.setItem('muet_mock1_pending_'+component.toLowerCase(),id);
      localStorage.setItem('muet_mock1_pending_responses_'+id,JSON.stringify(responses));
      showPending({component,total,base,box,timeRemaining});
      return;
    }
    localStorage.removeItem('muet_mock1_pending_'+component.toLowerCase());
    window.clearPendingSmartMuetAttempt?.(id);
    finalize({component,total,base,box,timeRemaining},result,responses);
  }
  function finalize({component,total,base,box,timeRemaining},result,responses){
    const score90=Number(result.score90),correct=Number(result.correct),answered=Number(result.answered),complete=answered===total;
    box.innerHTML=`<div class="big">${correct}/${total}</div><div><b>${score90}/90 estimated ${component} practice score</b></div><div>${answered} questions answered · Time remaining: ${timeRemaining}</div><p>Correct options are shown in green.</p>`;
    for(let i=0;i<total;i++){
      const q=base+i,right=String(result.answers[q]);
      document.querySelectorAll(`input[name="q${q}"]`).forEach(input=>{
        const label=input.closest('label');
        if(input.value===right)label?.classList.add('correct');
        else if(input.checked)label?.classList.add('wrong');
      });
    }
    const prefix='muet_mock1_'+component.toLowerCase();
    const record={responses,correct,answered,totalItems:total,score90,complete,status:complete?'Complete':'Incomplete',stageKey:'mock1',vaultId:'MOCK-01',component,savedAt:new Date().toISOString(),timeRemaining};
    localStorage.setItem(prefix+'_responses',JSON.stringify(responses));
    localStorage.setItem(prefix+'_score',String(correct));
    localStorage.setItem(prefix+'_score90',String(score90));
    localStorage.setItem(prefix+'_result',JSON.stringify(record));
    if(complete)localStorage.setItem(prefix,'true');else localStorage.removeItem(prefix);
  }
  function showPending(config){
    config.box.replaceChildren();
    const message=document.createElement('p');
    message.textContent='Your responses are saved on this device. Scoring is awaiting a database receipt. Keep this browser data and reconnect if needed.';
    const retry=document.createElement('button');retry.type='button';retry.textContent='CHECK RESULT AGAIN';
    retry.style.cssText='min-height:44px;padding:10px 15px;border:2px solid #111;border-radius:10px;background:#ffdb49;color:#111;font-weight:800;cursor:pointer';
    retry.addEventListener('click',()=>resume(config));
    config.box.append(message,retry);
  }
  async function resume(config){
    const id=localStorage.getItem('muet_mock1_pending_'+config.component.toLowerCase());
    if(!id)return;
    const saved=JSON.parse(localStorage.getItem('muet_mock1_pending_responses_'+id)||'{}');
    config.box.classList.add('show');config.box.textContent='Checking your pending Mock result…';
    const result=await pollResult(id);
    if(result){finalize(config,result,saved);localStorage.removeItem('muet_mock1_pending_'+config.component.toLowerCase());localStorage.removeItem('muet_mock1_pending_responses_'+id);window.clearPendingSmartMuetAttempt?.(id);}
    else showPending(config);
  }
  window.SmartMUETRemoteMock={submit,resume};
})();
