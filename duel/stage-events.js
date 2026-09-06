'use strict';

// v0.5 stage and weather-event layer.
// Loaded after special-skills.js so it can extend the complete v0.4 game.
const v05BaseUpdate = update;
const v05BaseDraw = draw;
const v05BaseDrawBackground = drawBackground;

const STAGES = {
  winter: {
    name: '冬季寒流',
    subtitle: '強烈冷氣團南下',
    rule: '冷鋒速度 +18%，寒潮移動略快；偶有強勁東北季風。',
  },
  meiyu: {
    name: '梅雨季',
    subtitle: '滯留鋒與持續降雨',
    rule: '中央雨帶週期出現，進入雨區移動變慢，鋒面更容易停滯。',
  },
  typhoon: {
    name: '颱風季',
    subtitle: '暖海面、強風與豪雨',
    rule: '週期性陣風橫掃戰場，飛行鋒面會被側風偏轉。',
  },
};

const stageState = {
  current: 'winter',
  weatherClock: 0,
  gust: 0,
  gustDir: 1,
  meiyuBand: 0,
  announcementLock: 0,
  seenProjectiles: new WeakSet(),
};

function setStage(id) {
  if (!STAGES[id]) return;
  stageState.current = id;
  stageState.weatherClock = 0;
  stageState.gust = 0;
  stageState.meiyuBand = 0;
  stageState.seenProjectiles = new WeakSet();

  document.querySelectorAll('[data-stage]').forEach((button) => {
    button.classList.toggle('selected', button.dataset.stage === id);
    button.setAttribute('aria-pressed', button.dataset.stage === id ? 'true' : 'false');
  });

  const label = document.getElementById('stageLabel');
  if (label) label.textContent = `${STAGES[id].name}｜${STAGES[id].subtitle}`;
}

function stageApplyProjectileModifiers() {
  for (const q of projectiles) {
    if (stageState.seenProjectiles.has(q)) continue;
    stageState.seenProjectiles.add(q);

    if (stageState.current === 'winter' && q.type === 'cold') {
      q.vx *= 1.18;
      q.damage *= 1.08;
    }

    if (stageState.current === 'meiyu') {
      q.vx *= 0.93;
      q.life += 18;
    }
  }
}

function stageWinterStep(dt) {
  // Northeast monsoon: intermittent push from NW/NE toward the south-east side of the arena.
  const cycle = stageState.weatherClock % 13;
  const active = cycle > 9.6 && cycle < 11.5;
  if (active) {
    p1.vx += 0.025;
    p2.vx += 0.025;
    for (const q of projectiles) q.vx += 0.012;
  }
}

function stageMeiyuStep(dt) {
  const cycle = stageState.weatherClock % 18;
  stageState.meiyuBand = cycle > 6 && cycle < 14 ? 1 : 0;

  if (!stageState.meiyuBand) return;
  const center = W / 2 + Math.sin(stageState.weatherClock * 0.55) * 90;
  const halfWidth = 170;

  for (const player of [p1, p2]) {
    const cx = player.x + player.w / 2;
    if (Math.abs(cx - center) < halfWidth) {
      player.vx *= 0.965;
      if (player.y < ground - player.h - 2) player.vy *= 0.992;
    }
  }

  for (const q of projectiles) {
    if (Math.abs(q.x - center) < halfWidth) q.vx *= 0.997;
  }

  if (stageState.announcementLock <= 0 && cycle > 6 && cycle < 6.2) {
    announce('🌧 梅雨鋒雨帶形成', 900);
    stageState.announcementLock = 180;
  }
}

function stageTyphoonStep(dt) {
  const cycle = stageState.weatherClock % 10;
  const active = cycle > 5.4 && cycle < 7.7;

  if (active) {
    if (stageState.gust <= 0) {
      stageState.gustDir = Math.sin(stageState.weatherClock * 2.1) >= 0 ? 1 : -1;
      stageState.gust = 95;
      if (stageState.announcementLock <= 0) {
        announce(stageState.gustDir > 0 ? '💨 強陣風 →' : '💨 ← 強陣風', 650);
        stageState.announcementLock = 120;
      }
    }
  }

  if (stageState.gust > 0) {
    const force = 0.055 * stageState.gustDir;
    p1.vx += force;
    p2.vx += force;
    for (const q of projectiles) {
      q.x += stageState.gustDir * 0.72;
      q.y += Math.sin(stageState.weatherClock * 5 + q.x * 0.01) * 0.12;
    }
    stageState.gust--;
  }
}

function stageEventsStep(dt) {
  if (!running || roundOver) return;
  stageState.weatherClock += dt / 1000;
  if (stageState.announcementLock > 0) stageState.announcementLock--;

  stageApplyProjectileModifiers();

  if (stageState.current === 'winter') stageWinterStep(dt);
  if (stageState.current === 'meiyu') stageMeiyuStep(dt);
  if (stageState.current === 'typhoon') stageTyphoonStep(dt);
}

window.update = function updateV05(dt) {
  v05BaseUpdate(dt);
  stageEventsStep(dt);
};

function drawStageLabel() {
  const stage = STAGES[stageState.current];
  ctx.save();
  ctx.fillStyle = '#06111fcc';
  ctx.strokeStyle = '#ffffff2f';
  ctx.lineWidth = 2;
  ctx.fillRect(28, 24, 330, 58);
  ctx.strokeRect(28, 24, 330, 58);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 21px monospace';
  ctx.fillText(stage.name, 44, 49);
  ctx.fillStyle = '#b7cbe3';
  ctx.font = '14px monospace';
  ctx.fillText(stage.subtitle, 44, 70);
  ctx.restore();
}

function drawWinterWeather() {
  const cycle = stageState.weatherClock % 13;
  const active = cycle > 9.6 && cycle < 11.5;

  ctx.save();
  ctx.fillStyle = '#6fd9ff12';
  ctx.fillRect(0, 0, W, ground);

  // Cold-air arrows entering from the north-west.
  ctx.globalAlpha = active ? 0.48 : 0.16;
  ctx.strokeStyle = '#83e6ff';
  ctx.lineWidth = 4;
  for (let y = 120; y < 420; y += 90) {
    const drift = (performance.now() / 9 + y * 3) % 340;
    const x = -80 + drift;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 64, y + 28);
    ctx.lineTo(x + 47, y + 30);
    ctx.moveTo(x + 64, y + 28);
    ctx.lineTo(x + 55, y + 12);
    ctx.stroke();
  }
  ctx.restore();
}

function drawMeiyuWeather() {
  const center = W / 2 + Math.sin(stageState.weatherClock * 0.55) * 90;
  ctx.save();
  ctx.fillStyle = '#bcc9d41a';
  ctx.fillRect(0, 0, W, ground);

  if (stageState.meiyuBand) {
    ctx.fillStyle = '#85c8e52b';
    ctx.fillRect(center - 170, 0, 340, ground);
    ctx.strokeStyle = '#a9e4ff99';
    ctx.lineWidth = 2;
    for (let x = center - 150; x <= center + 150; x += 28) {
      const offset = (performance.now() / 7 + x) % 45;
      for (let y = -30 + offset; y < ground; y += 45) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 9, y + 21);
        ctx.stroke();
      }
    }

    // Alternating red/blue stationary-front symbols through the rain band.
    for (let i = -3; i <= 3; i++) {
      const cold = i % 2 === 0;
      drawFrontSymbol(center + i * 42, 205, cold ? 'cold' : 'warm', cold ? 1 : -1, 0.58);
    }
  }
  ctx.restore();
}

function drawTyphoonSeasonWeather() {
  ctx.save();
  ctx.fillStyle = '#3b53681c';
  ctx.fillRect(0, 0, W, ground);

  // Heavy rain across the arena.
  ctx.strokeStyle = '#8adfff77';
  ctx.lineWidth = 2;
  const now = performance.now() / 6;
  for (let x = 20; x < W; x += 38) {
    const offset = (now + x * 2.7) % 70;
    for (let y = -50 + offset; y < ground; y += 70) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 13, y + 27);
      ctx.stroke();
    }
  }

  if (stageState.gust > 0) {
    ctx.globalAlpha = 0.36;
    ctx.strokeStyle = '#e6f8ff';
    ctx.lineWidth = 5;
    for (let y = 110; y < 500; y += 78) {
      const x0 = stageState.gustDir > 0 ? 20 : W - 20;
      const x1 = stageState.gustDir > 0 ? 280 : W - 280;
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.quadraticCurveTo((x0 + x1) / 2, y - 18, x1, y + 6);
      ctx.stroke();
    }
  }
  ctx.restore();
}

window.drawBackground = function drawStageBackground() {
  v05BaseDrawBackground();
  if (stageState.current === 'winter') drawWinterWeather();
  if (stageState.current === 'meiyu') drawMeiyuWeather();
  if (stageState.current === 'typhoon') drawTyphoonSeasonWeather();
  drawStageLabel();
};

window.draw = function drawV05() {
  v05BaseDraw();
};

document.querySelectorAll('[data-stage]').forEach((button) => {
  button.addEventListener('click', () => setStage(button.dataset.stage));
});

setStage('winter');
