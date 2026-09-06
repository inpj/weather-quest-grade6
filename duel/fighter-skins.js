'use strict';

// v0.3 visual skin layer. It intentionally leaves the combat engine in game.js untouched,
// so future sprite sheets can replace these SVGs without rewriting physics or collision logic.
const fighterArt = {
  1: new Image(),
  2: new Image(),
};
fighterArt[1].src = './assets/cold-fighter.svg';
fighterArt[2].src = './assets/warm-fighter.svg';

function drawSkinAura(player, primary) {
  const cx = player.w / 2;
  const cy = player.h / 2;
  const moving = Math.abs(player.vx) > 1.2;
  const airborne = player.y < ground - player.h - 2;
  const pulse = 1 + Math.sin(performance.now() / 120 + player.side) * 0.08;

  ctx.save();
  ctx.globalAlpha = player.charging ? 0.48 : moving || airborne ? 0.22 : 0.12;
  ctx.strokeStyle = primary;
  ctx.lineWidth = player.charging ? 6 : 3;
  ctx.beginPath();
  ctx.ellipse(cx, cy, (44 + player.charge * 0.12) * pulse, (66 + player.charge * 0.08) * pulse, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawChargeParticles(player, primary) {
  if (!player.charging) return;
  const count = 4 + frontLevel(player.charge) * 2;
  const now = performance.now() / 180;
  ctx.save();
  ctx.fillStyle = primary;
  ctx.shadowBlur = 12;
  ctx.shadowColor = primary;
  for (let i = 0; i < count; i++) {
    const a = now + i * (Math.PI * 2 / count);
    const radius = 44 + (i % 3) * 8 + player.charge * 0.08;
    const x = player.w / 2 + Math.cos(a) * radius;
    const y = player.h / 2 + Math.sin(a) * radius * 0.72;
    ctx.beginPath();
    ctx.arc(x, y, 3 + (i % 2) * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Override the simple geometric fighter renderer from game.js.
window.drawFighter = function drawFighterSkin(player, primary, secondary, label) {
  const art = fighterArt[player.side];
  const moving = Math.abs(player.vx) > 1.0;
  const airborne = player.y < ground - player.h - 2;
  const attacking = player.attackFrame > 0;
  const now = performance.now();

  ctx.save();
  ctx.translate(player.x, player.y);

  // Ground shadow.
  ctx.save();
  ctx.globalAlpha = airborne ? 0.12 : 0.28;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(player.w / 2, player.h + 5, airborne ? 28 : 42, airborne ? 5 : 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  drawSkinAura(player, primary);

  // Animate using transforms: idle bob, running lean, jump tilt, attack lunge, guard recoil.
  const idleBob = !moving && !airborne ? Math.sin(now / 210 + player.side) * 2.2 : 0;
  const runBob = moving && !airborne ? Math.sin(now / 70) * 3.2 : 0;
  const lean = airborne ? clamp(player.vx * 0.018, -0.10, 0.10) : clamp(player.vx * 0.012, -0.07, 0.07);
  const attackPush = attacking ? Math.sin((16 - player.attackFrame) / 16 * Math.PI) * 11 : 0;
  const guardScale = player.guard ? 0.94 : 1;

  ctx.translate(player.w / 2, player.h / 2 + idleBob + runBob);
  ctx.rotate(lean + (attacking ? player.dir * -0.05 : 0));
  ctx.scale(player.dir * guardScale, guardScale);
  ctx.translate(-player.w / 2 + attackPush, -player.h / 2);

  if (player.flash > 0 && player.flash % 2 === 1) ctx.globalAlpha = 0.4;

  if (art.complete && art.naturalWidth > 0) {
    // Crop the tall character art into the collision body's visual footprint.
    const drawW = 118;
    const drawH = 161;
    ctx.drawImage(art, player.w / 2 - drawW / 2, -45, drawW, drawH);
  } else {
    // Safe fallback if image loading is delayed or blocked.
    ctx.fillStyle = primary;
    ctx.fillRect(8, 18, player.w - 16, player.h - 18);
    ctx.fillStyle = secondary;
    ctx.fillRect(17, 60, player.w - 34, 42);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(label, player.w / 2, 49);
  }

  ctx.restore();
  drawChargeParticles(player, primary);

  // Attack streak is intentionally separate from the character art for a punchier LF2-like hit read.
  if (attacking) {
    ctx.save();
    ctx.globalAlpha = player.attackFrame / 16;
    ctx.strokeStyle = primary;
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    const y = 48;
    if (player.dir > 0) {
      ctx.moveTo(player.w - 8, y);
      ctx.lineTo(player.w + 48, y - 7);
    } else {
      ctx.moveTo(8, y);
      ctx.lineTo(-48, y - 7);
    }
    ctx.stroke();
    ctx.restore();
  }

  // Guard shield.
  if (player.guard) {
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = '#ffe56a';
    ctx.lineWidth = 7;
    ctx.beginPath();
    const shieldX = player.dir > 0 ? player.w + 5 : -5;
    ctx.arc(shieldX, 55, 34, -Math.PI / 2, Math.PI / 2, player.dir < 0);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
};
