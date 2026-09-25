/* Keeps component journeys and completion messages consistent across vaults and mock. */
(()=>{'use strict';
 const match=location.pathname.match(/(?:^|\/)(vault1|vault2|mock1)-(listening|speaking|reading|writing)\.html$/i);
 if(!match)return;
 const [,stage,component]=match.map(v=>v.toLowerCase());
 const stages={vault1:'Vault 1',vault2:'Vault 2',mock1:'Mock 1'};
 const order=['listening','speaking','reading','writing'];
 const at=order.indexOf(component);
 const previous=at?`${stage}-${order[at-1]}.html`:`${stage}.html`;
 const next=at<3?`${stage}-${order[at+1]}.html`:stage==='vault1'?'vault2.html':stage==='vault2'?'mock1.html':'progress.html';
 const nextLabel=at<3?order[at+1][0].toUpperCase()+order[at+1].slice(1):stage==='vault1'?'Vault 2':stage==='vault2'?'Mock practice':'Progress';
 const previousLabel=at?order[at-1][0].toUpperCase()+order[at-1].slice(1):stages[stage]+' overview';
 const topLink=document.querySelector('.top a.back');
 if(topLink){topLink.href=next;topLink.textContent=`Next: ${nextLabel} →`;topLink.classList.add('practice-next');topLink.setAttribute('aria-label',`Next practice page: ${nextLabel}`)}
 const hero=document.querySelector('.hero');
 if(hero){
   if(!hero.querySelector('.component-hero-image')){
     const image=document.createElement('img');image.className='component-hero-image';
     image.src=`assets/heroes/muet-${component}-hero-v2.webp`;image.alt=`${component} practice illustration`;
     image.width=1200;image.height=675;image.decoding='async';hero.append(image);
   }
   if(!hero.querySelector('.component-hero-copy')){
     const copy=document.createElement('div');copy.className='component-hero-copy';
     [...hero.children].filter(child=>!child.classList.contains('component-hero-image')).forEach(child=>copy.append(child));
     hero.prepend(copy);
   }
 }
 const bottom=document.querySelector('main')||document.querySelector('.app');
 if(bottom){
   const nav=document.createElement('nav');nav.className='practice-route';nav.setAttribute('aria-label','Practice page navigation');
   const back=document.createElement('a');back.href=previous;back.textContent=`← ${previousLabel}`;
   const forward=document.createElement('a');forward.href=next;forward.className='next';forward.textContent=`Next: ${nextLabel} →`;
   nav.append(back,forward);bottom.append(nav);
 }
 const targets={vault1:{listening:'summaryResult',speaking:'finishResult',reading:'summaryResult',writing:'finishResult'},vault2:{listening:'summary',speaking:'finishResult',reading:'summary',writing:'finishResult'},mock1:{listening:'result',speaking:'report',reading:'result',writing:'finalResult'}};
 const box=document.getElementById(targets[stage][component]);if(!box)return;
 let shown=false;
 const badges={listening:['🎧','Audio Focus'],speaking:['💬','Discussion Builder'],reading:['🔎','Passage Hunter'],writing:['✍️','Essay Builder']};
 function check(){
   if(shown||!box.textContent.trim()||!box.classList.contains('show'))return;
   const complete=localStorage.getItem(`muet_${stage==='mock1'?'mock1':stage==='vault1'?'v1':'v2'}_${component}`)==='true';
   const pending=/pending|still pending|queued|submit both|submit all|first\.|incomplete/i.test(box.textContent);
   if(pending||!complete)return;
   shown=true;
   const name=badges[component],panel=document.createElement('div');panel.className='component-celebration';
   const icon=document.createElement('span');icon.className='badge-icon';icon.setAttribute('aria-hidden','true');icon.textContent=name[0];
   const copy=document.createElement('div');const heading=document.createElement('strong');heading.textContent=`${stages[stage]} ${component}: complete`;
   const detail=document.createElement('p');detail.append('Badge unlocked: '+name[1]+'. Check your results and decide what to practise next. ');
   const link=document.createElement('a');link.href='progress.html';link.textContent='View badges';detail.append(link);
   copy.append(heading,detail);panel.append(icon,copy);box.append(panel);
   if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
     for(let i=0;i<10;i++){const bit=document.createElement('i');bit.className='component-confetti';bit.setAttribute('aria-hidden','true');bit.style.setProperty('--x',`${8+i*9}%`);bit.style.setProperty('--dx',`${(i%2?1:-1)*(9+i*2)}px`);bit.style.setProperty('--d',`${i*.035}s`);bit.style.setProperty('--c',['#f43a4c','#ffd226','#35c2c1','#2460e7'][i%4]);panel.append(bit)}
     setTimeout(()=>panel.querySelectorAll('.component-confetti').forEach(el=>el.remove()),1600);
   }
 }
 new MutationObserver(check).observe(box,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class']});
 check();
})();
