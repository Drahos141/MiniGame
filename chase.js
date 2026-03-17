// ===================== POLICE CHASE GAME =====================
// Player drives a Lamborghini and must escape the police car.
// Score = seconds survived. Police speeds up over time.

const canvas = document.getElementById('chase-canvas');
const ctx    = canvas.getContext('2d');

const W = canvas.width;   // 500
const H = canvas.height;  // 500

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

// ── Road / world constants ──
const ROAD_W    = 320;          // width of the road strip
const ROAD_X    = (W - ROAD_W) / 2;  // left edge of road
const LANE_W    = ROAD_W / 3;
const STRIPE_H  = 40;
const STRIPE_GAP = 30;
const CAR_W     = 28;
const CAR_H     = 52;

// ── State ──
let lambo, police, keys, scrollY, score, bestScore, gameActive, gameLoop, startTime;
let frameCount = 0; // incremented each update; used for lightbar flash (avoids per-frame Date.now())
bestScore = 0;

// Obstacle barriers on the road
let barriers;

// ── Road scroll speed (pixels/frame) — increases with time ──
// Base speed: 2px/frame; accelerates by 0.08px per second; caps at 12px/frame
function roadSpeed() {
  const elapsed = (Date.now() - startTime) / 1000;
  return Math.min(2 + elapsed * 0.08, 12);
}

// ── Police pursuit speed ──
// Base speed: 1.5px/frame; accelerates by 0.06px per second; caps at 9px/frame
function policeSpeed() {
  const elapsed = (Date.now() - startTime) / 1000;
  return Math.min(1.5 + elapsed * 0.06, 9);
}

// ── Init ──
function initChase() {
  lambo = {
    x: W / 2 - CAR_W / 2,
    y: H * 0.65,
    vx: 0, vy: 0,
  };
  police = {
    x: W / 2 - CAR_W / 2,
    y: H * 0.15,
    vx: 0, vy: 0,
  };
  keys     = {};
  scrollY  = 0;
  score    = 0;
  frameCount = 0;
  barriers = [];
  gameActive = false;
  startTime  = null;

  document.getElementById('chase-time').textContent  = '0';
  document.getElementById('chase-speed').textContent = '0';
  document.getElementById('chase-message').classList.add('hidden');
  cancelAnimationFrame(gameLoop);
  drawStatic();
}

function drawStatic() {
  drawRoad(0);
  drawLambo(lambo);
  drawPolice(police);
  if (!gameActive) {
    ctx.fillStyle = 'rgba(10,20,30,0.65)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(212,160,23,0.95)';
    ctx.font = 'bold 15px Cinzel, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Press Start Game', W / 2, H / 2);
  }
}

// ── Start ──
function startChase() {
  document.getElementById('btn-start-chase').textContent = 'Restart';
  if (playerCount > 1) {
    mpCurrentPlayer = 0;
    mpScores = Array(playerCount).fill(0);
    updatePlayerBanner();
  }
  cancelAnimationFrame(gameLoop);
  initChase();
  startTime  = Date.now();
  gameActive = true;
  loop();
}

// ── Main loop ──
function loop() {
  if (!gameActive) return;
  update();
  draw();
  gameLoop = requestAnimationFrame(loop);
}

// ── Barrier spawning ──
let barrierTimer = 0;
function spawnBarriers() {
  barrierTimer++;
  const interval = Math.max(60, 120 - Math.floor((Date.now() - startTime) / 1000) * 2);
  if (barrierTimer >= interval) {
    barrierTimer = 0;
    // Spawn 1 or 2 barriers in random lanes, leave at least one lane free
    const lanes  = [0, 1, 2];
    const blocked = Math.random() < 0.4 ? 2 : 1;
    // Fisher-Yates shuffle for an unbiased random lane selection
    for (let i = lanes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [lanes[i], lanes[j]] = [lanes[j], lanes[i]];
    }
    const shuffled = lanes.slice(0, blocked);
    shuffled.forEach(lane => {
      barriers.push({
        x: ROAD_X + lane * LANE_W + LANE_W / 2 - 18,
        y: -60,
        w: 36, h: 20,
      });
    });
  }
}

// ── Update ──
function update() {
  frameCount++;
  const spd  = roadSpeed();
  const pSpd = policeSpeed();
  scrollY = (scrollY + spd) % (STRIPE_H + STRIPE_GAP);

  // ── Player (Lambo) control ──
  const maxV = 4.5;
  const accel = 0.35;
  const friction = 0.82;

  if (keys['ArrowLeft'] || keys['a'])  lambo.vx -= accel;
  if (keys['ArrowRight'] || keys['d']) lambo.vx += accel;
  if (keys['ArrowUp'] || keys['w'])    lambo.vy -= accel;
  if (keys['ArrowDown'] || keys['s'])  lambo.vy += accel;

  lambo.vx = Math.max(-maxV, Math.min(maxV, lambo.vx)) * friction;
  lambo.vy = Math.max(-maxV, Math.min(maxV, lambo.vy)) * friction;
  lambo.x += lambo.vx;
  lambo.y += lambo.vy;

  // Keep lambo on the road
  lambo.x = Math.max(ROAD_X + 4, Math.min(ROAD_X + ROAD_W - CAR_W - 4, lambo.x));
  lambo.y = Math.max(CAR_H, Math.min(H - CAR_H, lambo.y));

  // ── Police AI: steer toward lambo ──
  const dx = lambo.x - police.x;
  const dy = lambo.y - police.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  // 0.6: lateral/longitudinal pursuit factor (avoids teleporting, feels natural)
  // 0.18: extra downward drift so police keeps up with road scroll
  police.x += (dx / dist) * pSpd * 0.6;
  police.y += (dy / dist) * pSpd * 0.6 + spd * 0.18;
  police.x  = Math.max(ROAD_X + 4, Math.min(ROAD_X + ROAD_W - CAR_W - 4, police.x));
  police.y  = Math.max(0, Math.min(H - CAR_H, police.y));

  // If police scrolls off top, reset to top
  if (police.y < -CAR_H) police.y = -CAR_H + 2;

  // ── Barriers ──
  spawnBarriers();
  barriers.forEach(b => { b.y += spd; });
  barriers = barriers.filter(b => b.y < H + 80);

  // ── Collision: lambo vs barrier ──
  for (const b of barriers) {
    if (rectsOverlap(lambo.x, lambo.y, CAR_W, CAR_H, b.x, b.y, b.w, b.h)) {
      endChase('barrier');
      return;
    }
  }

  // ── Collision: police vs lambo ──
  if (rectsOverlap(lambo.x, lambo.y, CAR_W, CAR_H, police.x, police.y, CAR_W, CAR_H)) {
    endChase('caught');
    return;
  }

  // ── Score ──
  score = Math.floor((Date.now() - startTime) / 1000);
  if (score > bestScore) bestScore = score;
  document.getElementById('chase-time').textContent  = score;
  document.getElementById('chase-best').textContent  = bestScore;
  document.getElementById('chase-speed').textContent = Math.round(spd * 10);
}

function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

// ── Draw ──
function draw() {
  drawRoad(scrollY);
  barriers.forEach(b => drawBarrier(b));
  drawLambo(lambo);
  drawPolice(police);
}

function drawRoad(scroll) {
  // Sky / grass sides
  ctx.fillStyle = '#1a2e0a';
  ctx.fillRect(0, 0, W, H);

  // Road surface
  const roadGrad = ctx.createLinearGradient(ROAD_X, 0, ROAD_X + ROAD_W, 0);
  roadGrad.addColorStop(0,   '#2a2a2a');
  roadGrad.addColorStop(0.5, '#333333');
  roadGrad.addColorStop(1,   '#2a2a2a');
  ctx.fillStyle = roadGrad;
  ctx.fillRect(ROAD_X, 0, ROAD_W, H);

  // Road edges (white lines)
  ctx.fillStyle = '#e0e0e0';
  ctx.fillRect(ROAD_X,              0, 5, H);
  ctx.fillRect(ROAD_X + ROAD_W - 5, 0, 5, H);

  // Lane dashes
  ctx.fillStyle = '#ffcc00';
  ctx.globalAlpha = 0.7;
  for (let lane = 1; lane < 3; lane++) {
    const lx = ROAD_X + lane * LANE_W - 2;
    for (let y = -STRIPE_H + scroll; y < H + STRIPE_H; y += STRIPE_H + STRIPE_GAP) {
      ctx.fillRect(lx, y, 4, STRIPE_H);
    }
  }
  ctx.globalAlpha = 1;

  // Grass texture dots
  ctx.fillStyle = 'rgba(60,120,30,0.5)';
  for (let gx = 5; gx < ROAD_X - 10; gx += 18) {
    for (let gy = (scroll * 0.3) % 18 - 18; gy < H + 18; gy += 18) {
      ctx.fillRect(gx, gy, 3, 3);
    }
  }
  for (let gx = ROAD_X + ROAD_W + 10; gx < W - 5; gx += 18) {
    for (let gy = (scroll * 0.3) % 18 - 18; gy < H + 18; gy += 18) {
      ctx.fillRect(gx, gy, 3, 3);
    }
  }
}

function drawBarrier(b) {
  // Orange / white road barrier
  ctx.fillStyle = '#ff6600';
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(b.x, b.y + 6, b.w, 4);
  ctx.fillRect(b.x, b.y + 14, b.w, 4);
}

// Draw Lamborghini (yellow sports car, top-down)
function drawLambo(c) {
  const x = c.x, y = c.y, cw = CAR_W, ch = CAR_H;
  ctx.save();
  ctx.translate(x + cw / 2, y + ch / 2);

  // Body — bright yellow
  const bodyGrad = ctx.createLinearGradient(-cw/2, 0, cw/2, 0);
  bodyGrad.addColorStop(0, '#e8b800');
  bodyGrad.addColorStop(0.5, '#ffe033');
  bodyGrad.addColorStop(1, '#e8b800');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.roundRect(-cw/2, -ch/2, cw, ch, [4, 4, 6, 6]);
  ctx.fill();

  // Windshield (front)
  ctx.fillStyle = 'rgba(140,200,255,0.75)';
  ctx.fillRect(-cw/2 + 4, -ch/2 + 5, cw - 8, ch * 0.28);

  // Rear window
  ctx.fillStyle = 'rgba(100,170,220,0.6)';
  ctx.fillRect(-cw/2 + 5, ch/2 - 14, cw - 10, 10);

  // Wheels (4 corners)
  ctx.fillStyle = '#111';
  [[-cw/2 - 2, -ch/2 + 5], [cw/2 - 3, -ch/2 + 5],
   [-cw/2 - 2,  ch/2 - 14], [cw/2 - 3,  ch/2 - 14]].forEach(([wx, wy]) => {
    ctx.fillRect(wx, wy, 5, 9);
  });

  // Headlights
  ctx.fillStyle = '#fffaaa';
  ctx.fillRect(-cw/2 + 3,  -ch/2, 5, 4);
  ctx.fillRect( cw/2 - 8,  -ch/2, 5, 4);

  // Tail-lights
  ctx.fillStyle = '#ff3300';
  ctx.fillRect(-cw/2 + 3, ch/2 - 4, 5, 4);
  ctx.fillRect( cw/2 - 8, ch/2 - 4, 5, 4);

  // Hood stripe
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(-3, -ch/2 + 2, 6, ch * 0.45);

  ctx.restore();
}

// Draw Police car (black & white, top-down)
function drawPolice(c) {
  const x = c.x, y = c.y, cw = CAR_W, ch = CAR_H;
  ctx.save();
  ctx.translate(x + cw / 2, y + ch / 2);

  // Body — white
  const bodyGrad = ctx.createLinearGradient(-cw/2, 0, cw/2, 0);
  bodyGrad.addColorStop(0, '#cccccc');
  bodyGrad.addColorStop(0.5, '#f0f0f0');
  bodyGrad.addColorStop(1, '#cccccc');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.roundRect(-cw/2, -ch/2, cw, ch, [4, 4, 6, 6]);
  ctx.fill();

  // Black door panels
  ctx.fillStyle = '#222';
  ctx.fillRect(-cw/2, -2, cw, 7);

  // Windshield
  ctx.fillStyle = 'rgba(140,200,255,0.75)';
  ctx.fillRect(-cw/2 + 4, -ch/2 + 5, cw - 8, ch * 0.28);

  // Rear window
  ctx.fillStyle = 'rgba(100,170,220,0.6)';
  ctx.fillRect(-cw/2 + 5, ch/2 - 14, cw - 10, 10);

  // Wheels
  ctx.fillStyle = '#111';
  [[-cw/2 - 2, -ch/2 + 5], [cw/2 - 3, -ch/2 + 5],
   [-cw/2 - 2,  ch/2 - 14], [cw/2 - 3,  ch/2 - 14]].forEach(([wx, wy]) => {
    ctx.fillRect(wx, wy, 5, 9);
  });

  // Lightbar (flashing red/blue) — toggles every 15 frames (~4 Hz at 60fps)
  const flash = Math.floor(frameCount / 15) % 2 === 0;
  ctx.fillStyle = flash ? '#0044ff' : '#ff2200';
  ctx.fillRect(-cw/2 + 3, -ch/2, cw/2 - 3, 6);
  ctx.fillStyle = flash ? '#ff2200' : '#0044ff';
  ctx.fillRect(1, -ch/2, cw/2 - 4, 6);

  // Headlights
  ctx.fillStyle = '#fffaaa';
  ctx.fillRect(-cw/2 + 3, -ch/2, 5, 4);
  ctx.fillRect( cw/2 - 8, -ch/2, 5, 4);

  // Tail-lights
  ctx.fillStyle = '#ff3300';
  ctx.fillRect(-cw/2 + 3, ch/2 - 4, 5, 4);
  ctx.fillRect( cw/2 - 8, ch/2 - 4, 5, 4);

  // "POLICE" text on hood
  ctx.fillStyle = '#000';
  ctx.font = 'bold 5px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('POLICE', 0, ch/2 - 20);

  ctx.restore();
}

// ── End game ──
function endChase(reason) {
  gameActive = false;
  cancelAnimationFrame(gameLoop);
  draw();

  // Dim overlay
  ctx.fillStyle = 'rgba(10,20,30,0.7)';
  ctx.fillRect(0, 0, W, H);

  if (playerCount > 1) {
    mpScores[mpCurrentPlayer] = score;
    const nextPlayer = mpCurrentPlayer + 1;
    if (nextPlayer < playerCount) {
      const msg = document.getElementById('chase-message');
      msg.classList.remove('hidden');
      const why = reason === 'caught' ? '🚔 Caught!' : '🚧 Crashed!';
      msg.textContent = `${why} P${mpCurrentPlayer + 1} survived ${score}s! Pass to P${nextPlayer + 1}…`;
      mpCurrentPlayer = nextPlayer;
      updatePlayerBanner();
      setTimeout(() => {
        msg.classList.add('hidden');
        startTime  = Date.now();
        initChase();
        gameActive = true;
        loop();
      }, 2500);
    } else {
      let bestIdx = 0;
      mpScores.forEach((s, i) => { if (s > mpScores[bestIdx]) bestIdx = i; });
      const msg = document.getElementById('chase-message');
      msg.classList.remove('hidden');
      const scoreStr = mpScores.map((s, i) => `P${i + 1}:${s}s`).join(' | ');
      msg.textContent = `🏆 Game Over! ${scoreStr} — Winner: P${bestIdx + 1}!`;
      document.getElementById('btn-start-chase').textContent = 'Play Again';
    }
  } else {
    const msg = document.getElementById('chase-message');
    msg.classList.remove('hidden');
    const why = reason === 'caught' ? '🚔 Busted!' : '🚧 Crashed!';
    const best = score >= bestScore && score > 0 ? ' 🏆 New Best!' : '';
    msg.textContent = `${why} You survived ${score}s!${best}`;
    document.getElementById('btn-start-chase').textContent = 'Play Again';
  }
}

// ── Input ──
document.addEventListener('keydown', e => {
  const actionKeys = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d'];
  if (actionKeys.includes(e.key)) {
    e.preventDefault();
    if (!gameActive) { startChase(); return; }
  }
  keys[e.key] = true;
});
document.addEventListener('keyup', e => { keys[e.key] = false; });

document.getElementById('btn-start-chase').addEventListener('click', startChase);

// Touch controls
let touchStartX = 0, touchStartY = 0;
canvas.addEventListener('touchstart', e => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
  e.preventDefault();
}, { passive: false });
canvas.addEventListener('touchmove', e => {
  if (!gameActive) return;
  const dx = e.touches[0].clientX - touchStartX;
  const dy = e.touches[0].clientY - touchStartY;
  keys['ArrowLeft']  = dx < -15;
  keys['ArrowRight'] = dx >  15;
  keys['ArrowUp']    = dy < -15;
  keys['ArrowDown']  = dy >  15;
  e.preventDefault();
}, { passive: false });
canvas.addEventListener('touchend', () => {
  keys['ArrowLeft'] = keys['ArrowRight'] = keys['ArrowUp'] = keys['ArrowDown'] = false;
});

// ── Boot ──
initChase();
