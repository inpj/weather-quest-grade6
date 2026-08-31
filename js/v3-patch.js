// v3 patch: 100題顯示、擴充題目圖像分類、教師模式動態統計。
(function(){
  const oldVisual=window.visualFor;
  window.visualFor=function(x){
    const base=oldVisual?oldVisual(x):'';
    if(base) return base;
    const n=Number(x.id.replace('WX',''));
    if((n>=51&&n<=60)) return `<div class="visual-title">水與大氣任務示意</div><div class="water-cycle"><div class="cell">🌊 水</div><div class="arrow">⇄</div><div class="cell">💨 水蒸氣</div><div class="arrow">⇄</div><div class="cell">☁️ 小水滴／冰晶</div></div>`;
    if((n>=61&&n<=70)) return `<div class="visual-title">天氣圖資料台（自製示意）</div><div class="pressure-map"><div class="iso i1"></div><div class="iso i2"></div><div class="iso i3"></div><span class="map-label h">H</span><div class="iso r1"></div><div class="iso r2"></div><span class="map-label l">L</span></div>`;
    if((n>=71&&n<=80)) return `<div class="visual-title">氣團與鋒面任務</div><div class="front-diagram"><div class="airmass cold">❄️ 冷氣團</div><div class="front-symbol">▲ ▲ ▲　● ● ●</div><div class="airmass warm">☀️ 暖氣團</div></div>`;
    if((n>=81&&n<=90)) return `<div class="visual-title">颱風情報台</div><div class="typhoon-card"><div><div class="typhoon-spiral">🌀</div></div><div><b>判讀線索</b><br>中心氣壓 · 最大風速<br>路徑 · 警報 · 災情<br>防災決策</div></div>`;
    if((n>=91&&n<=100)) return `<div class="visual-title">福爾摩沙衛星任務</div><div class="satellite-viz"><div class="sat">🛰️</div><div class="beam">⇣⇣⇣</div><div class="earth">🌏</div></div>`;
    return '';
  };

  function dynamicTeacher(){
    const dlg=document.getElementById('teacherDialog');
    const done=S.log.filter(r=>r.correct).length;
    document.getElementById('teacherSummary').innerHTML=`<div><small>題庫</small><b>${QUESTION_BANK.length} 題</b></div><div><small>本輪</small><b>${S.round.length||0} 題</b></div><div><small>已作答</small><b>${S.log.length} 題</b></div><div><small>目前答對</small><b>${done} 題</b></div>`;
    document.getElementById('teacherTable').innerHTML=QUESTION_BANK.map((x,i)=>`<tr><td>${i+1}</td><td>${x.id}</td><td>${x.zone}</td><td>${x.topic}</td><td>${TYPE_LABEL[x.type]||x.type}</td><td>${answerText(x,x.answer)}</td></tr>`).join('');
    dlg.showModal();
  }
  document.getElementById('teacherBtn').onclick=dynamicTeacher;
})();
