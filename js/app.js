const STORAGE_KEY='weatherQuestGrade6_v2';
const S={player:'',round:[],i:0,score:0,hearts:3,hinted:false,answered:false,log:[],sound:true};
const $=id=>document.getElementById(id);
const screens=['startScreen','gameScreen','resultScreen'];
const TYPE_LABEL={single:'單選',multi:'複選',order:'拖曳排序'};

function show(id){screens.forEach(x=>$(x).classList.toggle('active',x===id));scrollTo({top:0,behavior:'smooth'})}
function shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function newRoundIds(){return shuffle(QUESTION_BANK).slice(0,10).map(q=>q.id)}
function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(S))}
function load(){try{const x=JSON.parse(localStorage.getItem(STORAGE_KEY));if(!x?.round?.length)return false;Object.assign(S,x);return true}catch{return false}}
function currentQ(){return QUESTION_BANK.find(x=>x.id===S.round[S.i])}
function beep(ok){if(!S.sound)return;try{const C=window.AudioContext||window.webkitAudioContext;const c=new C(),o=c.createOscillator(),g=c.createGain();o.type='square';o.frequency.value=ok?660:180;g.gain.value=.03;o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+.08)}catch{}}
function startNew(){S.player=$('playerName').value.trim()||'氣象冒險者';S.round=newRoundIds();S.i=0;S.score=0;S.hearts=3;S.hinted=false;S.answered=false;S.log=[];save();show('gameScreen');render()}

function visualFor(x){
  if(['WX012'].includes(x.id))return `<div class="visual-title">水循環示意（自製）</div><div class="water-cycle"><div class="cell">🌊 地表水<br>蒸發／蒸散</div><div class="arrow">→</div><div class="cell">☁️ 雲<br>凝結／凝華</div><div class="arrow">→</div><div class="cell">🌧️ 降水</div><div class="arrow">→</div><div class="cell">🏞️ 匯集／滲入</div></div>`;
  if(['WX016','WX017','WX018','WX019','WX020','WX038','WX039'].includes(x.id))return `<div class="visual-title">簡化地面天氣圖（自製示意）</div><div class="pressure-map"><div class="iso i1"></div><div class="iso i2"></div><div class="iso i3"></div><span class="map-label h">H</span><div class="iso r1"></div><div class="iso r2"></div><span class="map-label l">L</span></div>`;
  if(['WX025','WX026','WX027','WX028','WX029','WX030'].includes(x.id))return `<div class="visual-title">冷暖氣團交界示意</div><div class="front-diagram"><div class="airmass cold">❄️ 冷氣團<br><small>溫度較低</small></div><div class="front-symbol">◀▲●▶</div><div class="airmass warm">☀️ 暖氣團<br><small>溫度較高</small></div></div>`;
  if(['WX032','WX033','WX034','WX035','WX036','WX037','WX038','WX039','WX040','WX041','WX042','WX043','WX044','WX045'].includes(x.id))return `<div class="visual-title">颱風任務資料台</div><div class="typhoon-card"><div><div class="typhoon-spiral">🌀</div></div><div><b>觀測關鍵</b><br>低氣壓中心<br>密集等壓線<br>濃密雲系<br>強風、豪雨與防災決策</div></div>`;
  if(['WX046','WX047','WX048','WX049','WX050'].includes(x.id))return `<div class="visual-title">衛星資料傳遞示意</div><div class="satellite-viz"><div class="sat">🛰️</div><div class="beam">⇣⇣⇣</div><div class="earth">🌏</div></div>`;
  return '';
}

function render(){
  const x=currentQ();S.hinted=false;S.answered=false;
  $('hudPlayer').textContent=S.player;$('hudHearts').textContent='♥'.repeat(S.hearts)+'♡'.repeat(3-S.hearts);$('hudXp').textContent=String(S.score).padStart(3,'0');$('hudProgress').textContent=`${S.i+1} / 10`;
  $('zoneTag').textContent=x.zone;$('skillTag').textContent=x.skill;$('typeTag').textContent=TYPE_LABEL[x.type]||x.type;$('questionId').textContent=x.id;$('topic').textContent=x.topic+'｜閱讀任務';$('passage').textContent=x.passage;$('question').textContent=x.question;
  const visual=visualFor(x);$('visualStage').hidden=!visual;$('visualStage').innerHTML=visual;
  $('hintBox').hidden=true;$('feedbackBox').hidden=true;$('nextBtn').hidden=true;$('hintBtn').disabled=false;$('submitBtn').disabled=false;
  $('bossPanel').hidden=S.i!==9;$('bossHp').style.width='100%';
  if(x.type==='order') renderOrder(x); else renderChoice(x);
  $('route').innerHTML=S.round.map((_,i)=>`<div class="route-node ${i<S.i?'done':i===S.i?'current':''} ${i===9?'boss':''}">${i<S.i?'✓':i===9?'⚔':i+1}</div>`).join('');save();
}

function renderChoice(x){const multi=x.type==='multi';$('options').innerHTML=x.options.map((o,i)=>`<label class="option"><input type="${multi?'checkbox':'radio'}" name="answer" value="${i}"><span><b>${String.fromCharCode(65+i)}.</b> ${o}</span></label>`).join('')}
function renderOrder(x){
  const items=shuffle(x.options.map((text,i)=>({text,i})));
  $('options').innerHTML=`<div class="order-note">拖曳卡片調整順序；手機可先點卡片，再點另一張卡片交換位置。</div><div id="dragBank" class="drag-bank">${items.map(v=>`<div class="drag-item" draggable="true" data-index="${v.i}">${v.text}</div>`).join('')}</div>`;
  enableDrag();
}
function enableDrag(){let dragged=null;document.querySelectorAll('.drag-item').forEach(el=>{el.addEventListener('dragstart',()=>{dragged=el;el.classList.add('dragging')});el.addEventListener('dragend',()=>{el.classList.remove('dragging');dragged=null});el.addEventListener('dragover',e=>e.preventDefault());el.addEventListener('drop',e=>{e.preventDefault();if(dragged&&dragged!==el){const p=el.parentNode;const nodes=[...p.children];const a=nodes.indexOf(dragged),b=nodes.indexOf(el);if(a<b)p.insertBefore(dragged,el.nextSibling);else p.insertBefore(dragged,el)}});el.addEventListener('click',()=>{const chosen=document.querySelector('.drag-item[data-selected="1"]');if(!chosen){el.dataset.selected='1';el.style.borderColor='var(--gold)'}else if(chosen===el){delete el.dataset.selected;el.style.borderColor=''}else{const p=el.parentNode,tmp=document.createElement('span');p.insertBefore(tmp,chosen);p.insertBefore(chosen,el);p.insertBefore(el,tmp);tmp.remove();delete chosen.dataset.selected;chosen.style.borderColor=''}})})}

function selected(){const x=currentQ();if(x.type==='order')return [...document.querySelectorAll('.drag-item')].map(el=>+el.dataset.index);return [...document.querySelectorAll('input[name="answer"]:checked')].map(x=>+x.value)}
function isCorrect(x,a){if(x.type==='multi'){const A=[...x.answer].sort(),B=[...a].sort();return A.length===B.length&&A.every((v,i)=>v===B[i])}if(x.type==='order')return a.length===x.answer.length&&a.every((v,i)=>v===x.answer[i]);return a.length===1&&a[0]===x.answer}
function answerText(x,a){if(x.type==='order')return (Array.isArray(a)?a:[a]).map((v,i)=>`${i+1}. ${x.options[v]}`).join(' → ');return (Array.isArray(a)?a:[a]).map(i=>String.fromCharCode(65+i)+'. '+x.options[i]).join('；')}

function submit(){
  if(S.answered)return;const x=currentQ(),a=selected();if(!a.length){$('feedbackBox').hidden=false;$('feedbackBox').className='feedback bad';$('feedbackBox').textContent='⚠ 請先完成作答。';return}
  const ok=isCorrect(x,a);S.answered=true;if(ok)S.score+=S.hinted?80:100;else S.hearts=Math.max(0,S.hearts-1);S.log.push({id:x.id,zone:x.zone,topic:x.topic,type:x.type,selected:a,correct:ok,answer:x.answer,hinted:S.hinted,ts:new Date().toISOString()});
  $('hudHearts').textContent='♥'.repeat(S.hearts)+'♡'.repeat(3-S.hearts);$('hudXp').textContent=String(S.score).padStart(3,'0');$('feedbackBox').hidden=false;$('feedbackBox').className='feedback '+(ok?'good':'bad');$('feedbackBox').innerHTML=`<b>${ok?'✓ 判讀成功！':'✕ 踩到氣象陷阱！'}</b><br>${ok?'':'正確答案：'+answerText(x,x.answer)+'<br>'}${x.explanation}`;$('submitBtn').disabled=true;$('hintBtn').disabled=true;document.querySelectorAll('input[name="answer"],.drag-item').forEach(e=>{e.disabled=true;e.draggable=false;e.style.pointerEvents='none'});$('nextBtn').hidden=false;
  if(S.i===9){$('bossPanel').classList.add('boss-hit');$('bossHp').style.width=ok?'0%':'45%';setTimeout(()=>$('bossPanel').classList.remove('boss-hit'),400)}beep(ok);save();
}
function hint(){if(S.hinted||S.answered)return;S.hinted=true;$('hintBox').hidden=false;$('hintBox').innerHTML='<b>提示晶片：</b> '+currentQ().hint+'<br><small>本題答對可得 80 XP</small>';$('hintBtn').disabled=true;save()}
function next(){if(!S.answered)return;if(S.i<9){S.i++;render()}else finish()}

function zoneStats(){const map={};S.log.forEach(r=>{map[r.zone]??={n:0,c:0};map[r.zone].n++;if(r.correct)map[r.zone].c++});return map}
function finish(){const c=S.log.filter(x=>x.correct).length;let title,badge;if(c===10){title='SS級・氣象核心完全解鎖！';badge='🏆'}else if(c>=8){title='S級・氣象分析師！';badge='⭐'}else if(c>=6){title='A級・風雲探險家！';badge='🛰️'}else{title='完成任務，再挑戰一次！';badge='🧭'}$('resultIcon').textContent=badge;$('resultTitle').textContent=title;$('resultStats').innerHTML=`<b>${S.player}</b><br>答對 ${c}/10　｜　正確率 ${c*10}%<br>總 XP：${S.score}　｜　剩餘能量：${S.hearts}/3`;
  const z=zoneStats();$('zoneAnalysis').innerHTML=Object.entries(z).map(([name,v])=>`<div class="analysis-card"><b>${name}</b>${v.c}/${v.n} 題答對<br><small>正確率 ${Math.round(v.c/v.n*100)}%</small></div>`).join('');show('resultScreen');save()}
function review(){const box=$('reviewBox');box.hidden=!box.hidden;if(box.hidden)return;box.innerHTML=S.log.map((r,i)=>{const x=QUESTION_BANK.find(q=>q.id===r.id);return `<div class="review-item ${r.correct?'good':'bad'}"><b>#${i+1} ${r.correct?'✓':'✕'} ${x.topic} (${x.id})</b><br>你的答案：${answerText(x,r.selected)}<br>正確答案：${answerText(x,x.answer)}<br>${x.explanation}</div>`}).join('')}

function download(name,text,type){const b=new Blob([text],{type});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),500)}
function csvEscape(v){v=String(v??'');return '"'+v.replaceAll('"','""')+'"'}
function exportCSV(){const rows=[['player','index','id','zone','topic','type','correct','hinted','selected','correct_answer','timestamp']];S.log.forEach((r,i)=>{const x=QUESTION_BANK.find(q=>q.id===r.id);rows.push([S.player,i+1,r.id,r.zone,r.topic,TYPE_LABEL[r.type]||r.type,r.correct,r.hinted,answerText(x,r.selected),answerText(x,x.answer),r.ts||''])});download(`weather-quest-${S.player||'student'}.csv`,'\uFEFF'+rows.map(r=>r.map(csvEscape).join(',')).join('\n'),'text/csv;charset=utf-8')}
function exportJSON(){download(`weather-quest-${S.player||'student'}.json`,JSON.stringify({exportedAt:new Date().toISOString(),state:S},null,2),'application/json')}

function teacher(){const dlg=$('teacherDialog');const done=S.log.filter(r=>r.correct).length;$('teacherSummary').innerHTML=`<div><small>題庫</small><b>50 題</b></div><div><small>本輪</small><b>${S.round.length||0} 題</b></div><div><small>已作答</small><b>${S.log.length} 題</b></div><div><small>目前答對</small><b>${done} 題</b></div>`;$('teacherTable').innerHTML=QUESTION_BANK.map((x,i)=>`<tr><td>${i+1}</td><td>${x.id}</td><td>${x.zone}</td><td>${x.topic}</td><td>${TYPE_LABEL[x.type]||x.type}</td><td>${answerText(x,x.answer)}</td></tr>`).join('');dlg.showModal()}

$('startBtn').onclick=startNew;$('submitBtn').onclick=submit;$('hintBtn').onclick=hint;$('nextBtn').onclick=next;$('againBtn').onclick=()=>{show('startScreen');startNew()};$('reviewBtn').onclick=review;$('csvBtn').onclick=exportCSV;$('jsonBtn').onclick=exportJSON;$('teacherCsvBtn').onclick=exportCSV;$('teacherJsonBtn').onclick=exportJSON;$('teacherBtn').onclick=teacher;
$('resetBtn').onclick=()=>{if(confirm('放棄目前進度並重新開始？')){localStorage.removeItem(STORAGE_KEY);location.reload()}};$('soundBtn').onclick=()=>{S.sound=!S.sound;$('soundBtn').textContent=S.sound?'♪ 音效：開':'♪ 音效：關';save()};$('continueBtn').onclick=()=>{show('gameScreen');render()};
const has=load();$('continueBtn').hidden=!has;if(has)$('playerName').value=S.player||'';$('soundBtn').textContent=S.sound?'♪ 音效：開':'♪ 音效：關';