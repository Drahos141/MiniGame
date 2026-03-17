// ===================== POLICE CHASE GAME v2 =====================
// 3× bigger road, car selection, 10 levels, nitro, rockets, power-ups.

const canvas = document.getElementById('chase-canvas');
const ctx    = canvas.getContext('2d');

// ── Canvas dimensions (3× bigger game board) ──
const W = 900;
const H = 900;
canvas.width  = W;
canvas.height = H;

// ── Multiplayer ──
const playerCount    = parseInt(localStorage.getItem('miniGamePlayers') || '1', 10);
let   mpCurrentPlayer = 0;
let   mpScores        = Array(playerCount).fill(0);

function updatePlayerBanner() {
  const banner = document.getElementById('chase-player-banner');
  if (playerCount > 1 && banner) {
    const icons = ['🟡', '🔵', '🔴', '🟢'];
    banner.textContent = `${icons[mpCurrentPlayer]} Player ${mpCurrentPlayer + 1}'s Round`;
    banner.classList.remove('hidden');
  }
}

// ── Car Definitions (3 cars with different stats) ──
const CAR_DEFS = [
  {
    id: 0,
    name: 'Speedster',
    desc: ['⚡ Top Speed: ★★★★★', '🚀 Rockets:  ★★☆☆☆', '🛡 Shield:   none', '⛽ Nitro:    fast burst'],
    bodyColor: '#ffe033',
    maxV: 8.5,
    accel: 0.55,
    nitroPower: 6,
    nitroFrames: 110,
    nitroCooldownMax: 360,
    rocketCount: 3,
    shieldCount: 0,
  },
  {
    id: 1,
    name: 'Cruiser',
    desc: ['⚡ Top Speed: ★★★☆☆', '🚀 Rockets:  ★★★★☆', '🛡 Shield:   ★☆☆', '⛽ Nitro:    medium'],
    bodyColor: '#33aaff',
    maxV: 5.5,
    accel: 0.4,
    nitroPower: 3.5,
    nitroFrames: 140,
    nitroCooldownMax: 280,
    rocketCount: 5,
    shieldCount: 1,
  },
  {
    id: 2,
    name: 'Armored',
    desc: ['⚡ Top Speed: ★★☆☆☆', '🚀 Rockets:  ★★★★★', '🛡 Shield:   ★★☆', '⛽ Nitro:    long'],
    bodyColor: '#cc4444',
    maxV: 3.8,
    accel: 0.3,
    nitroPower: 2.5,
    nitroFrames: 190,
    nitroCooldownMax: 220,
    rocketCount: 8,
    shieldCount: 2,
  },
];

// ── Level Definitions (10 levels) ──
const LEVEL_DEFS = Array.from({ length: 10 }, (_, i) => ({
  level: i + 1,
  baseRoadSpeed: 1.2 + i * 0.25,
  maxRoadSpeed:  4.5 + i * 0.7,
  policeBaseSpeed: 0.4 + i * 0.22,
  policeMaxSpeed:  1.8 + i * 0.35,
  numPolice:     i < 3 ? 1 : i < 7 ? 2 : 3,
  obstacleInterval: Math.max(30, 110 - i * 9),
  coinInterval:     Math.max(18, 55 - i * 3),
}));
const LEVEL_NAMES = ['Rookie','Patrol','Cadet','Officer','Sergeant',
                     'Lieutenant','Captain','Commander','Chief','Commissioner'];

// ── Road / world constants ──
const ROAD_W     = 750;
const ROAD_X     = (W - ROAD_W) / 2;
const LANE_COUNT = 5;
const LANE_W     = ROAD_W / LANE_COUNT;
const STRIPE_H   = 55;
const STRIPE_GAP = 38;
const CAR_W      = 36;
const CAR_H      = 62;
const BULLET_W   = 7;
const BULLET_H   = 18;

// ── Balance constants ──
const MAX_BONUS_ROCKETS        = 4;  // max rockets above car's base count from pickups
const MAX_BONUS_SHIELDS        = 2;  // max shields above car's base count from pickups
const NITRO_FLASH_PERIOD       = 6;  // frames per nitro overlay flash cycle
const NITRO_FLASH_ON           = 3;  // frames the nitro overlay is visible per cycle
const SHIELD_BLINK_PERIOD      = 8;  // frames per shield-hit blink cycle
const SHIELD_BLINK_ON          = 4;  // frames car is visible per cycle
const INVINC_BLINK_PERIOD      = 6;  // frames per invincibility blink cycle
const INVINC_BLINK_ON          = 3;  // frames car is visible per cycle

// ── Game state ──
let gameState   = 'select-car'; // 'select-car'|'select-level'|'playing'|'game-over'
let selectedCar   = 0;
let selectedLevel = 0;
let bestScore   = parseInt(localStorage.getItem('chaseBest') || '0', 10);

let lambo, policeList, barriers, rockets, explosions, collectibles;
let keys, scrollY, score, coins, startTime, gameActive, gameLoop, frameCount;
let nitroActive, nitroFramesLeft, nitroCooldownLeft;
let barrierTimer, coinTimer;

// ── Road speed (px/frame) ──
function roadSpeed() {
  if (!startTime) return LEVEL_DEFS[selectedLevel].baseRoadSpeed;
  const def     = LEVEL_DEFS[selectedLevel];
  const elapsed = (Date.now() - startTime) / 1000;
  return Math.min(def.baseRoadSpeed + elapsed * 0.045, def.maxRoadSpeed);
}

// ── Init game ──
function initGame() {
  const def = CAR_DEFS[selectedCar];
  scrollY           = 0;
  score             = 0;
  coins             = 0;
  frameCount        = 0;
  barrierTimer      = 0;
  coinTimer         = 0;
  barriers          = [];
  rockets           = [];
  explosions        = [];
  collectibles      = [];
  nitroActive       = false;
  nitroFramesLeft   = 0;
  nitroCooldownLeft = 0;
  keys              = {};
  gameActive        = false;
  startTime         = null;

  lambo = {
    x: W / 2 - CAR_W / 2,
    y: H * 0.72,
    vx: 0,
    def,
    rockets: def.rocketCount,
    shield:  def.shieldCount,
    invincFrames: 0,
  };

  const lvl = LEVEL_DEFS[selectedLevel];
  policeList = [];
  for (let i = 0; i < lvl.numPolice; i++) {
    policeList.push({
      x: ROAD_X + (i + 1) * ROAD_W / (lvl.numPolice + 1) - CAR_W / 2,
      y: H * 0.08 + i * 90,
      stunFrames: 0,
    });
  }

  document.getElementById('chase-time').textContent  = '0';
  document.getElementById('chase-speed').textContent = '0';
  document.getElementById('chase-coins').textContent = '0';
  document.getElementById('chase-message').classList.add('hidden');
  cancelAnimationFrame(gameLoop);
}

// ── Start game ──
function startGame() {
  document.getElementById('btn-start-chase').textContent = 'Restart';
  cancelAnimationFrame(gameLoop);
  if (playerCount > 1) {
    mpCurrentPlayer = 0;
    mpScores = Array(playerCount).fill(0);
    updatePlayerBanner();
  }
  initGame();
  startTime  = Date.now();
  gameActive = true;
  gameState  = 'playing';
  loop();
}

// ── Main loop ──
function loop() {
  if (!gameActive) return;
  update();
  render();
  gameLoop = requestAnimationFrame(loop);
}

// ── Update ──
function update() {
  frameCount++;
  const spd = roadSpeed();

  // Nitro timer
  if (nitroActive) {
    nitroFramesLeft--;
    if (nitroFramesLeft <= 0) {
      nitroActive       = false;
      nitroCooldownLeft = lambo.def.nitroCooldownMax;
    }
  } else if (nitroCooldownLeft > 0) {
    nitroCooldownLeft--;
  }

  // Road scroll
  scrollY = (scrollY + spd) % (STRIPE_H + STRIPE_GAP);

  // ── Player control (left/right only) ──
  const def      = lambo.def;
  const maxV     = def.maxV + (nitroActive ? def.nitroPower : 0);
  const accel    = def.accel;
  const friction = 0.82;

  if (keys['ArrowLeft']  || keys['a']) lambo.vx -= accel;
  if (keys['ArrowRight'] || keys['d']) lambo.vx += accel;

  lambo.vx  = Math.max(-maxV, Math.min(maxV, lambo.vx)) * friction;
  lambo.x  += lambo.vx;
  lambo.x   = Math.max(ROAD_X + 4, Math.min(ROAD_X + ROAD_W - CAR_W - 4, lambo.x));

  if (lambo.invincFrames > 0) lambo.invincFrames--;

  // ── Police AI: only moves left/right (no vertical pursuit) ──
  const lvl     = LEVEL_DEFS[selectedLevel];
  const elapsed = (Date.now() - startTime) / 1000;
  policeList.forEach(p => {
    if (p.stunFrames > 0) { p.stunFrames--; return; }
    const pSpd = Math.min(lvl.policeBaseSpeed + elapsed * 0.025, lvl.policeMaxSpeed);
    const dx   = lambo.x - p.x;
    p.x += Math.sign(dx) * Math.min(Math.abs(dx) * 0.15, pSpd);
    p.x  = Math.max(ROAD_X + 4, Math.min(ROAD_X + ROAD_W - CAR_W - 4, p.x));
    // Gentle downward drift with road; wraps back to top to stay visible
    p.y += spd * 0.1;
    if (p.y > H * 0.35) p.y = H * 0.06;
  });

  // ── Spawn / scroll barriers ──
  barrierTimer++;
  if (barrierTimer >= lvl.obstacleInterval) {
    barrierTimer = 0;
    spawnBarrier();
  }
  barriers.forEach(b => { b.y += spd; });
  barriers = barriers.filter(b => b.y < H + 100);

  // ── Spawn / scroll collectibles ──
  coinTimer++;
  if (coinTimer >= lvl.coinInterval) {
    coinTimer = 0;
    spawnCollectible();
  }
  collectibles.forEach(c => { c.y += spd; });
  collectibles = collectibles.filter(c => c.y < H + 60);

  // ── Rockets in flight ──
  rockets.forEach(r => { r.y -= 14; });
  rockets = rockets.filter(r => r.y > -BULLET_H);

  // ── Rocket vs Barrier ──
  for (let ri = rockets.length - 1; ri >= 0; ri--) {
    const r = rockets[ri];
    for (let bi = barriers.length - 1; bi >= 0; bi--) {
      const b = barriers[bi];
      if (rectsOverlap(r.x, r.y, BULLET_W, BULLET_H, b.x, b.y, b.w, b.h)) {
        spawnExplosion(b.x + b.w / 2, b.y + b.h / 2, '#ff6600');
        barriers.splice(bi, 1);
        rockets.splice(ri, 1);
        break;
      }
    }
  }

  // ── Rocket vs Police ──
  for (let ri = rockets.length - 1; ri >= 0; ri--) {
    const r = rockets[ri];
    for (const p of policeList) {
      if (rectsOverlap(r.x, r.y, BULLET_W, BULLET_H, p.x, p.y, CAR_W, CAR_H)) {
        spawnExplosion(p.x + CAR_W / 2, p.y + CAR_H / 2, '#0044ff');
        p.stunFrames = 180;
        rockets.splice(ri, 1);
        break;
      }
    }
  }

  // ── Update explosion particles ──
  explosions.forEach(e => {
    e.particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.life--; });
    e.particles = e.particles.filter(p => p.life > 0);
  });
  explosions = explosions.filter(e => e.particles.length > 0);

  // ── Lambo vs Barrier collision ──
  if (lambo.invincFrames <= 0) {
    for (let bi = barriers.length - 1; bi >= 0; bi--) {
      const b = barriers[bi];
      if (rectsOverlap(lambo.x, lambo.y, CAR_W, CAR_H, b.x, b.y, b.w, b.h)) {
        if (lambo.shield > 0) {
          lambo.shield--;
          lambo.invincFrames = 90;
          spawnExplosion(b.x + b.w / 2, b.y + b.h / 2, '#ffff00');
          barriers.splice(bi, 1);
        } else {
          endGame('barrier');
          return;
        }
        break;
      }
    }
  }

  // ── Lambo vs Police collision ──
  if (lambo.invincFrames <= 0) {
    for (const p of policeList) {
      if (p.stunFrames > 0) continue;
      if (rectsOverlap(lambo.x, lambo.y, CAR_W, CAR_H, p.x, p.y, CAR_W, CAR_H)) {
        if (lambo.shield > 0) {
          lambo.shield--;
          lambo.invincFrames = 90;
          p.stunFrames = 60;
        } else {
          endGame('caught');
          return;
        }
        break;
      }
    }
  }

  // ── Lambo vs Collectibles ──
  collectibles = collectibles.filter(c => {
    if (rectsOverlap(lambo.x, lambo.y, CAR_W, CAR_H,
                     c.x - c.r, c.y - c.r, c.r * 2, c.r * 2)) {
      if      (c.type === 'coin')   coins += c.value;
      else if (c.type === 'rocket') lambo.rockets = Math.min(lambo.rockets + 2, lambo.def.rocketCount + MAX_BONUS_ROCKETS);
      else if (c.type === 'shield') lambo.shield  = Math.min(lambo.shield  + 1, lambo.def.shieldCount + MAX_BONUS_SHIELDS);
      else if (c.type === 'nitro')  nitroCooldownLeft = 0;
      spawnExplosion(c.x, c.y, c.type === 'coin' ? '#ffee00' : '#44ffaa');
      return false;
    }
    return true;
  });

  // ── Score ──
  score = Math.floor((Date.now() - startTime) / 1000);
  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem('chaseBest', bestScore);
  }
  document.getElementById('chase-time').textContent  = score;
  document.getElementById('chase-best').textContent  = bestScore;
  document.getElementById('chase-speed').textContent = Math.round(spd * 10);
  document.getElementById('chase-coins').textContent = coins;
}

function spawnBarrier() {
  const lanes = Array.from({ length: LANE_COUNT }, (_, i) => i);
  // Fisher-Yates shuffle
  for (let i = lanes.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [lanes[i], lanes[j]] = [lanes[j], lanes[i]];
  }
  const lvl      = LEVEL_DEFS[selectedLevel];
  const maxBlock = lvl.numPolice >= 3 ? 3 : lvl.numPolice >= 2 ? 2 : 1;
  const blocked  = Math.min(LANE_COUNT - 2, Math.floor(Math.random() * maxBlock) + 1);
  const types    = ['barrier', 'oil', 'spike'];
  const type     = types[Math.floor(Math.random() * types.length)];
  for (let i = 0; i < blocked; i++) {
    const lane = lanes[i];
    barriers.push({
      x: ROAD_X + lane * LANE_W + LANE_W / 2 - 20,
      y: -70,
      w: 40, h: 22,
      type,
    });
  }
}

function spawnCollectible() {
  const lane = Math.floor(Math.random() * LANE_COUNT);
  const cx   = ROAD_X + lane * LANE_W + LANE_W / 2;
  const r    = Math.random();
  let type, value;
  if      (r < 0.55) { type = 'coin';   value = 10 + Math.floor(Math.random() * 20); }
  else if (r < 0.72) { type = 'rocket'; value = 1; }
  else if (r < 0.86) { type = 'shield'; value = 1; }
  else               { type = 'nitro';  value = 1; }
  collectibles.push({ x: cx, y: -20, r: 14, type, value });
}

function spawnExplosion(x, y, color) {
  const parts = [];
  for (let i = 0; i < 14; i++) {
    const angle = (Math.PI * 2 * i) / 14 + Math.random() * 0.4;
    const speed = 1.5 + Math.random() * 3.5;
    parts.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 22 + Math.floor(Math.random() * 14),
      color,
      size: 2 + Math.random() * 4,
    });
  }
  explosions.push({ particles: parts });
}

function activateNitro() {
  if (!gameActive || nitroActive || nitroCooldownLeft > 0) return;
  nitroActive     = true;
  nitroFramesLeft = lambo.def.nitroFrames;
}

function fireRocket() {
  if (!gameActive || lambo.rockets <= 0) return;
  lambo.rockets--;
  rockets.push({ x: lambo.x + CAR_W / 2 - BULLET_W / 2, y: lambo.y - BULLET_H });
}

// ── Helpers ──
function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}
function shadeColor(hex, amt) {
  const r = Math.max(0, Math.min(255, parseInt(hex.slice(1, 3), 16) + amt));
  const g = Math.max(0, Math.min(255, parseInt(hex.slice(3, 5), 16) + amt));
  const b = Math.max(0, Math.min(255, parseInt(hex.slice(5, 7), 16) + amt));
  return `rgb(${r},${g},${b})`;
}

// ── Render ──
function render() {
  drawRoad(scrollY);
  collectibles.forEach(c => drawCollectible(c));
  barriers.forEach(b => drawBarrier(b));
  rockets.forEach(r => drawRocket(r));
  policeList.forEach(p => drawPoliceAt(p));
  drawLamboAt(lambo);
  explosions.forEach(e => drawExplosion(e));
  drawHUD();
}

function drawRoad(scroll) {
  // Grass sides
  ctx.fillStyle = '#1a2e0a';
  ctx.fillRect(0, 0, W, H);

  // Grass texture dots
  ctx.fillStyle = 'rgba(50,100,20,0.4)';
  for (let gx = 5; gx < ROAD_X - 5; gx += 22) {
    for (let gy = (scroll * 0.3) % 22 - 22; gy < H + 22; gy += 22) {
      ctx.fillRect(gx, gy, 4, 4);
    }
  }
  for (let gx = ROAD_X + ROAD_W + 10; gx < W - 5; gx += 22) {
    for (let gy = (scroll * 0.3) % 22 - 22; gy < H + 22; gy += 22) {
      ctx.fillRect(gx, gy, 4, 4);
    }
  }

  // Road surface
  const roadGrad = ctx.createLinearGradient(ROAD_X, 0, ROAD_X + ROAD_W, 0);
  roadGrad.addColorStop(0,   '#2a2a2a');
  roadGrad.addColorStop(0.5, '#333333');
  roadGrad.addColorStop(1,   '#2a2a2a');
  ctx.fillStyle = roadGrad;
  ctx.fillRect(ROAD_X, 0, ROAD_W, H);

  // Road edges
  ctx.fillStyle = '#e0e0e0';
  ctx.fillRect(ROAD_X,              0, 6, H);
  ctx.fillRect(ROAD_X + ROAD_W - 6, 0, 6, H);

  // Lane dashes
  ctx.fillStyle = '#ffcc00';
  ctx.globalAlpha = 0.55;
  for (let lane = 1; lane < LANE_COUNT; lane++) {
    const lx = ROAD_X + lane * LANE_W - 2;
    for (let y = -STRIPE_H + scroll; y < H + STRIPE_H; y += STRIPE_H + STRIPE_GAP) {
      ctx.fillRect(lx, y, 4, STRIPE_H);
    }
  }
  ctx.globalAlpha = 1;
}

function drawBarrier(b) {
  if (b.type === 'oil') {
    ctx.fillStyle = 'rgba(20,10,40,0.9)';
    ctx.beginPath();
    ctx.ellipse(b.x + b.w / 2, b.y + b.h / 2, b.w / 2 + 5, b.h / 2 + 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(130,60,180,0.55)';
    ctx.beginPath();
    ctx.ellipse(b.x + b.w / 2, b.y + b.h / 2, b.w / 2, b.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (b.type === 'spike') {
    ctx.fillStyle = '#880000';
    ctx.fillRect(b.x, b.y + 8, b.w, 8);
    ctx.fillStyle = '#cc0000';
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(b.x + i * 7,       b.y + 8);
      ctx.lineTo(b.x + i * 7 + 3.5, b.y);
      ctx.lineTo(b.x + i * 7 + 7,   b.y + 8);
      ctx.fill();
    }
  } else {
    // Standard orange/white barrier
    ctx.fillStyle = '#ff6600';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(b.x, b.y + 6,  b.w, 5);
    ctx.fillRect(b.x, b.y + 14, b.w, 5);
  }
}

function drawCollectible(c) {
  ctx.save();
  ctx.translate(c.x, c.y + Math.sin(frameCount * 0.09) * 3);
  ctx.beginPath();
  ctx.arc(0, 0, c.r, 0, Math.PI * 2);
  const palettes = {
    coin:   { fill: '#ffdd00', stroke: '#cc9900' },
    rocket: { fill: '#ff4400', stroke: '#cc2200' },
    shield: { fill: '#4488ff', stroke: '#2255cc' },
    nitro:  { fill: '#44ffaa', stroke: '#00cc77' },
  };
  const pal = palettes[c.type] || palettes.coin;
  ctx.fillStyle   = pal.fill;
  ctx.strokeStyle = pal.stroke;
  ctx.lineWidth   = 2;
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = (c.type === 'coin') ? '#cc9900' : '#fff';
  ctx.font = '14px sans-serif';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  const icons = { coin: '$', rocket: '🚀', shield: '🛡', nitro: '⚡' };
  ctx.fillText(icons[c.type] || '$', 0, 0);
  ctx.restore();
}

function drawRocket(r) {
  ctx.fillStyle = '#ff4400';
  ctx.fillRect(r.x, r.y, BULLET_W, BULLET_H);
  ctx.fillStyle = '#ffaa00';
  ctx.fillRect(r.x + 1, r.y + BULLET_H, BULLET_W - 2, 7);
}

function drawExplosion(e) {
  e.particles.forEach(p => {
    ctx.globalAlpha = Math.max(0, p.life / 36);
    ctx.fillStyle   = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function drawHUD() {
  const hx = ROAD_X + 8;
  const hy = H - 36;

  // Nitro bar background
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(hx, hy, 130, 14);

  let nitroPct;
  if (nitroActive) {
    nitroPct      = nitroFramesLeft / lambo.def.nitroFrames;
    ctx.fillStyle = '#44ffaa';
  } else if (nitroCooldownLeft > 0) {
    nitroPct      = 1 - (nitroCooldownLeft / lambo.def.nitroCooldownMax);
    ctx.fillStyle = '#666';
  } else {
    nitroPct      = 1;
    ctx.fillStyle = '#00ffaa';
  }
  ctx.fillRect(hx, hy, 130 * nitroPct, 14);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth   = 1;
  ctx.strokeRect(hx, hy, 130, 14);

  ctx.fillStyle = '#fff';
  ctx.font      = 'bold 10px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('NITRO', hx + 3, hy + 10);

  // Rockets & shield
  ctx.fillText('🚀 ' + lambo.rockets, hx, hy - 18);
  ctx.fillText('🛡 ' + lambo.shield,  hx + 70, hy - 18);

  // Level indicator
  ctx.textAlign = 'right';
  ctx.fillText('LVL ' + (selectedLevel + 1) + ' — ' + LEVEL_NAMES[selectedLevel],
               ROAD_X + ROAD_W - 8, hy - 18);

  // Nitro flash overlay
  if (nitroActive && frameCount % NITRO_FLASH_PERIOD < NITRO_FLASH_ON) {
    ctx.fillStyle = 'rgba(0,255,170,0.06)';
    ctx.fillRect(0, 0, W, H);
  }
  // Shield blink overlay
  if (lambo && lambo.invincFrames > 0 && frameCount % SHIELD_BLINK_PERIOD < SHIELD_BLINK_ON) {
    ctx.fillStyle = 'rgba(68,136,255,0.14)';
    ctx.fillRect(0, 0, W, H);
  }
}

// ── Draw car body (reusable for previews & live game) ──
function drawCarBody(color, cw, ch) {
  const bodyGrad = ctx.createLinearGradient(-cw / 2, 0, cw / 2, 0);
  bodyGrad.addColorStop(0,   shadeColor(color, -35));
  bodyGrad.addColorStop(0.5, color);
  bodyGrad.addColorStop(1,   shadeColor(color, -35));
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.roundRect(-cw / 2, -ch / 2, cw, ch, [4, 4, 8, 8]);
  ctx.fill();

  ctx.fillStyle = 'rgba(140,200,255,0.75)';
  ctx.fillRect(-cw / 2 + 5, -ch / 2 + 7, cw - 10, ch * 0.27);

  ctx.fillStyle = 'rgba(100,170,220,0.6)';
  ctx.fillRect(-cw / 2 + 6, ch / 2 - 17, cw - 12, 12);

  ctx.fillStyle = '#111';
  [[-cw / 2 - 3, -ch / 2 + 7], [cw / 2 - 2, -ch / 2 + 7],
   [-cw / 2 - 3,  ch / 2 - 17], [cw / 2 - 2,  ch / 2 - 17]].forEach(function(pos) {
    ctx.fillRect(pos[0], pos[1], 5, 11);
  });

  ctx.fillStyle = '#fffaaa';
  ctx.fillRect(-cw / 2 + 3, -ch / 2, 6, 5);
  ctx.fillRect( cw / 2 - 9, -ch / 2, 6, 5);

  ctx.fillStyle = '#ff3300';
  ctx.fillRect(-cw / 2 + 3, ch / 2 - 6, 6, 5);
  ctx.fillRect( cw / 2 - 9, ch / 2 - 6, 6, 5);
}

function drawLamboAt(c) {
  if (c.invincFrames > 0 && frameCount % INVINC_BLINK_PERIOD < INVINC_BLINK_ON) return; // blink when shielded

  ctx.save();
  ctx.translate(c.x + CAR_W / 2, c.y + CAR_H / 2);

  if (nitroActive) {
    ctx.shadowColor = '#00ffaa';
    ctx.shadowBlur  = 18;
  }
  drawCarBody(c.def.bodyColor, CAR_W, CAR_H);
  ctx.shadowBlur = 0;

  // Nitro exhaust flame
  if (nitroActive) {
    ctx.fillStyle = 'rgba(0,255,170,' + (0.3 + Math.random() * 0.5) + ')';
    ctx.beginPath();
    ctx.ellipse(0, CAR_H / 2 + 6 + Math.random() * 10, 9, 14 + Math.random() * 10, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPoliceAt(p) {
  ctx.save();
  ctx.translate(p.x + CAR_W / 2, p.y + CAR_H / 2);
  if (p.stunFrames > 0) ctx.globalAlpha = 0.45 + Math.abs(Math.sin(frameCount * 0.25)) * 0.55;

  const cw = CAR_W, ch = CAR_H;
  const bodyGrad = ctx.createLinearGradient(-cw / 2, 0, cw / 2, 0);
  bodyGrad.addColorStop(0,   '#c0c0c0');
  bodyGrad.addColorStop(0.5, '#f0f0f0');
  bodyGrad.addColorStop(1,   '#c0c0c0');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.roundRect(-cw / 2, -ch / 2, cw, ch, [4, 4, 6, 6]);
  ctx.fill();

  // Black door stripe
  ctx.fillStyle = '#222';
  ctx.fillRect(-cw / 2, -4, cw, 9);

  ctx.fillStyle = 'rgba(140,200,255,0.75)';
  ctx.fillRect(-cw / 2 + 5, -ch / 2 + 7, cw - 10, ch * 0.27);

  ctx.fillStyle = 'rgba(100,170,220,0.6)';
  ctx.fillRect(-cw / 2 + 6, ch / 2 - 17, cw - 12, 12);

  ctx.fillStyle = '#111';
  [[-cw / 2 - 3, -ch / 2 + 7], [cw / 2 - 2, -ch / 2 + 7],
   [-cw / 2 - 3,  ch / 2 - 17], [cw / 2 - 2,  ch / 2 - 17]].forEach(function(pos) {
    ctx.fillRect(pos[0], pos[1], 5, 11);
  });

  // Lightbar — hidden when stunned
  if (p.stunFrames <= 0) {
    const flash = Math.floor(frameCount / 12) % 2 === 0;
    ctx.fillStyle = flash ? '#0044ff' : '#ff2200';
    ctx.fillRect(-cw / 2 + 3, -ch / 2, cw / 2 - 3, 7);
    ctx.fillStyle = flash ? '#ff2200' : '#0044ff';
    ctx.fillRect(1, -ch / 2, cw / 2 - 4, 7);
  } else {
    ctx.globalAlpha = 1;
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffff00';
    ctx.fillText('★', 0, -ch / 2 - 10 + Math.sin(frameCount * 0.25) * 4);
  }

  ctx.fillStyle = '#fffaaa';
  ctx.fillRect(-cw / 2 + 3, -ch / 2, 6, 5);
  ctx.fillRect( cw / 2 - 9, -ch / 2, 6, 5);
  ctx.fillStyle = '#ff3300';
  ctx.fillRect(-cw / 2 + 3, ch / 2 - 6, 6, 5);
  ctx.fillRect( cw / 2 - 9, ch / 2 - 6, 6, 5);

  ctx.fillStyle = '#000';
  ctx.font = 'bold 5px sans-serif';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('POLICE', 0, ch / 2 - 24);

  ctx.restore();
  ctx.globalAlpha = 1;
}

// ── Car-select screen ──
function drawCarSelect() {
  ctx.fillStyle = '#0a1020';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#d4a017';
  ctx.font = 'bold 34px Cinzel, serif';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('🚗 Select Your Car', W / 2, 80);

  ctx.fillStyle = '#aaa';
  ctx.font = '15px sans-serif';
  ctx.fillText('Click a car  •  Press 1 / 2 / 3  •  then Start Game', W / 2, 115);

  CAR_DEFS.forEach(function(def, i) {
    const cx    = W / 2 + (i - 1) * 265;
    const cy    = H / 2 - 30;
    const cardW = 225;
    const cardH = 290;

    ctx.fillStyle   = selectedCar === i ? 'rgba(212,160,23,0.18)' : 'rgba(255,255,255,0.05)';
    ctx.strokeStyle = selectedCar === i ? '#d4a017' : '#444';
    ctx.lineWidth   = selectedCar === i ? 3 : 1;
    ctx.beginPath();
    ctx.roundRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 12);
    ctx.fill();
    ctx.stroke();

    // Mini car preview
    ctx.save();
    ctx.translate(cx, cy - 65);
    ctx.scale(1.7, 1.7);
    drawCarBody(def.bodyColor, CAR_W, CAR_H);
    ctx.restore();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 17px sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(def.name, cx, cy + 50);

    def.desc.forEach(function(line, li) {
      ctx.fillStyle = '#ccc';
      ctx.font = '13px monospace';
      ctx.fillText(line, cx, cy + 74 + li * 19);
    });

    if (selectedCar === i) {
      ctx.fillStyle = '#d4a017';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText('✓ SELECTED', cx, cy + cardH / 2 - 10);
    }

    ctx.fillStyle = '#888';
    ctx.font = '13px sans-serif';
    ctx.fillText('Key: ' + (i + 1), cx, cy + cardH / 2 + 12);
  });

  ctx.fillStyle = '#d4a017';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Click "Start Game" or press Enter to choose a level →', W / 2, H - 38);
}

// ── Level-select screen ──
function drawLevelSelect() {
  ctx.fillStyle = '#0a1020';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#d4a017';
  ctx.font = 'bold 30px Cinzel, serif';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('🏁 Select Difficulty', W / 2, 65);

  ctx.fillStyle = '#aaa';
  ctx.font = '14px sans-serif';
  ctx.fillText('Car: ' + CAR_DEFS[selectedCar].name + '   •   Click a level or press 1-9 / 0', W / 2, 95);

  const COLS   = 5;
  const btnW   = 150, btnH = 88, gapX = 16, gapY = 16;
  const totalW = COLS * btnW + (COLS - 1) * gapX;
  const startX = (W - totalW) / 2;
  const startY = 130;

  const levelColors = [
    '#22aa44','#33bb55','#44cc66','#aaaa22','#bbbb22',
    '#cc9922','#cc6622','#cc4422','#cc2222','#aa0000',
  ];

  for (let i = 0; i < 10; i++) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const bx  = startX + col * (btnW + gapX);
    const by  = startY + row * (btnH + gapY);
    const sel = selectedLevel === i;

    ctx.fillStyle   = sel ? levelColors[i] + '55' : 'rgba(255,255,255,0.05)';
    ctx.strokeStyle = sel ? levelColors[i] : '#444';
    ctx.lineWidth   = sel ? 3 : 1;
    ctx.beginPath();
    ctx.roundRect(bx, by, btnW, btnH, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle    = '#fff';
    ctx.font         = 'bold 17px sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('Level ' + (i + 1), bx + btnW / 2, by + 30);

    ctx.fillStyle = '#bbb';
    ctx.font = '12px sans-serif';
    ctx.fillText(LEVEL_NAMES[i], bx + btnW / 2, by + 50);

    const lvl = LEVEL_DEFS[i];
    ctx.fillStyle = '#777';
    ctx.font = '10px sans-serif';
    ctx.fillText(lvl.numPolice + ' cop' + (lvl.numPolice > 1 ? 's' : ''), bx + btnW / 2, by + 68);

    if (sel) {
      ctx.fillStyle = '#d4a017';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('✓', bx + btnW / 2, by + 82);
    }
  }

  ctx.fillStyle = '#d4a017';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Click "Start Game" or press Enter to play!', W / 2, H - 38);
}

// ── End game ──
function endGame(reason) {
  gameActive = false;
  cancelAnimationFrame(gameLoop);
  render();

  ctx.fillStyle = 'rgba(10,20,30,0.75)';
  ctx.fillRect(0, 0, W, H);

  if (playerCount > 1) {
    mpScores[mpCurrentPlayer] = score;
    const nextPlayer = mpCurrentPlayer + 1;
    if (nextPlayer < playerCount) {
      const msg = document.getElementById('chase-message');
      msg.classList.remove('hidden');
      const why = reason === 'caught' ? '🚔 Caught!' : '🚧 Crashed!';
      msg.textContent = why + ' P' + (mpCurrentPlayer + 1) + ' survived ' + score + 's! Pass to P' + (nextPlayer + 1) + '…';
      mpCurrentPlayer = nextPlayer;
      updatePlayerBanner();
      setTimeout(function() {
        msg.classList.add('hidden');
        initGame();
        startTime  = Date.now();
        gameActive = true;
        gameState  = 'playing';
        loop();
      }, 2500);
    } else {
      let bestIdx = 0;
      mpScores.forEach(function(s, i) { if (s > mpScores[bestIdx]) bestIdx = i; });
      const msg = document.getElementById('chase-message');
      msg.classList.remove('hidden');
      const scoreStr = mpScores.map(function(s, i) { return 'P' + (i + 1) + ':' + s + 's'; }).join(' | ');
      msg.textContent = '🏆 Game Over! ' + scoreStr + ' — Winner: P' + (bestIdx + 1) + '!';
      document.getElementById('btn-start-chase').textContent = 'Play Again';
      gameState = 'game-over';
    }
  } else {
    gameState = 'game-over';
    const why    = reason === 'caught' ? '🚔 BUSTED!' : '🚧 CRASHED!';
    const isBest = score >= bestScore && score > 0;

    ctx.fillStyle    = '#ff4422';
    ctx.font         = 'bold 44px Cinzel, serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(why, W / 2, H / 2 - 70);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('Survived: ' + score + 's  |  Coins: ' + coins, W / 2, H / 2 - 15);

    if (isBest) {
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('🏆 New Best!', W / 2, H / 2 + 25);
    }

    ctx.fillStyle = '#aaa';
    ctx.font = '16px sans-serif';
    ctx.fillText('Press Space / Enter — or click "Play Again"', W / 2, H / 2 + 65);

    document.getElementById('btn-start-chase').textContent = 'Play Again';
  }
}

// ── Input ──
document.addEventListener('keydown', function(e) {
  const preventKeys = ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','w','a','s','d',' ','f','F','Enter'];
  if (preventKeys.includes(e.key)) e.preventDefault();

  if (gameState === 'select-car') {
    if      (e.key === '1')     { selectedCar = 0; drawCarSelect(); }
    else if (e.key === '2')     { selectedCar = 1; drawCarSelect(); }
    else if (e.key === '3')     { selectedCar = 2; drawCarSelect(); }
    else if (e.key === 'Enter') { gameState = 'select-level'; drawLevelSelect(); }
    return;
  }
  if (gameState === 'select-level') {
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= 9) { selectedLevel = n - 1; drawLevelSelect(); }
    else if (e.key === '0')     { selectedLevel = 9; drawLevelSelect(); }
    else if (e.key === 'Enter') { startGame(); }
    return;
  }
  if (gameState === 'game-over') {
    if (e.key === ' ' || e.key === 'Enter') { gameState = 'select-car'; drawCarSelect(); }
    return;
  }

  // Playing
  keys[e.key] = true;
  if (e.key === ' ')                                    activateNitro();
  if (e.key === 'f' || e.key === 'F' || e.key === 'Enter') fireRocket();
});

document.addEventListener('keyup', function(e) { if (keys) keys[e.key] = false; });

// ── Button handlers ──
document.getElementById('btn-start-chase').addEventListener('click', function() {
  if (gameState === 'select-car') {
    gameState = 'select-level';
    drawLevelSelect();
  } else if (gameState === 'select-level') {
    startGame();
  } else {
    cancelAnimationFrame(gameLoop);
    gameActive = false;
    gameState  = 'select-car';
    drawCarSelect();
  }
});

document.getElementById('btn-nitro-chase').addEventListener('click', activateNitro);
document.getElementById('btn-rocket-chase').addEventListener('click', fireRocket);

// Canvas click for car / level selection
canvas.addEventListener('click', function(e) {
  const rect   = canvas.getBoundingClientRect();
  const scaleX = W / rect.width;
  const scaleY = H / rect.height;
  const mx = (e.clientX - rect.left) * scaleX;
  const my = (e.clientY - rect.top)  * scaleY;

  if (gameState === 'select-car') {
    CAR_DEFS.forEach(function(def, i) {
      const cx    = W / 2 + (i - 1) * 265;
      const cy    = H / 2 - 30;
      const cardW = 225, cardH = 290;
      if (mx > cx - cardW / 2 && mx < cx + cardW / 2 &&
          my > cy - cardH / 2 && my < cy + cardH / 2) {
        selectedCar = i;
        drawCarSelect();
      }
    });
  } else if (gameState === 'select-level') {
    const COLS   = 5;
    const btnW   = 150, btnH = 88, gapX = 16, gapY = 16;
    const totalW = COLS * btnW + (COLS - 1) * gapX;
    const startX = (W - totalW) / 2;
    const startY = 130;
    for (let i = 0; i < 10; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const bx  = startX + col * (btnW + gapX);
      const by  = startY + row * (btnH + gapY);
      if (mx > bx && mx < bx + btnW && my > by && my < by + btnH) {
        selectedLevel = i;
        drawLevelSelect();
      }
    }
  }
});

// ── Touch controls ──
let touchStartX = 0;
canvas.addEventListener('touchstart', function(e) {
  touchStartX = e.touches[0].clientX;
  e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchmove', function(e) {
  if (!gameActive) return;
  const dx = e.touches[0].clientX - touchStartX;
  keys['ArrowLeft']  = dx < -15;
  keys['ArrowRight'] = dx > 15;
  e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchend', function(e) {
  const rect = canvas.getBoundingClientRect();
  const ty   = e.changedTouches[0].clientY - rect.top;
  if (ty < rect.height * 0.3) fireRocket();
  keys['ArrowLeft'] = keys['ArrowRight'] = false;
});

// ── Boot ──
drawCarSelect();
