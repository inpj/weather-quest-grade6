'use strict';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;
const ground = 590;
const keys = Object.create(null);

let running = false;
let last = 0;
let timer = 90;
let round = 1;
let p1Wins = 0;
let p2Wins = 0;
let projectiles = [];
let effects = [];
let stationary = null;
let soundOn = true;
let roundOver = false;

const coldImg = new Image();
coldImg.src = './assets/cold-fighter.svg';
const warmImg = new Image();
warmImg.src = './assets/warm-fighter.svg';

const ui = {
  p1Hp: document.getElementById('p1Hp'),
  p2Hp: document.getElementById('p2Hp'),
  p1Energy: document.getElementById('p1Energy'),
  p2Energy: document.getElementById('p2Energy'),
  p1Power: document.getElementById('p1Power'),
  p2Power: document.getElementById('p2Power'),
  timer: document.getElementById('timer'),
  roundLabel: document.getElementById('roundLabel'),
  p1Wins: document.getElementById('p1Wins'),
  p2Wins: document.getElementById('p2Wins'),
  announcement: document.getElementById('announcement')
};

function fighter(x, side) {
  return {
    x,
    y: ground - 128,
    vx: 0,
    vy: 0,
    w: 82,
    h: 128,
    hp: 100,
    side,
    dir: side === 1 ? 1 : -1,
    guard: false,
    attack: 0,
    charge: 0,
    charging: false,
    cool: 0,
    flash: 0
  };
}

let p1 = fighter(210, 1);
let p2 = fighter(988, 2);

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function clearAnnouncement() {
  clearTimeout(announce.t);
  ui.announcement.textContent = '';
}

function announce(text, ms = 650) {
  ui.announcement.textContent = text;
  clearTimeout(announce.t);
  announce.t = setTimeout(() => {
    ui.announcement.textContent = '';
  }, ms);
}

function tone(freq = 220, duration = .06) {
  if (!soundOn) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    const ac = new AC();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.frequency.value = freq;
    gain.gain.value = .045;
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(.001, ac.currentTime + duration);
    osc.stop(ac.currentTime + duration);
  } catch (_) {}
}

function frontLevel(charge) {
  return charge < 28 ? 1 : charge < 65 ? 2 : 3;
}

function resetRound() {
  clearAnnouncement();
  p1 = fighter(210, 1);
  p2 = fighter(988, 2);
  projectiles = [];
  effects = [];
  stationary = null;
  timer = 90;
  roundOver = false;
  ui.roundLabel.textContent = 'ROUND ' + round;
  announce('ROUND ' + round, 850);
  syncUI();
}

function syncUI() {
  ui.p1Hp.style.width = p1.hp + '%';
  ui.p2Hp.style.width = p2.hp + '%';
  ui.p1Energy.style.width = p1.charge + '%';
  ui.p2Energy.style.width = p2.charge + '%';
  ui.p1Power.textContent = Math.round(p1.charge) + '%';
  ui.p2Power.textContent = Math.round(p2.charge) + '%';
  ui.timer.textContent = Math.max(0, Math.ceil(timer));
  ui.p1Wins.className = p1Wins ? 'won' : '';
  ui.p2Wins.className = p2Wins ? 'won' : '';
}

function fireFront(p, type) {
  if (p.cool > 0) return;

  const level = frontLevel(p.charge);
  const speed = 5.8 + level * 1.25;
  const damage = 5 + level * 4;
  const r = 17 + level * 7;

  projectiles.push({
    x: p.x + (p.dir > 0 ? p.w + 22 : -22),
    y: p.y + 48,
    vx: p.dir * speed,
    side: p.side,
    type,
    level,
    r,
    damage,
    life: 200
  });

  p.cool = 25;
  p.charge = 0;
  p.charging = false;
  tone(type === 'cold' ? 180 : 300, .08);
}

function hit(target, damage, dir) {
  const guardMultiplier = target.guard ? .38 : 1;
  target.hp = Math.max(0, target.hp - damage * guardMultiplier);
  target.vx += dir * 5 * guardMultiplier;
  target.flash = 6;
  effects.push({
    x: target.x + target.w / 2,
    y: target.y + 45,
    life: 22,
    kind: target.side === 1 ? 'warm' : 'cold'
  });
  tone(90, .08);
}

function updateFacing() {
  p1.dir = p1.x + p1.w / 2 <= p2.x + p2.w / 2 ? 1 : -1;
  p2.dir = -p1.dir;
}

function resolveBodies() {
  if (!overlap(p1, p2)) return;

  const c1 = p1.x + p1.w / 2;
  const c2 = p2.x + p2.w / 2;
  const amount = c1 < c2 ? p1.x + p1.w - p2.x : p2.x + p2.w - p1.x;
  if (amount <= 0) return;

  const push = amount / 2 + .5;
  if (c1 < c2) {
    p1.x -= push;
    p2.x += push;
  } else {
    p1.x += push;
    p2.x -= push;
  }

  p1.x = clamp(p1.x, 24, W - 24 - p1.w);
  p2.x = clamp(p2.x, 24, W - 24 - p2.w);
}

function updatePlayer(p, left, right, jump, guard, attack, shoot, type) {
  p.guard = !!keys[guard];

  if (!p.guard) {
    if (keys[left]) p.vx -= .75;
    if (keys[right]) p.vx += .75;
  }

  if (keys[jump] && p.y >= ground - p.h - .5) {
    p.vy = -13;
    tone(150, .03);
  }

  if (keys[attack] && p.attack <= 0) {
    p.attack = 16;
    p.cool = Math.max(p.cool, 10);
  }

  if (keys[shoot]) {
    p.charging = true;
    p.charge = Math.min(100, p.charge + .9);
  } else if (p.charging) {
    fireFront(p, type);
  }

  p.vx *= .82;
  p.vy += .75;
  p.x += p.vx;
  p.y += p.vy;

  if (p.y > ground - p.h) {
    p.y = ground - p.h;
    p.vy = 0;
  }
  p.x = clamp(p.x, 24, W - 24 - p.w);

  if (p.attack > 0) p.attack--;
  if (p.cool > 0) p.cool--;
  if (p.flash > 0) p.flash--;

  if (p.attack === 8) {
    const box = {
      x: p.dir > 0 ? p.x + p.w - 2 : p.x - 55,
      y: p.y + 24,
      w: 57,
      h: 62
    };
    const foe = p.side === 1 ? p2 : p1;
    if (overlap(box, foe)) hit(foe, 5, p.dir);
  }
}

function spawnStationary(a, b) {
  stationary = {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    life: 180,
    width: 220
  };
  a.life = 0;
  b.life = 0;
  announce('滯留鋒！兩側推進相近', 1300);
  tone(420, .2);
}

function projectileStep() {
  for (const q of projectiles) {
    q.x += q.vx;
    q.life--;

    const foe = q.side === 1 ? p2 : p1;
    if (overlap({ x: q.x - q.r, y: q.y - q.r, w: q.r * 2, h: q.r * 2 }, foe)) {
      hit(foe, q.damage, Math.sign(q.vx));
      q.life = 0;
    }
  }

  for (let i = 0; i < projectiles.length; i++) {
    for (let j = i + 1; j < projectiles.length; j++) {
      const a = projectiles[i];
      const b = projectiles[j];
      if (a.side === b.side || a.life <= 0 || b.life <= 0) continue;
      if (Math.hypot(a.x - b.x, a.y - b.y) >= a.r + b.r) continue;

      if (a.level === b.level) {
        spawnStationary(a, b);
      } else {
        const strong = a.level > b.level ? a : b;
        const weak = strong === a ? b : a;
        weak.life = 0;
        strong.level = Math.max(1, strong.level - 1);
        strong.r = 17 + strong.level * 7;
        strong.damage = 5 + strong.level * 4;
        announce(strong.type === 'cold' ? '冷鋒推進較強！' : '暖鋒推進較強！', 750);
      }
    }
  }

  projectiles = projectiles.filter(q => q.life > 0 && q.x > -120 && q.x < W + 120);
  if (stationary && --stationary.life <= 0) stationary = null;
  effects.forEach(e => e.life--);
  effects = effects.filter(e => e.life > 0);
}

function roundResult() {
  if (roundOver) return;
  if (timer > 0 && p1.hp > 0 && p2.hp > 0) return;

  roundOver = true;
  const winner = p1.hp === p2.hp ? 0 : (p1.hp > p2.hp ? 1 : 2);
  if (winner === 1) p1Wins++;
  if (winner === 2) p2Wins++;

  announce(winner ? `PLAYER ${winner} WIN!` : 'DRAW!', 1500);
  syncUI();

  setTimeout(() => {
    if (p1Wins >= 2 || p2Wins >= 2) {
      running = false;
      const matchWinner = p1Wins > p2Wins ? 1 : 2;
      document.getElementById('winnerTitle').textContent = matchWinner === 1 ? '冷氣團・藍鋒 勝利！' : '暖氣團・赤鋒 勝利！';
      document.getElementById('winnerText').textContent =
        `最終比分 ${p1Wins}：${p2Wins}。遊戲勝負是競賽機制；科學重點是冷、暖鋒符號朝推進方向，以及勢力相近時鋒面可能移動緩慢。`;
      document.getElementById('endOverlay').classList.add('active');
    } else {
      round++;
      resetRound();
    }
  }, 1600);
}

function update(dt) {
  if (!running || roundOver) return;

  timer -= dt / 1000;
  updateFacing();
  updatePlayer(p1, 'a', 'd', 'w', 's', 'f', 'g', 'cold');
  updatePlayer(p2, 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'j', 'k', 'warm');
  resolveBodies();
  projectileStep();
  roundResult();
  syncUI();
}

function line(x1, y1, x2, y2, color, width = 2) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawFrontSymbol(x, y, type, dir, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  const color = type === 'cold' ? '#16a9ff' : '#ff4a36';
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 鋒面主線改成直立，讓三角形／半圓能直接朝向前進方向。
  ctx.beginPath();
  ctx.moveTo(0, -34);
  ctx.lineTo(0, 34);
  ctx.stroke();

  const marks = [-20, 0, 20];

  if (type === 'cold') {
    for (const yy of marks) {
      ctx.beginPath();
      ctx.moveTo(0, yy - 8);
      ctx.lineTo(dir * 17, yy);
      ctx.lineTo(0, yy + 8);
      ctx.closePath();
      ctx.fill();
    }
  } else {
    for (const yy of marks) {
      ctx.beginPath();
      ctx.moveTo(0, yy - 8);
      ctx.bezierCurveTo(dir * 15, yy - 8, dir * 15, yy + 8, 0, yy + 8);
      ctx.closePath();
      ctx.fill();
    }
  }

  ctx.restore();
}

function drawStationaryFront(x, y, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const coldY = [-24, 14];
  const warmY = [-6, 32];

  ctx.strokeStyle = '#16a9ff';
  ctx.beginPath();
  ctx.moveTo(0, -38);
  ctx.lineTo(0, 0);
  ctx.stroke();

  ctx.strokeStyle = '#ff4a36';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 40);
  ctx.stroke();

  ctx.fillStyle = '#16a9ff';
  for (const yy of coldY) {
    ctx.beginPath();
    ctx.moveTo(0, yy - 8);
    ctx.lineTo(16, yy);
    ctx.lineTo(0, yy + 8);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = '#ff4a36';
  for (const yy of warmY) {
    ctx.beginPath();
    ctx.moveTo(0, yy - 8);
    ctx.bezierCurveTo(-14, yy - 8, -14, yy + 8, 0, yy + 8);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

function drawBackground() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#102846');
  g.addColorStop(.68, '#31566a');
  g.addColorStop(1, '#101820');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = '#d8eaf044';
  ctx.lineWidth = 2;
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    ctx.ellipse(640, 290, 250 + i * 70, 80 + i * 38, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = '#0e2433cc';
  ctx.fillRect(0, ground, W, H - ground);
  line(0, ground, W, ground, '#d3e3ef', 3);

  ctx.fillStyle = '#ffffff88';
  ctx.font = '18px monospace';
  ctx.fillText('1020', 160, 150);
  ctx.fillText('1016', 1030, 155);
  ctx.fillText('1012', 590, 245);
  ctx.fillText('1008', 900, 355);
}

function drawFighterSprite(p, img, type) {
  ctx.save();
  ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
  ctx.scale(p.dir, 1);
  if (p.flash % 2) ctx.globalAlpha = .45;

  const bob = p.y >= ground - p.h - .5 ? Math.sin(performance.now() / 150) * 2 : 0;

  if (img.complete && img.naturalWidth) {
    ctx.drawImage(img, -57, -80 + bob, 114, 154);
  } else {
    ctx.fillStyle = type === 'cold' ? '#0aa7ff' : '#ff4c38';
    ctx.fillRect(-34, -58 + bob, 68, 116);
  }

  if (p.attack > 0) {
    ctx.strokeStyle = type === 'cold' ? '#8fe8ff' : '#ffb086';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(28, 0);
    ctx.lineTo(58, 0);
    ctx.stroke();
  }

  if (p.guard) {
    ctx.strokeStyle = '#ffe56a';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(12, 0, 52, -1.2, 1.2);
    ctx.stroke();
  }

  if (p.charging) {
    ctx.strokeStyle = type === 'cold' ? '#54d6ff' : '#ff875e';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, 58 + p.charge * .15, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function draw() {
  drawBackground();

  if (stationary) {
    ctx.fillStyle = '#7bc7ff22';
    ctx.fillRect(
      stationary.x - stationary.width / 2,
      stationary.y - 145,
      stationary.width,
      ground - stationary.y + 145
    );

    for (let y = stationary.y - 110; y < ground; y += 28) {
      line(
        stationary.x - 70 + (y % 3) * 20,
        y,
        stationary.x - 78 + (y % 3) * 20,
        y + 18,
        '#9bdcff99',
        1.5
      );
    }

    drawStationaryFront(stationary.x, stationary.y, 1.15);
  }

  for (const q of projectiles) {
    ctx.shadowBlur = 18;
    ctx.shadowColor = q.type === 'cold' ? '#1bb8ff' : '#ff5a32';
    drawFrontSymbol(q.x, q.y, q.type, Math.sign(q.vx) || 1, .72 + q.level * .18);
    ctx.shadowBlur = 0;
  }

  for (const e of effects) {
    ctx.globalAlpha = e.life / 22;
    ctx.fillStyle = e.kind === 'cold' ? '#74dfff' : '#ff8c63';
    ctx.beginPath();
    ctx.arc(e.x, e.y, (23 - e.life) * 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  drawFighterSprite(p1, coldImg, 'cold');
  drawFighterSprite(p2, warmImg, 'warm');
}

function loop(ts) {
  const dt = Math.min(33, ts - last || 16);
  last = ts;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

window.addEventListener('keydown', e => {
  keys[e.key.length === 1 ? e.key.toLowerCase() : e.key] = true;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) e.preventDefault();
});

window.addEventListener('keyup', e => {
  keys[e.key.length === 1 ? e.key.toLowerCase() : e.key] = false;
});

window.addEventListener('blur', () => {
  for (const k of Object.keys(keys)) keys[k] = false;
});

document.getElementById('startBtn').onclick = () => {
  document.getElementById('startOverlay').classList.remove('active');
  running = true;
  round = 1;
  p1Wins = 0;
  p2Wins = 0;
  resetRound();
};

document.getElementById('rematchBtn').onclick = () => {
  document.getElementById('endOverlay').classList.remove('active');
  running = true;
  round = 1;
  p1Wins = 0;
  p2Wins = 0;
  resetRound();
};

document.getElementById('helpBtn').onclick = () => document.getElementById('helpDialog').showModal();

document.getElementById('soundBtn').onclick = e => {
  soundOn = !soundOn;
  e.currentTarget.textContent = '♪ 音效：' + (soundOn ? '開' : '關');
};

requestAnimationFrame(loop);
syncUI();
