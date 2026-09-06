'use strict';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;
const ground = 590;

const keys = Object.create(null);
const projectiles = [];
const effects = [];

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
  announcement: document.getElementById('announcement'),
};

const CONFIG = {
  roundSeconds: 90,
  roundsToWin: 2,
  gravity: 0.75,
  acceleration: 0.78,
  friction: 0.80,
  maxSpeed: 7.2,
  jumpSpeed: 13.2,
  fighterWidth: 72,
  fighterHeight: 112,
  stationaryLife: 180,
};

let running = false;
let roundOver = false;
let soundOn = true;
let last = 0;
let timer = CONFIG.roundSeconds;
let round = 1;
let p1Wins = 0;
let p2Wins = 0;
let stationary = null;

function makeFighter(x, side) {
  return {
    x,
    y: ground - CONFIG.fighterHeight,
    vx: 0,
    vy: 0,
    w: CONFIG.fighterWidth,
    h: CONFIG.fighterHeight,
    hp: 100,
    energy: 0,
    side,
    dir: side === 1 ? 1 : -1,
    guard: false,
    attackFrame: 0,
    attackCooldown: 0,
    projectileCooldown: 0,
    hitStun: 0,
    invuln: 0,
    charge: 0,
    charging: false,
    flash: 0,
  };
}

let p1 = makeFighter(210, 1);
let p2 = makeFighter(1000, 2);

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function rectOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function announce(text, ms = 700) {
  ui.announcement.textContent = text;
  clearTimeout(announce.timeout);
  announce.timeout = setTimeout(() => {
    ui.announcement.textContent = '';
  }, ms);
}

function tone(freq = 220, duration = 0.06) {
  if (!soundOn) return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ac = new AudioCtx();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.frequency.value = freq;
    gain.gain.value = 0.045;
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
    osc.stop(ac.currentTime + duration);
  } catch (_) {
    // Sound is optional; the game must still work when WebAudio is blocked.
  }
}

function syncUI() {
  ui.p1Hp.style.width = `${p1.hp}%`;
  ui.p2Hp.style.width = `${p2.hp}%`;
  ui.p1Energy.style.width = `${p1.energy}%`;
  ui.p2Energy.style.width = `${p2.energy}%`;
  ui.p1Power.textContent = `${Math.round(p1.energy)}%`;
  ui.p2Power.textContent = `${Math.round(p2.energy)}%`;
  ui.timer.textContent = Math.max(0, Math.ceil(timer));
  ui.roundLabel.textContent = `ROUND ${round}`;
  ui.p1Wins.className = p1Wins ? 'won' : '';
  ui.p2Wins.className = p2Wins ? 'won' : '';
}

function resetRound() {
  p1 = makeFighter(210, 1);
  p2 = makeFighter(1000, 2);
  projectiles.length = 0;
  effects.length = 0;
  stationary = null;
  timer = CONFIG.roundSeconds;
  roundOver = false;
  announce(`ROUND ${round}`, 900);
  syncUI();
}

function frontLevel(charge) {
  if (charge < 28) return 1;
  if (charge < 65) return 2;
  return 3;
}

function projectileStats(type, level) {
  const base = {
    speed: 6.2 + level * 1.25,
    radius: 18 + level * 7,
    damage: 6 + level * 4,
  };

  if (type === 'cold') base.speed *= 1.08;
  if (type === 'warm') base.radius *= 1.08;
  return base;
}

function fireFront(player, type) {
  if (player.projectileCooldown > 0 || player.hitStun > 0) {
    player.charge = 0;
    player.charging = false;
    return;
  }

  const level = frontLevel(player.charge);
  const stats = projectileStats(type, level);
  const dir = player.dir;

  projectiles.push({
    x: player.x + (dir > 0 ? player.w + 16 : -16),
    y: player.y + 38,
    vx: dir * stats.speed,
    side: player.side,
    type,
    level,
    r: stats.radius,
    damage: stats.damage,
    life: 210,
  });

  player.energy = clamp(player.energy + 8 + level * 3, 0, 100);
  player.projectileCooldown = 22;
  player.charge = 0;
  player.charging = false;
  tone(type === 'cold' ? 180 : 300, 0.08);
}

function takeHit(target, damage, dir, knockback = 5.2) {
  if (target.invuln > 0) return false;

  const guardMultiplier = target.guard ? 0.35 : 1;
  target.hp = clamp(target.hp - damage * guardMultiplier, 0, 100);
  target.vx += dir * knockback * guardMultiplier;
  target.vy -= target.guard ? 0 : 1.8;
  target.hitStun = target.guard ? 6 : 12;
  target.invuln = 8;
  target.flash = 7;

  effects.push({
    x: target.x + target.w / 2,
    y: target.y + 44,
    life: 24,
    kind: target.side === 1 ? 'warm' : 'cold',
  });

  tone(target.guard ? 125 : 88, 0.08);
  return true;
}

function updateFacing() {
  p1.dir = p1.x + p1.w / 2 <= p2.x + p2.w / 2 ? 1 : -1;
  p2.dir = -p1.dir;
}

function resolveFighterCollision() {
  if (!rectOverlap(p1, p2)) return;

  const p1Center = p1.x + p1.w / 2;
  const p2Center = p2.x + p2.w / 2;
  const overlapX = p1Center < p2Center
    ? p1.x + p1.w - p2.x
    : p2.x + p2.w - p1.x;

  if (overlapX <= 0) return;
  const push = overlapX / 2 + 0.5;

  if (p1Center < p2Center) {
    p1.x -= push;
    p2.x += push;
  } else {
    p1.x += push;
    p2.x -= push;
  }

  p1.x = clamp(p1.x, 24, W - 24 - p1.w);
  p2.x = clamp(p2.x, 24, W - 24 - p2.w);
}

function updatePlayer(player, controls, frontType) {
  const foe = player.side === 1 ? p2 : p1;

  if (player.hitStun > 0) {
    player.hitStun--;
    player.guard = false;
  } else {
    player.guard = Boolean(keys[controls.guard]);

    if (!player.guard) {
      if (keys[controls.left]) player.vx -= CONFIG.acceleration;
      if (keys[controls.right]) player.vx += CONFIG.acceleration;
    }

    if (keys[controls.jump] && player.y >= ground - player.h - 0.5) {
      player.vy = -CONFIG.jumpSpeed;
      tone(150, 0.03);
    }

    if (keys[controls.attack] && player.attackCooldown <= 0) {
      player.attackFrame = 16;
      player.attackCooldown = 22;
    }

    if (keys[controls.shoot]) {
      player.charging = true;
      player.charge = clamp(player.charge + 0.95, 0, 100);
      player.energy = clamp(player.energy + 0.035, 0, 100);
    } else if (player.charging) {
      fireFront(player, frontType);
    }
  }

  player.vx = clamp(player.vx, -CONFIG.maxSpeed, CONFIG.maxSpeed);
  player.vx *= CONFIG.friction;
  player.vy += CONFIG.gravity;
  player.x += player.vx;
  player.y += player.vy;

  if (player.y > ground - player.h) {
    player.y = ground - player.h;
    player.vy = 0;
  }

  player.x = clamp(player.x, 24, W - 24 - player.w);

  if (player.attackFrame > 0) {
    player.attackFrame--;
    if (player.attackFrame === 8) {
      const hitbox = {
        x: player.dir > 0 ? player.x + player.w - 2 : player.x - 56,
        y: player.y + 18,
        w: 58,
        h: 64,
      };
      if (rectOverlap(hitbox, foe) && takeHit(foe, 6, player.dir, 5.7)) {
        player.energy = clamp(player.energy + 7, 0, 100);
      }
    }
  }

  if (player.attackCooldown > 0) player.attackCooldown--;
  if (player.projectileCooldown > 0) player.projectileCooldown--;
  if (player.invuln > 0) player.invuln--;
  if (player.flash > 0) player.flash--;
}

function spawnStationaryFront(a, b) {
  stationary = {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    life: CONFIG.stationaryLife,
    width: 220,
  };
  a.life = 0;
  b.life = 0;
  announce('滯留鋒！勢均力敵', 1200);
  tone(420, 0.2);
}

function resolveFrontClash(a, b) {
  if (a.level === b.level) {
    spawnStationaryFront(a, b);
    return;
  }

  const strong = a.level > b.level ? a : b;
  const weak = strong === a ? b : a;
  weak.life = 0;

  strong.level -= 1;
  const stats = projectileStats(strong.type, strong.level);
  strong.r = stats.radius;
  strong.damage = stats.damage;
  strong.vx = Math.sign(strong.vx) * stats.speed;

  announce(`${strong.type === 'cold' ? '冷鋒' : '暖鋒'}突破！`, 700);
  tone(strong.type === 'cold' ? 210 : 330, 0.09);
}

function stationaryFrontStep() {
  if (!stationary) return;

  stationary.life--;
  if (stationary.life <= 0) {
    stationary = null;
    return;
  }

  for (const player of [p1, p2]) {
    const center = player.x + player.w / 2;
    if (Math.abs(center - stationary.x) < stationary.width / 2) {
      player.vx *= 0.94;
    }
  }
}

function projectileStep() {
  for (const projectile of projectiles) {
    if (projectile.life <= 0) continue;
    projectile.x += projectile.vx;
    projectile.life--;

    const foe = projectile.side === 1 ? p2 : p1;
    const hitbox = {
      x: projectile.x - projectile.r,
      y: projectile.y - projectile.r,
      w: projectile.r * 2,
      h: projectile.r * 2,
    };

    if (rectOverlap(hitbox, foe)) {
      if (takeHit(foe, projectile.damage, Math.sign(projectile.vx), 5.2 + projectile.level)) {
        projectile.life = 0;
      }
    }
  }

  for (let i = 0; i < projectiles.length; i++) {
    for (let j = i + 1; j < projectiles.length; j++) {
      const a = projectiles[i];
      const b = projectiles[j];
      if (a.side === b.side || a.life <= 0 || b.life <= 0) continue;
      if (Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r) {
        resolveFrontClash(a, b);
      }
    }
  }

  for (let i = projectiles.length - 1; i >= 0; i--) {
    const q = projectiles[i];
    if (q.life <= 0 || q.x < -120 || q.x > W + 120) projectiles.splice(i, 1);
  }

  for (const effect of effects) effect.life--;
  for (let i = effects.length - 1; i >= 0; i--) {
    if (effects[i].life <= 0) effects.splice(i, 1);
  }

  stationaryFrontStep();
}

function finishRound() {
  if (roundOver) return;
  if (timer > 0 && p1.hp > 0 && p2.hp > 0) return;

  roundOver = true;
  const winner = p1.hp === p2.hp ? 0 : p1.hp > p2.hp ? 1 : 2;
  if (winner === 1) p1Wins++;
  if (winner === 2) p2Wins++;

  announce(winner ? `PLAYER ${winner} WIN!` : 'DRAW!', 1400);
  syncUI();

  setTimeout(() => {
    if (p1Wins >= CONFIG.roundsToWin || p2Wins >= CONFIG.roundsToWin) {
      running = false;
      const p1Won = p1Wins > p2Wins;
      document.getElementById('winnerTitle').textContent = `${p1Won ? '寒潮・藍鋒' : '暖流・赤鋒'} 勝利！`;
      document.getElementById('winnerText').textContent =
        `最終比分 ${p1Wins}：${p2Wins}。冷鋒與暖鋒勢力相當時，鋒面會移動緩慢，遊戲中就會形成滯留鋒雨區。`;
      document.getElementById('endOverlay').classList.add('active');
    } else {
      round++;
      resetRound();
    }
  }, 1500);
}

function update(dt) {
  if (!running || roundOver) return;

  timer -= dt / 1000;
  updateFacing();

  updatePlayer(
    p1,
    { left: 'a', right: 'd', jump: 'w', guard: 's', attack: 'f', shoot: 'g' },
    'cold',
  );

  updatePlayer(
    p2,
    { left: 'ArrowLeft', right: 'ArrowRight', jump: 'ArrowUp', guard: 'ArrowDown', attack: 'j', shoot: 'k' },
    'warm',
  );

  resolveFighterCollision();
  updateFacing();
  projectileStep();
  finishRound();
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
  ctx.scale(dir * scale, scale);
  ctx.lineWidth = 5;
  ctx.strokeStyle = type === 'cold' ? '#16a9ff' : '#ff4a36';
  ctx.fillStyle = ctx.strokeStyle;
  ctx.beginPath();
  ctx.moveTo(-34, 0);
  ctx.lineTo(34, 0);
  ctx.stroke();

  for (let i = -20; i <= 20; i += 20) {
    ctx.beginPath();
    if (type === 'cold') {
      ctx.moveTo(i, -1);
      ctx.lineTo(i + 8, 13);
      ctx.lineTo(i + 16, -1);
    } else {
      ctx.arc(i + 8, 0, 8, Math.PI, 0);
    }
    ctx.fill();
  }
  ctx.restore();
}

function drawFighter(player, primary, secondary, label) {
  ctx.save();
  ctx.translate(player.x, player.y);
  if (player.flash > 0 && player.flash % 2 === 1) ctx.globalAlpha = 0.45;

  ctx.fillStyle = '#0007';
  ctx.beginPath();
  ctx.ellipse(player.w / 2, player.h + 5, 42, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#06111f';
  ctx.fillRect(8, 18, player.w - 16, player.h - 18);
  ctx.fillStyle = primary;
  ctx.fillRect(12, 22, player.w - 24, 34);
  ctx.fillStyle = secondary;
  ctx.fillRect(17, 60, player.w - 34, 42);

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 28px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(label, player.w / 2, 49);

  ctx.fillStyle = player.guard ? '#ffe56a' : '#d7e8ff';
  ctx.fillRect(player.dir > 0 ? player.w - 4 : -10, 48, 14, 42);

  if (player.attackFrame > 0) {
    ctx.fillStyle = primary;
    ctx.fillRect(player.dir > 0 ? player.w : -34, 38, 34, 14);
  }

  if (player.charging) {
    const level = frontLevel(player.charge);
    ctx.strokeStyle = primary;
    ctx.lineWidth = 4;
    for (let ring = 0; ring < level; ring++) {
      ctx.beginPath();
      ctx.arc(player.w / 2, 55, 42 + ring * 9 + player.charge * 0.08, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawTaiwanSilhouette() {
  ctx.save();
  ctx.translate(650, 338);
  ctx.rotate(-0.22);
  ctx.fillStyle = '#9bb4bf22';
  ctx.strokeStyle = '#d6edf055';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -73);
  ctx.bezierCurveTo(17, -47, 20, -22, 10, 2);
  ctx.bezierCurveTo(3, 24, 11, 45, -7, 72);
  ctx.bezierCurveTo(-25, 48, -24, 16, -17, -8);
  ctx.bezierCurveTo(-12, -31, -15, -53, 0, -73);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, H);
  gradient.addColorStop(0, '#102846');
  gradient.addColorStop(0.65, '#31566a');
  gradient.addColorStop(1, '#101820');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = '#8db1c744';
  ctx.lineWidth = 2;
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    ctx.ellipse(640, 290, 250 + i * 70, 80 + i * 38, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  drawTaiwanSilhouette();

  ctx.fillStyle = '#0e2433';
  ctx.fillRect(0, ground, W, H - ground);
  line(0, ground, W, ground, '#d3e3ef', 3);

  ctx.fillStyle = '#bcd5e755';
  for (let x = 60; x < W; x += 160) {
    for (let y = 70; y < ground; y += 115) {
      ctx.beginPath();
      ctx.arc(x + (y % 2) * 1.8, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.fillStyle = '#ffffff99';
  ctx.font = '18px monospace';
  ctx.fillText('1020', 170, 150);
  ctx.fillText('1016', 1030, 155);
  ctx.fillText('1012', 590, 245);
  ctx.fillText('1008', 910, 355);
}

function drawStationaryFront() {
  if (!stationary) return;

  const intensity = clamp(stationary.life / CONFIG.stationaryLife, 0.2, 1);
  ctx.save();
  ctx.globalAlpha = 0.28 + intensity * 0.25;
  ctx.fillStyle = '#7bc7ff';
  ctx.fillRect(stationary.x - stationary.width / 2, stationary.y - 140, stationary.width, ground - stationary.y + 140);

  for (let y = stationary.y - 110; y < ground; y += 28) {
    ctx.strokeStyle = '#b9e9ff';
    ctx.lineWidth = 2;
    for (let x = stationary.x - 80; x <= stationary.x + 80; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 8, y + 18);
      ctx.stroke();
    }
  }
  ctx.restore();

  for (let i = -2; i <= 2; i++) {
    const x = stationary.x + i * 38;
    const cold = i % 2 === 0;
    drawFrontSymbol(x, stationary.y, cold ? 'cold' : 'warm', cold ? 1 : -1, 0.65);
  }
}

function drawProjectiles() {
  for (const q of projectiles) {
    ctx.save();
    ctx.shadowBlur = 18;
    ctx.shadowColor = q.type === 'cold' ? '#1bb8ff' : '#ff5a32';
    drawFrontSymbol(q.x, q.y, q.type, Math.sign(q.vx), 0.7 + q.level * 0.18);
    ctx.restore();
  }
}

function drawEffects() {
  for (const effect of effects) {
    ctx.save();
    ctx.globalAlpha = effect.life / 24;
    ctx.fillStyle = effect.kind === 'cold' ? '#74dfff' : '#ff8c63';
    ctx.beginPath();
    ctx.arc(effect.x, effect.y, (25 - effect.life) * 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function draw() {
  drawBackground();
  drawStationaryFront();
  drawProjectiles();
  drawEffects();
  drawFighter(p1, '#0aa7ff', '#b8e9ff', 'H');
  drawFighter(p2, '#ff4c38', '#ffd08b', 'L');
}

function loop(ts) {
  const dt = Math.min(33, ts - last || 16);
  last = ts;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function keyName(event) {
  return event.key.length === 1 ? event.key.toLowerCase() : event.key;
}

window.addEventListener('keydown', (event) => {
  keys[keyName(event)] = true;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(event.key)) {
    event.preventDefault();
  }
});

window.addEventListener('keyup', (event) => {
  keys[keyName(event)] = false;
});

window.addEventListener('blur', () => {
  for (const key of Object.keys(keys)) keys[key] = false;
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

document.getElementById('helpBtn').onclick = () => {
  document.getElementById('helpDialog').showModal();
};

document.getElementById('soundBtn').onclick = (event) => {
  soundOn = !soundOn;
  event.currentTarget.textContent = `♪ 音效：${soundOn ? '開' : '關'}`;
};

requestAnimationFrame(loop);
syncUI();
