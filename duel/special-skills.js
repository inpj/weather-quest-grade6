'use strict';

// v0.4 special-skill layer.
// This file extends game.js without replacing the core combat engine.
const v04BaseUpdate = update;
const v04BaseDraw = draw;

const v04State = {
  highShield: 0,
  lowVortex: 0,
  typhoon: null,
  shake: 0,
  koFlash: 0,
  lastP1: p1,
  lastP2: p2,
  prevKeys: Object.create(null),
};

const V04 = {
  specialCost: 35,
  specialLife: 120,
  ultimateCost: 100,
  typhoonLife: 210,
  typhoonRadius: 94,
};

function v04Pressed(key) {
  return Boolean(keys[key]) && !v04State.prevKeys[key];
}

function v04RememberKeys() {
  for (const key of ['h', 'l', 'r', 'i']) v04State.prevKeys[key] = Boolean(keys[key]);
}

function v04ResetTransientState() {
  v04State.highShield = 0;
  v04State.lowVortex = 0;
  v04State.typhoon = null;
  v04State.shake = 0;
  v04State.koFlash = 0;
}

function v04EnergyBurst(player, color) {
  for (let n = 0; n < 18; n++) {
    const a = (Math.PI * 2 * n) / 18;
    effects.push({
      x: player.x + player.w / 2 + Math.cos(a) * 26,
      y: player.y + player.h / 2 + Math.sin(a) * 34,
      life: 24,
      kind: color,
    });
  }
}

function v04ActivateHighPressure() {
  if (p1.energy < V04.specialCost || p1.hitStun > 0) return;
  p1.energy -= V04.specialCost;
  v04State.highShield = V04.specialLife;
  announce('H 高氣壓・下沉護盾！', 900);
  tone(520, 0.16);
  v04EnergyBurst(p1, 'cold');
}

function v04ActivateLowPressure() {
  if (p2.energy < V04.specialCost || p2.hitStun > 0) return;
  p2.energy -= V04.specialCost;
  v04State.lowVortex = V04.specialLife;
  announce('L 低氣壓・氣旋吸引！', 900);
  tone(115, 0.18);
  v04EnergyBurst(p2, 'warm');
}

function v04LaunchTyphoon(player) {
  if (player.energy < V04.ultimateCost || player.hitStun > 0 || v04State.typhoon) return;

  player.energy = 0;
  const cx = player.x + player.w / 2;
  const x = clamp(cx + player.dir * 150, 130, W - 130);
  const y = 360;

  v04State.typhoon = {
    owner: player.side,
    x,
    y,
    vx: player.dir * 1.25,
    life: V04.typhoonLife,
    hitTick: 0,
    radius: V04.typhoonRadius,
  };

  v04State.shake = 14;
  announce('🌀 TYPHOON ULTIMATE！', 1200);
  tone(70, 0.32);
}

function v04HighPressureStep() {
  if (v04State.highShield <= 0) return;
  v04State.highShield--;

  const cx = p1.x + p1.w / 2;
  const cy = p1.y + p1.h / 2;

  // High pressure is represented as diverging air: incoming fronts are pushed outward.
  for (const q of projectiles) {
    if (q.life <= 0 || q.side === 1) continue;
    const d = Math.hypot(q.x - cx, q.y - cy);
    if (d < 118) {
      q.vx = Math.sign(q.x - cx || -p1.dir) * Math.max(Math.abs(q.vx), 7.5);
      q.x += Math.sign(q.x - cx || -p1.dir) * 8;
      q.damage *= 0.72;
      if (q.level > 1) q.level--;
    }
  }

  // The shield also softens knockback while active.
  p1.vx *= 0.90;
}

function v04LowPressureStep() {
  if (v04State.lowVortex <= 0) return;
  v04State.lowVortex--;

  const cx = p2.x + p2.w / 2;
  const cy = p2.y + p2.h / 2;
  const foeX = p1.x + p1.w / 2;
  const foeY = p1.y + p1.h / 2;
  const dx = cx - foeX;
  const dy = cy - foeY;
  const dist = Math.max(1, Math.hypot(dx, dy));

  // Low pressure is represented as surface convergence toward the center.
  if (dist < 430) {
    const pull = 0.42 * (1 - dist / 520);
    p1.vx += (dx / dist) * pull;
    if (p1.y < ground - p1.h - 2) p1.vy += (dy / dist) * pull * 0.18;
  }

  for (const q of projectiles) {
    if (q.life <= 0) continue;
    const qdx = cx - q.x;
    const qdy = cy - q.y;
    const qdist = Math.max(1, Math.hypot(qdx, qdy));
    if (qdist < 280) {
      q.x += (qdx / qdist) * 1.25;
      q.y += (qdy / qdist) * 0.45;
    }
  }
}

function v04TyphoonStep() {
  const t = v04State.typhoon;
  if (!t) return;

  t.life--;
  t.hitTick++;
  t.x += t.vx;

  if (t.x < 95 || t.x > W - 95) t.vx *= -1;

  const foe = t.owner === 1 ? p2 : p1;
  const foeX = foe.x + foe.w / 2;
  const foeY = foe.y + foe.h / 2;
  const dx = t.x - foeX;
  const dy = t.y - foeY;
  const dist = Math.max(1, Math.hypot(dx, dy));

  if (dist < 260) {
    const pull = 0.62 * (1 - dist / 300);
    foe.vx += (dx / dist) * pull;
    foe.vy += (dy / dist) * pull * 0.12;
  }

  if (dist < t.radius + 34 && t.hitTick % 14 === 0) {
    takeHit(foe, 2.4, Math.sign(foeX - t.x) || 1, 2.1);
    v04State.shake = Math.max(v04State.shake, 5);
  }

  // Fronts entering the cyclone curve around its circulation.
  for (const q of projectiles) {
    if (q.life <= 0) continue;
    const qdx = q.x - t.x;
    const qdy = q.y - t.y;
    const qdist = Math.max(1, Math.hypot(qdx, qdy));
    if (qdist < 200) {
      const swirl = t.owner === 1 ? 0.85 : -0.85;
      q.x += (-qdy / qdist) * swirl;
      q.y += (qdx / qdist) * swirl;
    }
  }

  if (t.life <= 0) v04State.typhoon = null;
}

function v04HandleSkills() {
  if (v04Pressed('h')) v04ActivateHighPressure();
  if (v04Pressed('l')) v04ActivateLowPressure();
  if (v04Pressed('r')) v04LaunchTyphoon(p1);
  if (v04Pressed('i')) v04LaunchTyphoon(p2);
}

function v04CheckRoundReset() {
  if (p1 !== v04State.lastP1 || p2 !== v04State.lastP2) {
    v04State.lastP1 = p1;
    v04State.lastP2 = p2;
    v04ResetTransientState();
  }
}

window.update = function updateV04(dt) {
  const wasRoundOver = roundOver;
  v04BaseUpdate(dt);
  v04CheckRoundReset();

  if (running && !roundOver) {
    v04HandleSkills();
    v04HighPressureStep();
    v04LowPressureStep();
    v04TyphoonStep();
  }

  if (!wasRoundOver && roundOver && (p1.hp <= 0 || p2.hp <= 0)) {
    v04State.shake = 20;
    v04State.koFlash = 68;
    announce('K.O.!', 850);
    tone(52, 0.36);
  }

  if (v04State.shake > 0) v04State.shake *= 0.86;
  if (v04State.koFlash > 0) v04State.koFlash--;

  // Make MAX energy obvious without changing the existing HUD layout.
  ui.p1Power.textContent = p1.energy >= 99.5 ? 'MAX' : `${Math.round(p1.energy)}%`;
  ui.p2Power.textContent = p2.energy >= 99.5 ? 'MAX' : `${Math.round(p2.energy)}%`;
  ui.p1Power.style.textShadow = p1.energy >= 99.5 ? '0 0 10px #ffe56a' : '';
  ui.p2Power.style.textShadow = p2.energy >= 99.5 ? '0 0 10px #ffe56a' : '';

  v04RememberKeys();
};

function v04DrawHighPressure() {
  if (v04State.highShield <= 0) return;
  const cx = p1.x + p1.w / 2;
  const cy = p1.y + p1.h / 2;
  const pulse = 1 + Math.sin(performance.now() / 90) * 0.05;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = '#75dcff';
  ctx.shadowColor = '#75dcff';
  ctx.shadowBlur = 18;
  ctx.lineWidth = 5;
  ctx.globalAlpha = 0.72;
  for (let r = 65; r <= 105; r += 20) {
    ctx.beginPath();
    ctx.arc(0, 0, r * pulse, 0, Math.PI * 2);
    ctx.stroke();
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
      const x1 = Math.cos(a) * (r - 8);
      const y1 = Math.sin(a) * (r - 8);
      const x2 = Math.cos(a) * (r + 10);
      const y2 = Math.sin(a) * (r + 10);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }
  ctx.fillStyle = '#e9fbff';
  ctx.font = 'bold 32px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('H', 0, 10);
  ctx.restore();
}

function v04DrawLowPressure() {
  if (v04State.lowVortex <= 0) return;
  const cx = p2.x + p2.w / 2;
  const cy = p2.y + p2.h / 2;
  const now = performance.now() / 180;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = '#ff806f';
  ctx.shadowColor = '#ff4b38';
  ctx.shadowBlur = 16;
  ctx.lineWidth = 5;
  ctx.globalAlpha = 0.78;

  for (let arm = 0; arm < 3; arm++) {
    ctx.beginPath();
    for (let s = 0; s < 46; s++) {
      const a = now + arm * Math.PI * 2 / 3 + s * 0.17;
      const r = 108 - s * 2;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r * 0.66;
      if (s === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  ctx.fillStyle = '#fff3e7';
  ctx.font = 'bold 32px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('L', 0, 10);
  ctx.restore();
}

function v04DrawTyphoon() {
  const t = v04State.typhoon;
  if (!t) return;
  const now = performance.now() / 120;
  const fade = clamp(t.life / 25, 0, 1);

  ctx.save();
  ctx.translate(t.x, t.y);
  ctx.globalAlpha = fade;
  ctx.shadowBlur = 22;
  ctx.shadowColor = '#d7f6ff';

  for (let arm = 0; arm < 5; arm++) {
    ctx.strokeStyle = arm % 2 ? '#b7edff' : '#ffffff';
    ctx.lineWidth = 7 - arm * 0.6;
    ctx.beginPath();
    for (let s = 0; s < 56; s++) {
      const a = now * (t.owner === 1 ? 1 : -1) + arm * Math.PI * 2 / 5 + s * 0.15;
      const r = 12 + s * 1.65;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r * 0.72;
      if (s === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  ctx.fillStyle = '#07101f';
  ctx.beginPath();
  ctx.ellipse(0, 0, 18, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Rain bands.
  ctx.globalAlpha *= 0.55;
  ctx.strokeStyle = '#77dcff';
  ctx.lineWidth = 2;
  for (let x = -90; x <= 90; x += 22) {
    const offset = (performance.now() / 8 + x * 3) % 55;
    for (let y = -85 + offset; y < 105; y += 55) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 8, y + 18);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function v04DrawKO() {
  if (v04State.koFlash <= 0) return;
  const alpha = clamp(v04State.koFlash / 22, 0, 1);
  ctx.save();
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.fillStyle = '#0008';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffe56a';
  ctx.strokeStyle = '#1b0d00';
  ctx.lineWidth = 12;
  ctx.font = '1000 150px Impact, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeText('K.O.!', W / 2, H / 2 - 20);
  ctx.fillText('K.O.!', W / 2, H / 2 - 20);
  ctx.restore();
}

window.draw = function drawV04() {
  const shake = v04State.shake > 0.5 ? v04State.shake : 0;
  ctx.save();
  if (shake) {
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  }
  v04BaseDraw();
  v04DrawHighPressure();
  v04DrawLowPressure();
  v04DrawTyphoon();
  ctx.restore();
  v04DrawKO();
};
