'use strict';

const canvas=document.getElementById('game');
const ctx=canvas.getContext('2d');
const W=canvas.width,H=canvas.height,ground=590;
const keys=Object.create(null);
let running=false,last=0,timer=90,round=1,p1Wins=0,p2Wins=0,projectiles=[],effects=[],stationary=null,soundOn=true,roundOver=false;
let selectedStage='winter',stageClock=0,windPulse=0,windDir=-1,rainBand=null;

const STAGES={
  winter:{name:'冬季寒流',desc:'冷鋒速度與傷害提升，週期出現東北季風。'},
  meiyu:{name:'梅雨季',desc:'中央雨帶週期生成，滯留鋒持續更久。'},
  typhoon:{name:'颱風季',desc:'左右交替強陣風，角色與鋒面都會偏移。'}
};

const coldImg=new Image();coldImg.src='./assets/cold-fighter.svg';
const warmImg=new Image();warmImg.src='./assets/warm-fighter.svg';

const ui={
  p1Hp:document.getElementById('p1Hp'),p2Hp:document.getElementById('p2Hp'),p1Energy:document.getElementById('p1Energy'),p2Energy:document.getElementById('p2Energy'),
  p1Power:document.getElementById('p1Power'),p2Power:document.getElementById('p2Power'),timer:document.getElementById('timer'),roundLabel:document.getElementById('roundLabel'),
  p1Wins:document.getElementById('p1Wins'),p2Wins:document.getElementById('p2Wins'),announcement:document.getElementById('announcement'),stageLabel:document.getElementById('stageLabel'),
  stageHud:document.getElementById('stageHud'),battleStageChip:document.getElementById('battleStageChip')
};

function fighter(x,side){return{x,y:ground-128,vx:0,vy:0,w:82,h:128,hp:100,energy:0,side,dir:side===1?1:-1,guard:false,attack:0,charge:0,charging:false,cool:0,flash:0}}
let p1=fighter(210,1),p2=fighter(988,2);

function clamp(n,a,b){return Math.max(a,Math.min(b,n))}
function overlap(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y}
function announce(t,ms=650){ui.announcement.textContent=t;clearTimeout(announce.t);announce.t=setTimeout(()=>ui.announcement.textContent='',ms)}
function tone(f=220,d=.06){if(!soundOn)return;try{const AC=window.AudioContext||window.webkitAudioContext,a=new AC(),o=a.createOscillator(),g=a.createGain();o.frequency.value=f;g.gain.value=.045;o.connect(g);g.connect(a.destination);o.start();g.gain.exponentialRampToValueAtTime(.001,a.currentTime+d);o.stop(a.currentTime+d)}catch{}}
function frontLevel(c){return c<28?1:c<65?2:3}

function resetRound(){
  p1=fighter(210,1);p2=fighter(988,2);projectiles=[];effects=[];stationary=null;timer=90;roundOver=false;stageClock=0;windPulse=0;windDir=-1;rainBand=null;
  ui.roundLabel.textContent='ROUND '+round;ui.stageHud.textContent=STAGES[selectedStage].name;ui.battleStageChip.textContent='目前戰場：'+STAGES[selectedStage].name;
  announce('ROUND '+round,850);syncUI();
}

function syncUI(){
  ui.p1Hp.style.width=p1.hp+'%';ui.p2Hp.style.width=p2.hp+'%';ui.p1Energy.style.width=p1.energy+'%';ui.p2Energy.style.width=p2.energy+'%';
  ui.p1Power.textContent=Math.round(p1.energy)+'%';ui.p2Power.textContent=Math.round(p2.energy)+'%';ui.timer.textContent=Math.max(0,Math.ceil(timer));
  ui.p1Wins.className=p1Wins?'won':'';ui.p2Wins.className=p2Wins?'won':'';
}

function fireFront(p,type){
  if(p.cool>0)return;
  const level=frontLevel(p.charge);let speed=5.8+level*1.25,damage=5+level*4,r=17+level*7;
  if(selectedStage==='winter'&&type==='cold'){speed*=1.16;damage*=1.18}
  projectiles.push({x:p.x+(p.dir>0?p.w+12:-18),y:p.y+42,vx:p.dir*speed,vy:0,side:p.side,type,level,r,damage,life:200});
  p.energy=Math.min(100,p.energy+8+level*3);p.cool=25;p.charge=0;p.charging=false;tone(type==='cold'?180:300,.08);
}

function hit(a,dmg,dir){
  const guard=a.guard?.38:1;a.hp=Math.max(0,a.hp-dmg*guard);a.vx+=dir*5*guard;a.flash=6;
  effects.push({x:a.x+a.w/2,y:a.y+45,life:22,kind:a.side===1?'warm':'cold'});tone(90,.08);
}

function updateFacing(){p1.dir=p1.x+p1.w/2<=p2.x+p2.w/2?1:-1;p2.dir=-p1.dir}
function resolveBodies(){
  if(!overlap(p1,p2))return;const c1=p1.x+p1.w/2,c2=p2.x+p2.w/2;const o=c1<c2?p1.x+p1.w-p2.x:p2.x+p2.w-p1.x;if(o<=0)return;const push=o/2+.5;
  if(c1<c2){p1.x-=push;p2.x+=push}else{p1.x+=push;p2.x-=push}
}

function inRainBand(p){return rainBand&&Math.abs(p.x+p.w/2-rainBand.x)<rainBand.width/2}

function updatePlayer(p,left,right,jump,guard,attack,shoot,type){
  p.guard=!!keys[guard];let move=.75;
  if(selectedStage==='meiyu'&&inRainBand(p))move*=.62;
  if(!p.guard){if(keys[left])p.vx-=move;if(keys[right])p.vx+=move}
  if(keys[jump]&&p.y>=ground-p.h-.5){p.vy=-13;tone(150,.03)}
  if(keys[attack]&&p.attack<=0){p.attack=16;p.cool=Math.max(p.cool,10)}
  if(keys[shoot]){p.charging=true;p.charge=Math.min(100,p.charge+.9);p.energy=Math.min(100,p.energy+.05)}else if(p.charging)fireFront(p,type);
  p.vx*=.82;p.vy+=.75;p.x+=p.vx;p.y+=p.vy;
  if(p.y>ground-p.h){p.y=ground-p.h;p.vy=0}p.x=clamp(p.x,24,W-24-p.w);
  if(p.attack>0)p.attack--;if(p.cool>0)p.cool--;if(p.flash>0)p.flash--;
  if(p.attack===8){const box={x:p.dir>0?p.x+p.w-2:p.x-55,y:p.y+24,w:57,h:62};const foe=p.side===1?p2:p1;if(overlap(box,foe)){hit(foe,5,p.dir);p.energy=Math.min(100,p.energy+6)}}
}

function spawnStationary(a,b){
  const life=selectedStage==='meiyu'?300:180;stationary={x:(a.x+b.x)/2,y:(a.y+b.y)/2,life,width:selectedStage==='meiyu'?300:220};a.life=b.life=0;
  announce('滯留鋒！勢均力敵',1200);tone(420,.2);
}

function projectileStep(){
  for(const q of projectiles){
    if(selectedStage==='meiyu'&&rainBand&&Math.abs(q.x-rainBand.x)<rainBand.width/2)q.vx*=.992;
    q.x+=q.vx;q.y+=q.vy;q.life--;const foe=q.side===1?p2:p1;
    if(overlap({x:q.x-q.r,y:q.y-q.r,w:q.r*2,h:q.r*2},foe)){hit(foe,q.damage,Math.sign(q.vx));q.life=0}
  }
  for(let i=0;i<projectiles.length;i++)for(let j=i+1;j<projectiles.length;j++){
    const a=projectiles[i],b=projectiles[j];if(a.side===b.side||a.life<=0||b.life<=0)continue;
    if(Math.hypot(a.x-b.x,a.y-b.y)<a.r+b.r){if(a.level===b.level){spawnStationary(a,b)}else{const strong=a.level>b.level?a:b,weak=strong===a?b:a;weak.life=0;announce(strong.type==='cold'?'冷鋒突破！':'暖鋒突破！',700)}}
  }
  projectiles=projectiles.filter(q=>q.life>0&&q.x>-120&&q.x<W+120);
  if(stationary&&--stationary.life<=0)stationary=null;effects.forEach(e=>e.life--);effects=effects.filter(e=>e.life>0);
}

function stageStep(dt){
  stageClock+=dt/1000;
  if(selectedStage==='winter'){
    const phase=stageClock%10;if(phase>7.8){if(windPulse<=0){windPulse=1.3;announce('東北季風增強 →',800)}windPulse=Math.max(0,windPulse-dt/1000);const push=-.11;p1.vx+=push;p2.vx+=push;projectiles.forEach(q=>q.vx+=push*.035)}
  }else if(selectedStage==='meiyu'){
    const cycle=stageClock%12;if(cycle<7){rainBand={x:W/2+Math.sin(stageClock*.65)*90,width:330}}else rainBand=null;
  }else if(selectedStage==='typhoon'){
    const cycle=stageClock%8;if(cycle<1.7){const newDir=Math.floor(stageClock/8)%2===0?1:-1;if(windPulse<=0){windDir=newDir;windPulse=1.7;announce(windDir>0?'颱風強陣風 →':'← 颱風強陣風',700)}windPulse=Math.max(0,windPulse-dt/1000);const push=.16*windDir;p1.vx+=push;p2.vx+=push;projectiles.forEach(q=>{q.x+=push*7;q.vy+=Math.sin(stageClock*5+q.x*.01)*.015})}
  }
}

function roundResult(){
  if(roundOver)return;if(timer<=0||p1.hp<=0||p2.hp<=0){roundOver=true;let winner=p1.hp===p2.hp?0:(p1.hp>p2.hp?1:2);if(winner===1)p1Wins++;if(winner===2)p2Wins++;announce(winner?`PLAYER ${winner} WIN!`:'DRAW!',1400);syncUI();
    setTimeout(()=>{if(p1Wins>=2||p2Wins>=2){running=false;document.getElementById('winnerTitle').textContent=(p1Wins>p2Wins?'寒潮・藍鋒':'暖流・赤鋒')+' 勝利！';document.getElementById('winnerText').textContent=`最終比分 ${p1Wins}：${p2Wins}。本場戰場：${STAGES[selectedStage].name}。`;document.getElementById('endOverlay').classList.add('active')}else{round++;resetRound()}},1500)}
}

function update(dt){if(!running||roundOver)return;timer-=dt/1000;stageStep(dt);updateFacing();updatePlayer(p1,'a','d','w','s','f','g','cold');updatePlayer(p2,'ArrowLeft','ArrowRight','ArrowUp','ArrowDown','j','k','warm');resolveBodies();projectileStep();roundResult();syncUI()}
function line(x1,y1,x2,y2,c,w=2){ctx.strokeStyle=c;ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke()}

function drawFrontSymbol(x,y,type,dir,scale=1){ctx.save();ctx.translate(x,y);ctx.scale(dir*scale,scale);ctx.lineWidth=5;ctx.strokeStyle=type==='cold'?'#16a9ff':'#ff4a36';ctx.fillStyle=ctx.strokeStyle;ctx.beginPath();ctx.moveTo(-34,0);ctx.lineTo(34,0);ctx.stroke();for(let i=-20;i<=20;i+=20){ctx.beginPath();if(type==='cold'){ctx.moveTo(i,-1);ctx.lineTo(i+8,13);ctx.lineTo(i+16,-1)}else{ctx.arc(i+8,0,8,Math.PI,0)}ctx.fill()}ctx.restore()}

function drawWeatherMapBase(top,bottom){
  const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,top);g.addColorStop(.7,bottom);g.addColorStop(1,'#101820');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='#d8eaf044';ctx.lineWidth=2;for(let i=0;i<7;i++){ctx.beginPath();ctx.ellipse(640,290,250+i*70,80+i*38,0,0,Math.PI*2);ctx.stroke()}
  ctx.fillStyle='#0e2433cc';ctx.fillRect(0,ground,W,H-ground);line(0,ground,W,ground,'#d3e3ef',3);
  ctx.fillStyle='#ffffff8a';ctx.font='18px monospace';ctx.fillText('1020',160,150);ctx.fillText('1016',1030,155);ctx.fillText('1012',590,245);ctx.fillText('1008',900,355);
}

function drawBackground(){
  if(selectedStage==='winter'){
    drawWeatherMapBase('#14284a','#56768b');
    ctx.fillStyle='#e8f7ffbb';for(let i=0;i<65;i++){const x=(i*197+Math.floor(stageClock*35))%W,y=(i*83)%520;ctx.fillRect(x,y,2,2)}
    ctx.font='bold 25px monospace';ctx.fillStyle='#bfe9ff';ctx.fillText('NE MONSOON →',42,70);
  }else if(selectedStage==='meiyu'){
    drawWeatherMapBase('#273149','#53636e');ctx.fillStyle='#9fdcff33';ctx.fillRect(0,110,W,260);
    if(rainBand){ctx.fillStyle='#6fc9ff22';ctx.fillRect(rainBand.x-rainBand.width/2,70,rainBand.width,ground-70);for(let i=0;i<42;i++){const x=rainBand.x-rainBand.width/2+(i*53)%rainBand.width,y=90+(i*97+stageClock*180)%470;line(x,y,x-8,y+20,'#9bdcff99',2)}}
    ctx.font='bold 25px monospace';ctx.fillStyle='#a8ddff';ctx.fillText('MEIYU RAIN BAND',40,70);
  }else{
    drawWeatherMapBase('#18304a','#426777');const cx=W*.78,cy=190;ctx.strokeStyle='#d7f3ff77';ctx.lineWidth=8;for(let r=35;r<160;r+=32){ctx.beginPath();ctx.arc(cx,cy,r,stageClock*.8,stageClock*.8+Math.PI*1.4);ctx.stroke()}
    ctx.font='bold 25px monospace';ctx.fillStyle='#d2f4ff';ctx.fillText('TYPHOON GUSTS',40,70);
  }
}

function drawFighterSprite(p,img,type){
  ctx.save();ctx.translate(p.x+p.w/2,p.y+p.h/2);ctx.scale(p.dir,1);if(p.flash%2)ctx.globalAlpha=.45;
  const bob=p.y>=ground-p.h-.5?Math.sin(performance.now()/150)*2:0;ctx.drawImage(img,-57,-80+bob,114,154);
  if(p.attack>0){ctx.strokeStyle=type==='cold'?'#8fe8ff':'#ffb086';ctx.lineWidth=9;ctx.beginPath();ctx.moveTo(28,0);ctx.lineTo(58,0);ctx.stroke()}
  if(p.guard){ctx.strokeStyle='#ffe56a';ctx.lineWidth=5;ctx.beginPath();ctx.arc(12,0,52,-1.2,1.2);ctx.stroke()}
  if(p.charging){ctx.strokeStyle=type==='cold'?'#54d6ff':'#ff875e';ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,0,58+p.charge*.15,0,Math.PI*2);ctx.stroke()}
  ctx.restore();
}

function draw(){
  drawBackground();
  if(stationary){ctx.fillStyle='#7bc7ff33';ctx.fillRect(stationary.x-stationary.width/2,stationary.y-140,stationary.width,ground-stationary.y+140);for(let y=stationary.y-110;y<ground;y+=28){line(stationary.x-70+(y%3)*20,y,stationary.x-78+(y%3)*20,y+18,'#9bdcff99',1.5)}for(let i=-2;i<=2;i++){const xx=stationary.x+i*38;drawFrontSymbol(xx,stationary.y,i%2===0?'cold':'warm',i%2===0?1:-1,.65)}}
  for(const q of projectiles){ctx.shadowBlur=18;ctx.shadowColor=q.type==='cold'?'#1bb8ff':'#ff5a32';drawFrontSymbol(q.x,q.y,q.type,Math.sign(q.vx),.7+q.level*.18);ctx.shadowBlur=0}
  for(const e of effects){ctx.globalAlpha=e.life/22;ctx.fillStyle=e.kind==='cold'?'#74dfff':'#ff8c63';ctx.beginPath();ctx.arc(e.x,e.y,(23-e.life)*2.2,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1}
  drawFighterSprite(p1,coldImg,'cold');drawFighterSprite(p2,warmImg,'warm');
}

function loop(ts){const dt=Math.min(33,ts-last||16);last=ts;update(dt);draw();requestAnimationFrame(loop)}
window.addEventListener('keydown',e=>{keys[e.key.length===1?e.key.toLowerCase():e.key]=true;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key))e.preventDefault()});
window.addEventListener('keyup',e=>{keys[e.key.length===1?e.key.toLowerCase():e.key]=false});

document.querySelectorAll('.stage-btn').forEach(btn=>btn.addEventListener('click',()=>{selectedStage=btn.dataset.stage;document.querySelectorAll('.stage-btn').forEach(b=>b.classList.toggle('selected',b===btn));ui.stageLabel.textContent=STAGES[selectedStage].name+'｜'+STAGES[selectedStage].desc;ui.stageHud.textContent=STAGES[selectedStage].name;ui.battleStageChip.textContent='目前戰場：'+STAGES[selectedStage].name;}));

document.getElementById('startBtn').onclick=()=>{document.getElementById('startOverlay').classList.remove('active');running=true;round=1;p1Wins=p2Wins=0;resetRound()};
document.getElementById('rematchBtn').onclick=()=>{document.getElementById('endOverlay').classList.remove('active');running=true;round=1;p1Wins=p2Wins=0;resetRound()};
document.getElementById('changeStageBtn').onclick=()=>{document.getElementById('endOverlay').classList.remove('active');document.getElementById('startOverlay').classList.add('active')};
document.getElementById('helpBtn').onclick=()=>document.getElementById('helpDialog').showModal();
document.getElementById('soundBtn').onclick=e=>{soundOn=!soundOn;e.currentTarget.textContent='♪ 音效：'+(soundOn?'開':'關')};
requestAnimationFrame(loop);syncUI();
