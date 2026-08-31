// v3 patch: 100題顯示、教師模式動態統計、像素世界地圖移動。
(function(){
  const MAP_POS={
    '水氣森林':{left:'11%',top:'66%'},
    '天氣圖城':{left:'31%',top:'13%'},
    '鋒面峽谷':{left:'50%',top:'65%'},
    '颱風之眼':{left:'72%',top:'18%'},
    '衛星塔':{left:'88%',top:'66%'}
  };
  function updateWorldMap(){
    const x=currentQ?.();
    if(!x||!document.getElementById('worldPlayer')) return;
    document.querySelectorAll('.world-zone').forEach(z=>z.classList.toggle('active',z.dataset.zone===x.zone));
    const pos=MAP_POS[x.zone]||MAP_POS['水氣森林'];
    const p=document.getElementById('worldPlayer');p.style.left=pos.left;p.style.top=pos.top;
    document.getElementById('worldStatus').textContent=`第 ${S.i+1} 格：前往「${x.zone}」｜${x.topic}`;
  }
  const oldRender=window.render;
  window.render=function(){oldRender();updateWorldMap();};

  function dynamicTeacher(){
    const dlg=document.getElementById('teacherDialog');
    const done=S.log.filter(r=>r.correct).length;
    document.getElementById('teacherSummary').innerHTML=`<div><small>題庫</small><b>${QUESTION_BANK.length} 題</b></div><div><small>本輪</small><b>${S.round.length||0} 題</b></div><div><small>已作答</small><b>${S.log.length} 題</b></div><div><small>目前答對</small><b>${done} 題</b></div>`;
    document.getElementById('teacherTable').innerHTML=QUESTION_BANK.map((x,i)=>`<tr><td>${i+1}</td><td>${x.id}</td><td>${x.zone}</td><td>${x.topic}</td><td>${TYPE_LABEL[x.type]||x.type}</td><td>${answerText(x,x.answer)}</td></tr>`).join('');
    dlg.showModal();
  }
  document.getElementById('teacherBtn').onclick=dynamicTeacher;
})();