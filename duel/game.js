'use strict';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;
const GROUND = 590;
const keys = Object.create(null);

const CHARACTERS = {
  siberian: {
    name:'西伯利亞高壓', title:'寒潮統帥', icon:'❄', asset:'./assets/siberian-fighter.svg', emblem:'H', front:'cold',
    color:'#22b8ff', accent:'#b8edff', hp:108, speed:6.5, jump:13.1,
    passive:'冷鋒速度 +12%，冬季寒流關卡再獲小幅增益。',
    skillName:'寒潮爆發', superName:'極地寒潮'
  },
  pacific: {
    name:'太平洋高壓', title:'盛夏霸主', icon:'☀', asset:'./assets/pacific-fighter.svg', emblem:'H', front:'warm',
    color:'#ff6845', accent:'#ffd27a', hp:114, speed:5.8, jump:12.5,
    passive:'生命較高，暖鋒體積較大；角色技可進入短暫霸體。',
    skillName:'副熱帶霸體', superName:'盛夏高壓'
  },
  cyclone: {
    name:'溫帶低氣壓', title:'氣旋獵手', icon:'🌀', asset:'./assets/cyclone-fighter.svg', emblem:'L', front:'alternate',
    color:'#9a76ff', accent:'#e0d4ff', hp:100, speed:6.9, jump:13.5,
    passive:'普通鋒面冷／暖交替，能同時展示低壓系統的冷鋒與暖鋒。',
    skillName:'氣旋吸引', superName:'爆發氣旋'
  },
  meiyu: {
    name:'梅雨鋒面', title:'雨帶封鎖者', icon:'🌧', asset:'./assets/meiyu-fighter.svg', emblem:'鋒', front:'alternate',
    color:'#4ed1c8', accent:'#ff79a8', hp:104, speed:5.9, jump:12.8,
    passive:'滯留鋒雨域持續更久，雨區內雙方移動速度降低。',
    skillName:'滯留雨域', superName:'梅雨封鎖線'
  }
};

const CHARACTER_ORDER = ['siberian','pacific','cyclone','meiyu'];
const STAGES = {
  winter:{name:'冬季寒流',desc:'冷鋒速度與傷害略增，週期出現東北季風。'},
  meiyu:{name:'梅雨季',desc:'中央雨帶週期生成，滯留鋒持續更久。'},
  typhoon:{name:'颱風季',desc:'強陣風週期出現，人物與鋒面都可能被吹偏。'}
};

let selected = {p1:'siberian', p2:'pacific', stage:'winter'};
let running=false, roundOver=false, soundOn=true, last=0, timer=90, round=1, p1Wins=0, p2Wins=0;
let p1, p2, stationary=null, stageRain=null, windPulse=0, cameraShake=0, hitStop=0, superFlash=0;
let projectiles=[], effects=[], vortices=[];

const ui = {
  p1Hp:$('#p1Hp'),p2Hp:$('#p2Hp'),p1Energy:$('#p1Energy'),p2Energy:$('#p2Energy'),p1Power:$('#p1Power'),p2Power:$('#p2Power'),
  p1Name:$('#p1Name'),p2Name:$('#p2Name'),p1Title:$('#p1Title'),p2Title:$('#p2Title'),p1Portrait:$('#p1Portrait'),p2Portrait:$('#p2Portrait'),
  timer:$('#timer'),roundLabel:$('#roundLabel'),stageHud:$('#stageHud'),announcement:$('#announcement'),superBanner:$('#superBanner'),
  p1Combo:$('#p1Combo'),p2Combo:$('#p2Combo'),battleStageChip:$('#battleStageChip')
};

function $(q){return document.querySelector(q)}
function clamp(n,a,b){return Math.max(a,Math.min(b,n))}
function overlap(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y}
function tone(freq=220,d=.06){if(!soundOn)return;try{const AC=window.AudioContext||window.webkitAudioContext;const ac=new AC(),o=ac.createOscillator(),g=ac.createGain();o.frequency.value=freq;g.gain.value=.045;o.connect(g);g.connect(ac.destination);o.start();g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+d);o.stop(ac.currentTime+d)}catch{}}
function announce(t,ms=700){ui.announcement.textContent=t;clearTimeout(announce.t);announce.t=setTimeout(()=>ui.announcement.textContent='',ms)}
function banner(t){ui.superBanner.textContent=t;ui.superBanner.classList.remove('show');void ui.superBanner.offsetWidth;ui.superBanner.classList.add('show')}

function makeFighter(x,side,charId){
  const c=CHARACTERS[charId];
  return {charId,c,x,y:GROUND-116,vx:0,vy:0,w:76,h:116,hp:c.hp,maxHp:c.hp,energy:0,side,dir:side===1?1:-1,guard:false,
    attackFrame:0,attackCooldown:0,projectileCooldown:0,hitStun:0,invuln:0,charge:0,charging:false,flash:0,
    skillCooldown:0,shield:0,slow:0,frontToggle:0,combo:0,comboTimer:0,superAura:0};
}

function buildRoster(){
  for(const side of [1,2]){
    const root=$(`#p${side}Roster`);root.innerHTML='';
    CHARACTER_ORDER.forEach(id=>{const c=CHARACTERS[id];const btn=document.createElement('button');btn.type='button';btn.className='fighter-option';btn.dataset.char=id;btn.innerHTML=`<img class="portrait-img" src="${c.asset}" alt=""><b>${c.name}</b><em>${c.title}</em><span>${c.passive}</span><span class="type-chip">角色技：${c.skillName}</span>`;btn.onclick=()=>{selected[`p${side}`]=id;renderRosterSelection();};root.appendChild(btn);});
  }
  const info=$('#rosterInfo');info.innerHTML='';
  CHARACTER_ORDER.forEach(id=>{const c=CHARACTERS[id];const art=document.createElement('article');art.className='fighter-info';art.innerHTML=`<div class="big-icon">${c.icon}</div><h3>${c.name}</h3><small>${c.title}</small><p>${c.passive}</p><span class="skill">角色技：${c.skillName}<br>MAX：${c.superName}</span>`;info.appendChild(art);});
  renderRosterSelection();
}

function renderRosterSelection(){
  document.querySelectorAll('#p1Roster .fighter-option').forEach(b=>b.classList.toggle('selected',b.dataset.char===selected.p1));
  document.querySelectorAll('#p2Roster .fighter-option').forEach(b=>b.classList.toggle('selected',b.dataset.char===selected.p2));
}

function updateHudIdentity(){
  const c1=CHARACTERS[selected.p1],c2=CHARACTERS[selected.p2];
  ui.p1Name.textContent=c1.name;ui.p1Title.textContent=c1.title;ui.p1Portrait.textContent=c1.icon;
  ui.p2Name.textContent=c2.name;ui.p2Title.textContent=c2.title;ui.p2Portrait.textContent=c2.icon;
  ui.stageHud.textContent=STAGES[selected.stage].name;ui.battleStageChip.textContent=`目前關卡：${STAGES[selected.stage].name}`;
}

function resetRound(){
  p1=makeFighter(210,1,selected.p1);p2=makeFighter(994,2,selected.p2);
  projectiles=[];effects=[];vortices=[];stationary=null;stageRain=null;windPulse=0;timer=90;roundOver=false;hitStop=0;cameraShake=0;superFlash=0;
  updateHudIdentity();syncUI();announce(`ROUND ${round}`,750);setTimeout(()=>announce('FIGHT!',500),780);
}

function syncUI(){
  if(!p1||!p2)return;
  ui.p1Hp.style.width=`${100*p1.hp/p1.maxHp}%`;ui.p2Hp.style.width=`${100*p2.hp/p2.maxHp}%`;
  ui.p1Energy.style.width=`${p1.energy}%`;ui.p2Energy.style.width=`${p2.energy}%`;
  ui.p1Power.textContent=`${Math.round(p1.energy)}%`;ui.p2Power.textContent=`${Math.round(p2.energy)}%`;
  ui.timer.textContent=Math.max(0,Math.ceil(timer));ui.roundLabel.textContent=`ROUND ${round}`;
  ui.p1Combo.textContent=p1.combo>=2?`${p1.combo} HIT COMBO!`:'';ui.p2Combo.textContent=p2.combo>=2?`${p2.combo} HIT COMBO!`:'';
  [1,2].forEach(side=>{for(let i=1;i<=2;i++)$(`#p${side}Dot${i}`).className=((side===1?p1Wins:p2Wins)>=i)?'won':''});
}

function frontTypeFor(player){
  if(player.c.front!=='alternate')return player.c.front;
  const t=player.frontToggle%2===0?'cold':'warm';player.frontToggle++;return t;
}
function frontLevel(c){return c<28?1:c<65?2:3}
function projectileStats(type,level,owner){
  let speed=6.1+level*1.25,r=18+level*7,damage=6+level*4;
  if(type==='cold')speed*=1.08;if(type==='warm')r*=1.09;
  if(owner.charId==='siberian'&&type==='cold')speed*=1.12;
  if(owner.charId==='pacific'&&type==='warm')r*=1.12;
  if(selected.stage==='winter'&&type==='cold'){speed*=1.08;damage*=1.08}
  return {speed,r,damage};
}

function fireFront(player,typeOverride=null,forcedLevel=null,superShot=false){
  if(player.projectileCooldown>0||player.hitStun>0)return;
  const type=typeOverride||frontTypeFor(player);const level=forcedLevel||frontLevel(player.charge);const s=projectileStats(type,level,player);
  projectiles.push({x:player.x+(player.dir>0?player.w+18:-18),y:player.y+39,vx:player.dir*s.speed,vy:0,side:player.side,type,level,r:s.r*(superShot?1.55:1),damage:s.damage*(superShot?1.75:1),life:230,superShot,owner:player.charId});
  player.energy=clamp(player.energy+7+level*3,0,100);player.projectileCooldown=superShot?34:20;player.charge=0;player.charging=false;tone(type==='cold'?180:300,.08);
}

function registerCombo(attacker){attacker.combo++;attacker.comboTimer=75;attacker.energy=clamp(attacker.energy+4,0,100)}
function takeHit(target,damage,dir,knock=5.2,attacker=null){
  if(target.invuln>0)return false;
  let mult=target.guard?.34:1;if(target.shield>0)mult*=.25;
  target.hp=clamp(target.hp-damage*mult,0,target.maxHp);target.vx+=dir*knock*mult;if(!target.guard)target.vy-=1.8;
  target.hitStun=target.guard?5:12;target.invuln=7;target.flash=7;cameraShake=Math.max(cameraShake,target.guard?3:7);hitStop=target.guard?2:4;
  effects.push({kind:'hit',x:target.x+target.w/2,y:target.y+42,life:22,color:target.c.color});
  if(attacker)registerCombo(attacker);tone(target.guard?120:82,.07);return true;
}

function useSkill(player){
  if(player.energy<35||player.skillCooldown>0||player.hitStun>0)return;
  player.energy-=35;player.skillCooldown=160;banner(player.c.skillName);tone(390,.12);
  const foe=player.side===1?p2:p1;
  if(player.charId==='siberian'){
    const dir=player.dir;foe.vx+=dir*11;foe.slow=75;takeHit(foe,8,dir,7,player);effects.push({kind:'gust',x:player.x+player.w/2,y:player.y+30,life:40,dir,color:'#76dcff'});
  }else if(player.charId==='pacific'){
    player.shield=135;player.invuln=Math.max(player.invuln,10);effects.push({kind:'aura',x:player.x+player.w/2,y:player.y+55,life:135,color:'#ffd56d'});
  }else if(player.charId==='cyclone'){
    vortices.push({x:player.x+player.dir*180,y:GROUND-115,r:125,life:105,side:player.side,power:.8,damageTick:0});
  }else if(player.charId==='meiyu'){
    stationary={x:(player.x+foe.x)/2+38,y:GROUND-165,life:260,width:290,strong:true,owner:player.side};
  }
}

function useSuper(player){
  if(player.energy<100||player.hitStun>0)return;
  player.energy=0;player.superAura=90;superFlash=14;cameraShake=12;banner(`MAX · ${player.c.superName}`);tone(520,.22);
  const foe=player.side===1?p2:p1;
  if(player.charId==='siberian'){
    player.projectileCooldown=0;fireFront(player,'cold',4,true);foe.slow=130;
  }else if(player.charId==='pacific'){
    player.shield=210;player.projectileCooldown=0;fireFront(player,'warm',4,true);
  }else if(player.charId==='cyclone'){
    vortices.push({x:W/2,y:GROUND-150,r:220,life:180,side:player.side,power:1.25,damageTick:0,super:true});
  }else if(player.charId==='meiyu'){
    stationary={x:W/2,y:GROUND-180,life:360,width:650,strong:true,owner:player.side,super:true};
  }
}

function updateFacing(){p1.dir=p1.x+p1.w/2<=p2.x+p2.w/2?1:-1;p2.dir=-p1.dir}
function resolveBodies(){if(!overlap(p1,p2))return;const c1=p1.x+p1.w/2,c2=p2.x+p2.w/2;const ox=c1<c2?p1.x+p1.w-p2.x:p2.x+p2.w-p1.x;if(ox<=0)return;const push=ox/2+.5;if(c1<c2){p1.x-=push;p2.x+=push}else{p1.x+=push;p2.x-=push}p1.x=clamp(p1.x,20,W-20-p1.w);p2.x=clamp(p2.x,20,W-20-p2.w)}

function updatePlayer(player,controls){
  const foe=player.side===1?p2:p1;const speedMul=player.slow>0?.68:1;
  if(player.hitStun>0){player.hitStun--;player.guard=false}else{
    player.guard=!!keys[controls.guard];
    if(!player.guard){if(keys[controls.left])player.vx-=.8;if(keys[controls.right])player.vx+=.8}
    if(keys[controls.jump]&&player.y>=GROUND-player.h-.5){player.vy=-player.c.jump;tone(150,.03)}
    if(keys[controls.attack]&&player.attackCooldown<=0){player.attackFrame=16;player.attackCooldown=21}
    if(keys[controls.shoot]){player.charging=true;player.charge=clamp(player.charge+.95,0,100);player.energy=clamp(player.energy+.035,0,100)}else if(player.charging)fireFront(player);
    if(keys[controls.skill]&&!keys[`_${controls.skill}`]){keys[`_${controls.skill}`]=true;useSkill(player)}if(!keys[controls.skill])keys[`_${controls.skill}`]=false;
    if(keys[controls.super]&&!keys[`_${controls.super}`]){keys[`_${controls.super}`]=true;useSuper(player)}if(!keys[controls.super])keys[`_${controls.super}`]=false;
  }
  player.vx=clamp(player.vx,-player.c.speed*speedMul,player.c.speed*speedMul);player.vx*=.8;player.vy+=.75;player.x+=player.vx;player.y+=player.vy;
  if(player.y>GROUND-player.h){player.y=GROUND-player.h;player.vy=0}player.x=clamp(player.x,20,W-20-player.w);
  if(player.attackFrame>0){player.attackFrame--;if(player.attackFrame===8){const box={x:player.dir>0?player.x+player.w-2:player.x-58,y:player.y+18,w:60,h:66};if(overlap(box,foe))takeHit(foe,6.2,player.dir,5.8,player)}}
  for(const k of ['attackCooldown','projectileCooldown','skillCooldown','invuln','flash','shield','slow','superAura'])if(player[k]>0)player[k]--;
  if(player.comboTimer>0){player.comboTimer--;if(player.comboTimer<=0)player.combo=0}
}

function spawnStationary(a,b){stationary={x:(a.x+b.x)/2,y:(a.y+b.y)/2,life:selected.stage==='meiyu'?285:190,width:selected.stage==='meiyu'?310:230,strong:false,owner:0};a.life=b.life=0;announce('滯留鋒！勢均力敵',1100);tone(420,.18)}
function clash(a,b){
  if(a.type===b.type){a.life=b.life=0;effects.push({kind:'burst',x:(a.x+b.x)/2,y:(a.y+b.y)/2,life:24,color:'#ffffff'});announce('同型鋒面抵銷',550);return}
  if(a.level===b.level){spawnStationary(a,b);return}
  const strong=a.level>b.level?a:b,weak=strong===a?b:a;weak.life=0;strong.level=Math.max(1,strong.level-1);const owner=strong.side===1?p1:p2,s=projectileStats(strong.type,strong.level,owner);strong.r=s.r;strong.damage=s.damage;strong.vx=Math.sign(strong.vx)*s.speed;announce(`${strong.type==='cold'?'冷鋒':'暖鋒'}突破！`,620)
}

function environmentStep(){
  windPulse++;
  if(selected.stage==='winter'&&windPulse%360===0){announce('東北季風增強！',650);for(const p of [p1,p2])p.vx-=2.2;for(const q of projectiles)q.vx-=.35}
  if(selected.stage==='meiyu'&&!stageRain&&windPulse%520===0){stageRain={x:W/2,y:GROUND-180,life:220,width:390};announce('梅雨雨帶增強',650)}
  if(selected.stage==='typhoon'&&windPulse%310===0){const dir=(Math.floor(windPulse/310)%2===0)?1:-1;announce(dir>0?'颱風陣風 →':'← 颱風陣風',600);for(const p of [p1,p2])p.vx+=dir*4.8;for(const q of projectiles){q.vx+=dir*.8;q.vy-=.18}}
  if(stageRain){stageRain.life--;if(stageRain.life<=0)stageRain=null}
}

function zoneEffects(){
  const zones=[];if(stationary)zones.push(stationary);if(stageRain)zones.push(stageRain);
  for(const z of zones){for(const p of [p1,p2]){const cx=p.x+p.w/2;if(Math.abs(cx-z.x)<z.width/2){p.vx*=z.strong?.88:.94;if(z.super&&z.owner&&p.side!==z.owner&&windPulse%28===0)takeHit(p,1.3,Math.sign(p.x-z.x)||1,1.5,z.owner===1?p1:p2)}}}
  if(stationary&&--stationary.life<=0)stationary=null;
}

function projectileStep(){
  for(const q of projectiles){if(q.life<=0)continue;q.x+=q.vx;q.y+=q.vy;q.life--;const foe=q.side===1?p2:p1;const hb={x:q.x-q.r,y:q.y-q.r,w:q.r*2,h:q.r*2};if(overlap(hb,foe)&&takeHit(foe,q.damage,Math.sign(q.vx),5.4+q.level,q.side===1?p1:p2))q.life=0}
  for(let i=0;i<projectiles.length;i++)for(let j=i+1;j<projectiles.length;j++){const a=projectiles[i],b=projectiles[j];if(a.side===b.side||a.life<=0||b.life<=0)continue;if(Math.hypot(a.x-b.x,a.y-b.y)<a.r+b.r)clash(a,b)}
  projectiles=projectiles.filter(q=>q.life>0&&q.x>-140&&q.x<W+140);
}

function vortexStep(){
  for(const v of vortices){v.life--;v.damageTick++;const owner=v.side===1?p1:p2,foe=v.side===1?p2:p1;const fx=foe.x+foe.w/2,fy=foe.y+foe.h/2,dx=v.x-fx,dy=v.y-fy,d=Math.hypot(dx,dy);if(d<v.r*1.45){foe.vx+=(dx/Math.max(1,d))*v.power;foe.vy+=(dy/Math.max(1,d))*v.power*.18;if(v.damageTick%28===0)takeHit(foe,v.super?2.5:1.4,Math.sign(dx)||1,1.2,owner)}for(const q of projectiles){const qd=Math.hypot(v.x-q.x,v.y-q.y);if(qd<v.r*1.3){q.vx+=(v.x-q.x)/Math.max(80,qd)*.08*v.power;q.vy+=(v.y-q.y)/Math.max(80,qd)*.05*v.power}}}
  vortices=vortices.filter(v=>v.life>0);
}

function finishRound(){
  if(roundOver||timer>0&&p1.hp>0&&p2.hp>0)return;roundOver=true;const winner=p1.hp===p2.hp?0:(p1.hp>p2.hp?1:2);if(winner===1)p1Wins++;if(winner===2)p2Wins++;announce(winner?`PLAYER ${winner} WIN!`:'DRAW!',1200);syncUI();
  setTimeout(()=>{if(p1Wins>=2||p2Wins>=2){running=false;const wp=p1Wins>p2Wins?p1:p2;$('#winnerTitle').textContent=`${wp.c.name} 勝利！`;$('#winnerText').textContent=`最終比分 ${p1Wins}：${p2Wins}。這一版加入角色差異、角色技、MAX 超必殺、Combo 與季節戰場，同時保留「冷暖鋒勢均力敵 → 滯留鋒」的核心科學規則。`;$('#endOverlay').classList.add('active')}else{round++;resetRound()}},1350)
}

function update(dt){
  if(!running||roundOver)return;if(hitStop>0){hitStop--;return}timer-=dt/1000;updateFacing();
  updatePlayer(p1,{left:'a',right:'d',jump:'w',guard:'s',attack:'f',shoot:'g',skill:'h',super:'r'});
  updatePlayer(p2,{left:'ArrowLeft',right:'ArrowRight',jump:'ArrowUp',guard:'ArrowDown',attack:'j',shoot:'k',skill:'l',super:'i'});
  resolveBodies();projectileStep();vortexStep();environmentStep();zoneEffects();finishRound();syncUI();
}

function line(x1,y1,x2,y2,c,w=2){ctx.strokeStyle=c;ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke()}
function drawFront(x,y,type,dir,scale=1,superShot=false){ctx.save();ctx.translate(x,y);ctx.scale(dir*scale,scale);ctx.lineWidth=superShot?8:5;ctx.strokeStyle=type==='cold'?'#16b8ff':'#ff4a36';ctx.fillStyle=ctx.strokeStyle;ctx.shadowBlur=superShot?28:14;ctx.shadowColor=ctx.strokeStyle;ctx.beginPath();ctx.moveTo(-38,0);ctx.lineTo(38,0);ctx.stroke();for(let i=-24;i<=24;i+=24){ctx.beginPath();if(type==='cold'){ctx.moveTo(i,-1);ctx.lineTo(i+9,15);ctx.lineTo(i+18,-1)}else{ctx.arc(i+9,0,9,Math.PI,0)}ctx.fill()}ctx.restore()}

function drawBackground(){
  const stage=selected.stage;const sky=ctx.createLinearGradient(0,0,0,H);
  if(stage==='winter'){sky.addColorStop(0,'#0d2746');sky.addColorStop(.62,'#4f7790');sky.addColorStop(1,'#18232e')}
  else if(stage==='meiyu'){sky.addColorStop(0,'#17293a');sky.addColorStop(.65,'#46606b');sky.addColorStop(1,'#192228')}
  else{sky.addColorStop(0,'#101d38');sky.addColorStop(.58,'#31536a');sky.addColorStop(1,'#111a22')}
  ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='#cde6f52d';ctx.lineWidth=2;for(let i=0;i<7;i++){ctx.beginPath();ctx.ellipse(640,282,240+i*72,75+i*38,.03,0,Math.PI*2);ctx.stroke()}
  ctx.fillStyle='#ffffff66';ctx.font='18px monospace';ctx.fillText('1020',150,130);ctx.fillText('1016',1040,145);ctx.fillText('1012',590,235);ctx.fillText('1008',900,340);
  if(stage==='winter'){ctx.fillStyle='#d8efff18';for(let i=0;i<70;i++){const x=(i*179+windPulse*1.2)%W,y=(i*83)%520;ctx.fillRect(x,y,3,3)}}
  if(stage==='meiyu'){ctx.fillStyle='#6b7b8955';ctx.fillRect(0,205,W,95)}
  if(stage==='typhoon'){ctx.strokeStyle='#b9e8ff33';for(let i=0;i<5;i++){ctx.beginPath();ctx.arc(1030,235,55+i*32,0,Math.PI*1.8);ctx.stroke()}}
  ctx.fillStyle='#0d2230';ctx.fillRect(0,GROUND,W,H-GROUND);line(0,GROUND,W,GROUND,'#d8e7ef',3);
}

function drawRainZone(z,alpha=.22){ctx.save();ctx.fillStyle=`rgba(86,185,255,${alpha})`;ctx.fillRect(z.x-z.width/2,145,z.width,GROUND-145);ctx.strokeStyle='#8edcff99';ctx.lineWidth=2;for(let x=z.x-z.width/2+18;x<z.x+z.width/2;x+=26)for(let y=175+(x%17);y<GROUND;y+=36){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-7,y+18);ctx.stroke()}ctx.restore()}
function drawStationary(z){drawRainZone(z,z.super?.32:.22);for(let i=-3;i<=3;i++){const x=z.x+i*34;drawFront(x,z.y,i%2===0?'warm':'cold',i%2===0?-1:1,.48,z.super)}}
function drawVortex(v){ctx.save();ctx.translate(v.x,v.y);ctx.strokeStyle=v.super?'#d7c2ff':'#aa8dff';ctx.globalAlpha=Math.min(1,v.life/25);for(let i=0;i<5;i++){ctx.lineWidth=3-i*.35;ctx.beginPath();ctx.arc(0,0,v.r*(.25+i*.15),windPulse*.035+i,windPulse*.035+i+Math.PI*1.45);ctx.stroke()}ctx.restore()}

function drawFighter(p){
  const bob=p.y>=GROUND-p.h-.5?Math.sin((windPulse+p.side*8)*.11)*1.8:0;ctx.save();ctx.translate(p.x+p.w/2,p.y+bob);ctx.scale(p.dir,1);
  if(p.flash>0){ctx.globalAlpha=.55}if(p.superAura>0){ctx.strokeStyle=p.c.color;ctx.lineWidth=5;ctx.shadowBlur=22;ctx.shadowColor=p.c.color;ctx.beginPath();ctx.arc(0,56,52+Math.sin(windPulse*.2)*5,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0}
  if(p.shield>0){ctx.fillStyle='#ffe28a1f';ctx.strokeStyle='#ffe37a';ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(0,58,50,62,0,0,Math.PI*2);ctx.fill();ctx.stroke()}
  ctx.strokeStyle='#07101a';ctx.lineWidth=14;ctx.beginPath();ctx.moveTo(-13,82);ctx.lineTo(-18,110);ctx.moveTo(13,82);ctx.lineTo(18,110);ctx.stroke();ctx.strokeStyle=p.c.accent;ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(-13,82);ctx.lineTo(-18,108);ctx.moveTo(13,82);ctx.lineTo(18,108);ctx.stroke();
  ctx.fillStyle='#07111f';ctx.fillRect(-28,32,56,57);ctx.fillStyle=p.c.color;ctx.fillRect(-23,37,46,46);ctx.fillStyle=p.c.accent;ctx.fillRect(-18,61,36,17);
  ctx.fillStyle='#07111f';ctx.font=`bold ${p.c.emblem==='鋒'?17:25}px sans-serif`;ctx.textAlign='center';ctx.fillText(p.c.emblem,0,60);
  ctx.fillStyle='#07111f';ctx.beginPath();ctx.arc(0,18,24,0,Math.PI*2);ctx.fill();ctx.fillStyle=p.c.accent;ctx.beginPath();ctx.arc(0,18,18,0,Math.PI*2);ctx.fill();ctx.fillStyle='#0b1420';ctx.fillRect(-10,13,6,4);ctx.fillRect(4,13,6,4);
  ctx.strokeStyle=p.c.color;ctx.lineWidth=12;ctx.lineCap='round';ctx.beginPath();if(p.attackFrame>0){ctx.moveTo(20,48);ctx.lineTo(52,39);ctx.moveTo(-18,50);ctx.lineTo(-25,68)}else if(p.guard){ctx.moveTo(17,47);ctx.lineTo(34,28);ctx.moveTo(-17,47);ctx.lineTo(-29,29)}else{ctx.moveTo(18,47);ctx.lineTo(29,67);ctx.moveTo(-18,47);ctx.lineTo(-28,68)}ctx.stroke();ctx.lineCap='butt';
  if(p.charging){ctx.strokeStyle=p.c.color;ctx.lineWidth=4;ctx.globalAlpha=.8;ctx.beginPath();ctx.arc(35,50,20+p.charge*.18,0,Math.PI*2);ctx.stroke()}
  ctx.restore();ctx.globalAlpha=1;
}

function drawEffects(){for(const e of effects){e.life--;ctx.save();ctx.globalAlpha=e.life/24;if(e.kind==='hit'||e.kind==='burst'){for(let i=0;i<8;i++){const a=i*Math.PI/4,r=(24-e.life)*3;line(e.x,e.y,e.x+Math.cos(a)*r,e.y+Math.sin(a)*r,e.color||'#fff',3)}}else if(e.kind==='gust'){ctx.strokeStyle=e.color;ctx.lineWidth=5;for(let i=0;i<6;i++){ctx.beginPath();ctx.moveTo(e.x,e.y+i*12);ctx.lineTo(e.x+e.dir*(70+(40-e.life)*4),e.y+i*12-8);ctx.stroke()}}ctx.restore()}effects=effects.filter(e=>e.life>0)}

function draw(){
  ctx.save();if(cameraShake>0){ctx.translate((Math.random()-.5)*cameraShake,(Math.random()-.5)*cameraShake);cameraShake*=.82;if(cameraShake<.5)cameraShake=0}
  drawBackground();if(stageRain)drawRainZone(stageRain,.16);if(stationary)drawStationary(stationary);vortices.forEach(drawVortex);
  for(const q of projectiles)drawFront(q.x,q.y,q.type,Math.sign(q.vx),(.72+q.level*.17)*(q.superShot?1.15:1),q.superShot);
  drawEffects();drawFighter(p1);drawFighter(p2);
  if(superFlash>0){ctx.fillStyle=`rgba(255,255,255,${superFlash/22})`;ctx.fillRect(0,0,W,H);superFlash--}
  ctx.restore();
}

function loop(ts){const dt=Math.min(34,ts-last||16);last=ts;update(dt);draw();requestAnimationFrame(loop)}

window.addEventListener('keydown',e=>{const k=e.key.length===1?e.key.toLowerCase():e.key;keys[k]=true;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key))e.preventDefault()});
window.addEventListener('keyup',e=>{const k=e.key.length===1?e.key.toLowerCase():e.key;keys[k]=false});window.addEventListener('blur',()=>Object.keys(keys).forEach(k=>keys[k]=false));

document.querySelectorAll('.stage-btn').forEach(btn=>btn.onclick=()=>{selected.stage=btn.dataset.stage;document.querySelectorAll('.stage-btn').forEach(b=>b.classList.toggle('selected',b===btn));$('#stageLabel').textContent=`${STAGES[selected.stage].name}｜${STAGES[selected.stage].desc}`;updateHudIdentity()});
$('#startBtn').onclick=()=>{p1Wins=p2Wins=0;round=1;running=true;$('#startOverlay').classList.remove('active');resetRound()};
$('#rematchBtn').onclick=()=>{p1Wins=p2Wins=0;round=1;running=true;$('#endOverlay').classList.remove('active');resetRound()};
$('#reselectBtn').onclick=()=>{running=false;$('#endOverlay').classList.remove('active');$('#startOverlay').classList.add('active');renderRosterSelection()};
$('#helpBtn').onclick=()=>$('#helpDialog').showModal();
$('#soundBtn').onclick=e=>{soundOn=!soundOn;e.currentTarget.textContent='♪ 音效：'+(soundOn?'開':'關')};

buildRoster();updateHudIdentity();p1=makeFighter(210,1,selected.p1);p2=makeFighter(994,2,selected.p2);syncUI();requestAnimationFrame(loop);
