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
      const timer=setTimeout(()=>finish(null),9000);
      document.head.append(script);
    });
  }
  async function pollResult(id){
    for(let i=0;i<4;i++){
      const result=await resultReceipt(id);
      if(result?.status==='ok')return result;
      if(i<3)await new Promise(resolve=>setTimeout(resolve,1400));
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
    const sent=await window.saveSmartMuetAttempt(payload,'gradeMockAttempt');
    const result=sent.confirmed?await pollResult(id):null;
    if(!result){
      box.innerHTML='Scoring is pending. Your attempt is queued on this device. Reopen this page online to retry, then ask your lecturer to confirm the result if it remains pending.';
      localStorage.setItem('muet_mock1_pending_'+component.toLowerCase(),id);
      localStorage.setItem('muet_mock1_pending_responses_'+id,JSON.stringify(responses));
      return;
    }
    localStorage.removeItem('muet_mock1_pending_'+component.toLowerCase());
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
  async function resume(config){
    const id=localStorage.getItem('muet_mock1_pending_'+config.component.toLowerCase());
    if(!id)return;
    const saved=JSON.parse(localStorage.getItem('muet_mock1_pending_responses_'+id)||'{}');
    config.box.classList.add('show');config.box.textContent='Checking your pending Mock result…';
    const result=await pollResult(id);
    if(result){finalize(config,result,saved);localStorage.removeItem('muet_mock1_pending_'+config.component.toLowerCase());localStorage.removeItem('muet_mock1_pending_responses_'+id);}
    else config.box.textContent='This Mock attempt is still pending. Keep this browser data and reconnect to the internet; then reopen this page.';
  }
  window.SmartMUETRemoteMock={submit,resume};
})();
