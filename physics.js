'use strict';

// ─── Canvas & Context ───────────────────────────────────────────────────────
const canvas  = document.getElementById('physics-canvas');
const ctx     = canvas.getContext('2d');
const CW      = canvas.width;   // 760
const CH      = canvas.height;  // 540

// ─── Physics Constants ───────────────────────────────────────────────────────
const GRAVITY   = 480;   // px/s²
const FIXED_DT  = 1 / 60;
const RESTITUTION_GROUND = 0.55;
const FRICTION_GROUND    = 0.82;

// ─── Object Type Definitions ─────────────────────────────────────────────────
// shape: 'circle' | 'rect'
// isStatic: won't move under gravity
// gravScale: multiplier on gravity (negative = floats up)
// bounce: 0–1 restitution
// drag: velocity damping per second  (0 = none, 1 = instant stop)
// isMetal: attracted by magnets
// Special flags: isTrampoline, isSpring, isFan, isConveyor, isMagnet, isBumper,
//                isCannon, isTarget, isDestructible
const TYPES = {
  // ── BALLS ──────────────────────────────────────────────────────────────────
  tennis:    { name:'Tennis Ball',   cat:'Balls',   icon:'🎾', shape:'circle', r:13, gravScale:1.0, bounce:0.75, drag:0.01, color:'#c8d400' },
  bowling:   { name:'Bowling Ball',  cat:'Balls',   icon:'🎳', shape:'circle', r:20, gravScale:2.0, bounce:0.15, drag:0.003, color:'#1a1a1a', isMetal:true },
  rubber:    { name:'Rubber Ball',   cat:'Balls',   icon:'🔴', shape:'circle', r:12, gravScale:0.7, bounce:0.92, drag:0.008, color:'#e74c3c' },
  marble:    { name:'Marble',        cat:'Balls',   icon:'🔵', shape:'circle', r:8,  gravScale:0.9, bounce:0.8,  drag:0.004, color:'#5dade2' },
  beach:     { name:'Beach Ball',    cat:'Balls',   icon:'🏐', shape:'circle', r:26, gravScale:0.2, bounce:0.65, drag:0.07,  color:'#f39c12' },
  balloon:   { name:'Balloon',       cat:'Balls',   icon:'🎈', shape:'circle', r:18, gravScale:-0.5,bounce:0.45, drag:0.09,  color:'#e91e63' },
  bubble:    { name:'Bubble',        cat:'Balls',   icon:'⚪', shape:'circle', r:14, gravScale:-0.2,bounce:0.3,  drag:0.12,  color:'rgba(150,220,255,0.55)', isDestructible:true },
  cannon_b:  { name:'Cannonball',    cat:'Balls',   icon:'⚫', shape:'circle', r:15, gravScale:2.5, bounce:0.1,  drag:0.002, color:'#444', isMetal:true },

  // ── NATURE ─────────────────────────────────────────────────────────────────
  feather:   { name:'Feather',       cat:'Nature',  icon:'🪶', shape:'circle', r:9,  gravScale:0.05,bounce:0.05, drag:0.18,  color:'#f5f5f5' },
  leaf:      { name:'Leaf',          cat:'Nature',  icon:'🍃', shape:'circle', r:10, gravScale:0.08,bounce:0.04, drag:0.22,  color:'#27ae60', wobble:true },
  rock:      { name:'Rock',          cat:'Nature',  icon:'🪨', shape:'circle', r:14, gravScale:1.3, bounce:0.2,  drag:0.006, color:'#95a5a6' },
  boulder:   { name:'Boulder',       cat:'Nature',  icon:'⬛', shape:'circle', r:28, gravScale:2.2, bounce:0.05, drag:0.003, color:'#7f8c8d', isMetal:false },

  // ── OBJECTS ────────────────────────────────────────────────────────────────
  wood_box:  { name:'Wood Box',      cat:'Objects', icon:'📦', shape:'rect',  w:34, h:34, gravScale:1.1, bounce:0.3,  drag:0.008, color:'#a0522d' },
  metal_box: { name:'Metal Crate',   cat:'Objects', icon:'🗃', shape:'rect',  w:36, h:36, gravScale:1.8, bounce:0.1,  drag:0.004, color:'#607d8b', isMetal:true },
  domino:    { name:'Domino',        cat:'Objects', icon:'🁣', shape:'rect',  w:14, h:42, gravScale:1.0, bounce:0.15, drag:0.01,  color:'#2c3e50' },
  barrel:    { name:'Barrel',        cat:'Objects', icon:'🛢', shape:'circle',r:20, gravScale:1.2, bounce:0.4,  drag:0.008, color:'#8B4513' },
  anvil:     { name:'Anvil',         cat:'Objects', icon:'⚒', shape:'rect',  w:40, h:28, gravScale:3.0, bounce:0.04, drag:0.002, color:'#2c2c2c', isMetal:true },
  crate:     { name:'Crate',         cat:'Objects', icon:'📫', shape:'rect',  w:44, h:44, gravScale:1.5, bounce:0.2,  drag:0.007, color:'#b8860b' },
  pillow:    { name:'Pillow',        cat:'Objects', icon:'🛏', shape:'rect',  w:40, h:24, gravScale:0.35,bounce:0.06, drag:0.06,  color:'#dda0dd' },

  // ── STRUCTURES (static) ────────────────────────────────────────────────────
  platform:  { name:'Platform (L)',  cat:'Structures', icon:'▬', shape:'rect', w:120, h:14, isStatic:true, color:'#8B4513' },
  plat_s:    { name:'Platform (S)',  cat:'Structures', icon:'━', shape:'rect', w:66,  h:14, isStatic:true, color:'#8B4513' },
  steel_plat:{ name:'Steel Plat.',   cat:'Structures', icon:'▬', shape:'rect', w:140, h:14, isStatic:true, color:'#607d8b' },
  ramp_r:    { name:'Ramp ↗',       cat:'Structures', icon:'◥', shape:'ramp', w:100, h:14, angle:-0.45, isStatic:true, color:'#a0522d' },
  ramp_l:    { name:'Ramp ↖',       cat:'Structures', icon:'◤', shape:'ramp', w:100, h:14, angle:0.45,  isStatic:true, color:'#a0522d' },
  wall:      { name:'Wall',          cat:'Structures', icon:'▌', shape:'rect', w:14, h:80, isStatic:true, color:'#a0522d' },
  trampoline:{ name:'Trampoline',    cat:'Structures', icon:'🔀', shape:'rect', w:90, h:14, isStatic:true, color:'#e91e63', isTrampoline:true, trampolineMult:2.8 },
  bumper:    { name:'Bumper',        cat:'Structures', icon:'🔶', shape:'circle', r:22, isStatic:true, color:'#f39c12', isBumper:true, bumperMult:1.8 },

  // ── INTERACTIVE (static + special effect) ──────────────────────────────────
  spring:    { name:'Spring',        cat:'Interactive', icon:'🌀', shape:'rect', w:36, h:28, isStatic:true, color:'#f1c40f', isSpring:true,    springForce:900 },
  fan_r:     { name:'Fan →',         cat:'Interactive', icon:'💨', shape:'rect', w:44, h:36, isStatic:true, color:'#3498db', isFan:true,        fanForceX:260,  fanForceY:0,   fanRange:150 },
  fan_l:     { name:'Fan ←',         cat:'Interactive', icon:'💨', shape:'rect', w:44, h:36, isStatic:true, color:'#3498db', isFan:true,        fanForceX:-260, fanForceY:0,   fanRange:150 },
  fan_up:    { name:'Fan ↑',         cat:'Interactive', icon:'🌬', shape:'rect', w:44, h:36, isStatic:true, color:'#76d7ea', isFan:true,        fanForceX:0,    fanForceY:-300,fanRange:160 },
  conv_r:    { name:'Conveyor →',    cat:'Interactive', icon:'▶', shape:'rect', w:100,h:14, isStatic:true, color:'#16a085', isConveyor:true,   conveyorVx:110 },
  conv_l:    { name:'Conveyor ←',    cat:'Interactive', icon:'◀', shape:'rect', w:100,h:14, isStatic:true, color:'#16a085', isConveyor:true,   conveyorVx:-110},
  magnet:    { name:'Magnet',        cat:'Interactive', icon:'🧲', shape:'rect', w:40, h:26, isStatic:true, color:'#c0392b', isMagnet:true,     magnetStr:200, magnetRange:130 },
  cannon:    { name:'Cannon',        cat:'Interactive', icon:'💣', shape:'rect', w:50, h:34, isStatic:true, color:'#555', isCannon:true },

  // ── SPECIAL ────────────────────────────────────────────────────────────────
  target:    { name:'Target',        cat:'Special',     icon:'🎯', shape:'circle', r:16, isStatic:true, color:'#e74c3c', isTarget:true, isDestructible:true },
  tnt:       { name:'TNT',           cat:'Special',     icon:'🧨', shape:'rect',  w:30, h:36, isStatic:false, gravScale:1.0, bounce:0.2, drag:0.01, color:'#e74c3c', isDestructible:true },
  star:      { name:'Star Gem',      cat:'Special',     icon:'⭐', shape:'circle', r:12, gravScale:0.6, bounce:0.6,  drag:0.02, color:'#FFD700' },
};

// ─── Simulation State ────────────────────────────────────────────────────────
let objects = [];
let isPlaying  = false;
let eraseMode  = false;
let selectedType = null;
let cannonTimers = [];
let particles   = [];  // visual explosion particles
let wobbleTime  = 0;

// ─── Object Class ─────────────────────────────────────────────────────────────
class Obj {
  constructor(typeKey, cx, cy) {
    const d = TYPES[typeKey];
    this.typeKey   = typeKey;
    this.def       = d;
    this.isStatic  = d.isStatic || false;
    this.shape     = d.shape;
    this.color     = d.color;
    this.icon      = d.icon;
    this.name      = d.name;

    // Physics props
    this.gravScale   = d.gravScale  ?? 1.0;
    this.bounce      = d.bounce     ?? 0.5;
    this.drag        = d.drag       ?? 0.01;
    this.isMetal     = d.isMetal    || false;
    this.isDestructible = d.isDestructible || false;
    this.alive       = true;

    // Saved initial position (for reset)
    this.initCx = cx;
    this.initCy = cy;

    if (this.shape === 'circle') {
      this.r  = d.r || 14;
      this.cx = cx; this.cy = cy;
    } else if (this.shape === 'rect') {
      this.w  = d.w || 40; this.h = d.h || 20;
      this.cx = cx; this.cy = cy;
      this.x  = cx - this.w/2;
      this.y  = cy - this.h/2;
    } else if (this.shape === 'ramp') {
      this.w    = d.w || 80; this.h = d.h || 14;
      this.angle= d.angle || 0;
      this.cx   = cx; this.cy = cy;
      this.x    = cx - this.w/2;
      this.y    = cy - this.h/2;
    }

    this.vx = 0; this.vy = 0;
    this.rotation = 0;
    this.cannonTimer = 0;
    this.springComp  = 0;  // spring compression visual
  }

  /** Bounding AABB for broad-phase, given current cx/cy */
  bounds() {
    if (this.shape === 'circle') {
      return { l: this.cx - this.r, r: this.cx + this.r, t: this.cy - this.r, b: this.cy + this.r };
    } else {
      const hw = this.w/2, hh = this.h/2;
      return { l: this.cx - hw, r: this.cx + hw, t: this.cy - hh, b: this.cy + hh };
    }
  }

  syncXY() {
    if (this.shape !== 'circle') { this.x = this.cx - this.w/2; this.y = this.cy - this.h/2; }
  }
}

// ─── Palette Building ─────────────────────────────────────────────────────────
function buildPalette() {
  const palette = document.getElementById('object-palette');
  palette.innerHTML = '';

  const cats = {};
  for (const [key, d] of Object.entries(TYPES)) {
    if (!cats[d.cat]) cats[d.cat] = [];
    cats[d.cat].push({ key, d });
  }

  for (const [cat, items] of Object.entries(cats)) {
    const catEl = document.createElement('div');
    catEl.className = 'palette-category';
    catEl.innerHTML = `<div class="palette-cat-label">${cat}</div><div class="palette-items" id="cat-${cat}"></div>`;
    palette.appendChild(catEl);

    for (const { key, d } of items) {
      const item = document.createElement('div');
      item.className = 'palette-item';
      item.dataset.type = key;
      item.innerHTML = `<span class="pi-icon">${d.icon}</span><span class="pi-name">${d.name}</span>`;
      item.addEventListener('click', () => selectType(key));
      catEl.querySelector('.palette-items').appendChild(item);
    }
  }
}

function selectType(key) {
  selectedType = key;
  eraseMode = false;
  document.getElementById('btn-erase-physics').classList.remove('active');
  document.querySelectorAll('.palette-item').forEach(el => {
    el.classList.toggle('selected', el.dataset.type === key);
  });
  setStatus(`Selected: ${TYPES[key].name} — click on canvas to place`);
}

// ─── Canvas Input ─────────────────────────────────────────────────────────────
canvas.addEventListener('click', e => {
  if (eraseMode) return;
  if (!selectedType) { setStatus('Select an object from the palette first.'); return; }
  const { x, y } = canvasPos(e);
  placeObject(selectedType, x, y);
});

canvas.addEventListener('contextmenu', e => {
  e.preventDefault();
  const { x, y } = canvasPos(e);
  deleteAt(x, y);
});

function canvasPos(e) {
  const r = canvas.getBoundingClientRect();
  const scaleX = CW / r.width;
  const scaleY = CH / r.height;
  return { x: (e.clientX - r.left) * scaleX, y: (e.clientY - r.top) * scaleY };
}

canvas.addEventListener('mousemove', e => {
  if (!eraseMode) return;
  const { x, y } = canvasPos(e);
  if (e.buttons === 1) deleteAt(x, y);
});

function deleteAt(x, y) {
  for (let i = objects.length - 1; i >= 0; i--) {
    const o = objects[i];
    if (hitTest(o, x, y)) {
      objects.splice(i, 1);
      renderFrame();
      break;
    }
  }
}

function hitTest(o, x, y) {
  if (o.shape === 'circle') {
    return Math.hypot(x - o.cx, y - o.cy) <= o.r + 8;
  } else {
    const hw = o.w/2, hh = o.h/2;
    return x >= o.cx - hw - 8 && x <= o.cx + hw + 8 &&
           y >= o.cy - hh - 8 && y <= o.cy + hh + 8;
  }
}

function placeObject(typeKey, cx, cy) {
  const o = new Obj(typeKey, cx, cy);
  objects.push(o);
  if (!isPlaying) renderFrame();
  setStatus(`Placed ${TYPES[typeKey].name}. Total: ${objects.length} objects.`);
}

// ─── Toolbar Buttons ──────────────────────────────────────────────────────────
document.getElementById('btn-play-physics').addEventListener('click', () => {
  if (isPlaying) stopSimulation(); else startSimulation();
});

document.getElementById('btn-clear-physics').addEventListener('click', () => {
  objects = []; particles = [];
  stopSimulation();
  renderFrame();
  setStatus('Canvas cleared. Place new objects and press ▶ Play.');
});

document.getElementById('btn-erase-physics').addEventListener('click', () => {
  eraseMode = !eraseMode;
  document.getElementById('btn-erase-physics').classList.toggle('active', eraseMode);
  if (eraseMode) {
    selectedType = null;
    document.querySelectorAll('.palette-item').forEach(el => el.classList.remove('selected'));
    setStatus('Erase mode: click/drag on canvas to delete objects.');
  } else {
    setStatus('Erase mode off.');
  }
});

// ─── Simulation Loop ──────────────────────────────────────────────────────────
let rafId = null;
let lastTime = null;
let accumulator = 0;

function startSimulation() {
  isPlaying = true;
  document.getElementById('btn-play-physics').textContent = '⏹ Stop';
  document.getElementById('btn-play-physics').classList.add('playing');
  lastTime = performance.now();
  accumulator = 0;
  cannonTimers = objects.filter(o => o.def.isCannon).map(o => ({ obj: o, t: 0 }));
  rafId = requestAnimationFrame(loop);
}

function stopSimulation() {
  isPlaying = false;
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  document.getElementById('btn-play-physics').textContent = '▶ Play';
  document.getElementById('btn-play-physics').classList.remove('playing');
  // Reset dynamic objects to initial positions
  objects.forEach(o => {
    if (!o.isStatic) {
      o.cx = o.initCx; o.cy = o.initCy;
      o.vx = 0; o.vy = 0;
      o.syncXY();
      o.alive = true;
    }
  });
  objects = objects.filter(o => o.alive || o.isStatic);
  particles = [];
  wobbleTime = 0;
  renderFrame();
  setStatus('Simulation stopped. Adjust objects and press ▶ Play again.');
}

function loop(now) {
  if (!isPlaying) return;
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  accumulator += dt;
  wobbleTime += dt;
  while (accumulator >= FIXED_DT) {
    step(FIXED_DT);
    accumulator -= FIXED_DT;
  }
  renderFrame();
  rafId = requestAnimationFrame(loop);
}

// ─── Physics Step ─────────────────────────────────────────────────────────────
function step(dt) {
  const dynamics  = objects.filter(o => !o.isStatic && o.alive);
  const statics   = objects.filter(o => o.isStatic && o.alive);

  // Handle cannons
  objects.filter(o => o.def.isCannon && o.isStatic && o.alive).forEach(cannon => {
    cannon.cannonTimer += dt;
    if (cannon.cannonTimer >= 2.8) {
      cannon.cannonTimer = 0;
      // Fire cannonball from cannon
      const ball = new Obj('cannon_b', cannon.cx + 30, cannon.cy);
      ball.vx = 320; ball.vy = -60;
      objects.push(ball);
    }
  });

  // Update particle effects
  particles = particles.filter(p => {
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vy += 200 * dt;
    p.life -= dt;
    return p.life > 0;
  });

  // Update each dynamic object
  for (const o of dynamics) {
    // Apply gravity
    o.vy += GRAVITY * o.gravScale * dt;

    // Apply fan effects from static fans nearby
    for (const s of statics) {
      if (s.def.isFan) {
        const dist = Math.hypot(o.cx - s.cx, o.cy - s.cy);
        if (dist < s.def.fanRange) {
          const factor = (1 - dist / s.def.fanRange) * dt;
          o.vx += s.def.fanForceX * factor;
          o.vy += s.def.fanForceY * factor;
        }
      }
      if (s.def.isMagnet && o.isMetal) {
        const dist = Math.hypot(o.cx - s.cx, o.cy - s.cy);
        if (dist < s.def.magnetRange && dist > 2) {
          const force = s.def.magnetStr / (dist * 0.5 + 1) * dt;
          o.vx += (s.cx - o.cx) / dist * force;
          o.vy += (s.cy - o.cy) / dist * force;
        }
      }
    }

    // Apply drag
    const damping = Math.pow(1 - o.drag, dt * 60);
    o.vx *= damping;
    o.vy *= damping;

    // Wobble for leaves
    if (o.def.wobble) {
      o.vx += Math.sin(wobbleTime * 3.1 + o.initCx * 0.1) * 18 * dt;
    }

    // Move
    o.cx += o.vx * dt;
    o.cy += o.vy * dt;
    o.syncXY();

    // ── World bounds ──────────────────────────────────────────────────────────
    // Floor
    const floorY = CH - (o.shape === 'circle' ? o.r : o.h / 2);
    if (o.cy >= floorY) {
      o.cy = floorY;
      if (Math.abs(o.vy) < 20) o.vy = 0; else o.vy *= -o.bounce * RESTITUTION_GROUND;
      o.vx *= FRICTION_GROUND;
    }
    // Ceiling
    const ceilY = o.shape === 'circle' ? o.r : o.h / 2;
    if (o.cy <= ceilY && o.vy < 0) { o.cy = ceilY; o.vy *= -o.bounce; }
    // Left wall
    const leftX = o.shape === 'circle' ? o.r : o.w / 2;
    if (o.cx <= leftX) { o.cx = leftX; o.vx *= -o.bounce; }
    // Right wall
    const rightX = CW - (o.shape === 'circle' ? o.r : o.w / 2);
    if (o.cx >= rightX) { o.cx = rightX; o.vx *= -o.bounce; }
    o.syncXY();

    // ── Collision with static objects ─────────────────────────────────────────
    for (const s of statics) {
      collideWithStatic(o, s);
    }
  }

  // ── Dynamic vs dynamic collision ──────────────────────────────────────────
  for (let i = 0; i < dynamics.length; i++) {
    for (let j = i + 1; j < dynamics.length; j++) {
      collideDynamic(dynamics[i], dynamics[j]);
    }
  }

  // Remove dead objects
  objects = objects.filter(o => o.alive);
}

// ─── Collision: dynamic vs static ────────────────────────────────────────────
function collideWithStatic(dyn, stat) {
  if (!stat.alive) return;

  // ramp special case
  if (stat.shape === 'ramp') {
    collideCircleRamp(dyn, stat);
    return;
  }

  // Circle vs Rect/Circle(static)
  if (dyn.shape === 'circle') {
    if (stat.shape === 'circle') {
      // circle vs static circle (bumper etc.)
      const dx = dyn.cx - stat.cx, dy = dyn.cy - stat.cy;
      const dist = Math.hypot(dx, dy);
      const minD = dyn.r + stat.r;
      if (dist < minD && dist > 0) {
        const nx = dx / dist, ny = dy / dist;
        dyn.cx = stat.cx + nx * minD;
        dyn.cy = stat.cy + ny * minD;
        const dot = dyn.vx * nx + dyn.vy * ny;
        const mult = stat.def.isBumper ? stat.def.bumperMult : (1 + dyn.bounce);
        dyn.vx -= mult * dot * nx;
        dyn.vy -= mult * dot * ny;
        dyn.syncXY();
        if (stat.isDestructible) destroyObject(stat);
        if (dyn.isDestructible) destroyObject(dyn);
      }
      return;
    }
    // circle vs rect
    const { l, r: sr, t, b } = stat.bounds();
    const clampX = Math.max(l, Math.min(sr, dyn.cx));
    const clampY = Math.max(t, Math.min(b, dyn.cy));
    const dx = dyn.cx - clampX, dy = dyn.cy - clampY;
    const dist = Math.hypot(dx, dy);
    if (dist < dyn.r && dist >= 0) {
      const nx = dist > 0 ? dx / dist : 0;
      const ny = dist > 0 ? dy / dist : -1;
      const pen = dyn.r - dist;
      dyn.cx += nx * pen;
      dyn.cy += ny * pen;
      dyn.syncXY();

      // Velocity response
      const dot = dyn.vx * nx + dyn.vy * ny;
      if (dot < 0) {
        let mult = 1 + dyn.bounce;
        if (stat.def.isTrampoline) mult = stat.def.trampolineMult;
        if (stat.def.isBumper)     mult = stat.def.bumperMult;
        dyn.vx -= mult * dot * nx;
        dyn.vy -= mult * dot * ny;
        // Spring: launch upward
        if (stat.def.isSpring && ny < -0.5) {
          dyn.vy = Math.min(dyn.vy, -stat.def.springForce * 0.35);
          stat.springComp = 0.4;
        }
        // Conveyor: adjust vx
        if (stat.def.isConveyor && Math.abs(ny) > 0.5) {
          dyn.vx += (stat.def.conveyorVx - dyn.vx) * 0.15;
        }
      }
      if (stat.isDestructible) destroyObject(stat);
      if (dyn.isDestructible && !dyn.def.isTarget) destroyObject(dyn);
    }
    return;
  }

  // Rect vs Rect (simplified AABB)
  if (dyn.shape === 'rect') {
    const a = dyn.bounds(), b2 = stat.bounds();
    const overlapX = Math.min(a.r, b2.r) - Math.max(a.l, b2.l);
    const overlapY = Math.min(a.b, b2.b) - Math.max(a.t, b2.t);
    if (overlapX > 0 && overlapY > 0) {
      if (overlapX < overlapY) {
        // Separate on X
        const sign = dyn.cx < stat.cx ? -1 : 1;
        dyn.cx += sign * overlapX;
        dyn.vx *= -dyn.bounce;
      } else {
        // Separate on Y
        const sign = dyn.cy < stat.cy ? -1 : 1;
        dyn.cy += sign * overlapY;
        if (sign < 0) {
          // Landed on top
          if (stat.def.isTrampoline) dyn.vy = -Math.abs(dyn.vy) * stat.def.trampolineMult;
          else if (stat.def.isSpring) { dyn.vy = -stat.def.springForce * 0.35; stat.springComp = 0.4; }
          else dyn.vy *= -dyn.bounce;
          if (stat.def.isConveyor) dyn.vx += (stat.def.conveyorVx - dyn.vx) * 0.15;
        } else {
          dyn.vy *= -dyn.bounce;
        }
      }
      dyn.syncXY();
      if (stat.isDestructible) destroyObject(stat);
    }
  }
}

// ─── Ramp collision ───────────────────────────────────────────────────────────
function collideCircleRamp(dyn, ramp) {
  // Build the ramp's center line as a segment
  const cos = Math.cos(ramp.angle), sin = Math.sin(ramp.angle);
  const hw = ramp.w / 2;
  const x1 = ramp.cx - cos * hw, y1 = ramp.cy - sin * hw;
  const x2 = ramp.cx + cos * hw, y2 = ramp.cy + sin * hw;

  const [px, py] = closestPointOnSegment(dyn.cx, dyn.cy, x1, y1, x2, y2);
  const dx = dyn.cx - px, dy = dyn.cy - py;
  const dist = Math.hypot(dx, dy);
  const R = dyn.shape === 'circle' ? dyn.r : Math.min(dyn.w, dyn.h) / 2;
  if (dist < R + ramp.h / 2 && dist > 0) {
    const nx = dx / dist, ny = dy / dist;
    const pen = (R + ramp.h / 2) - dist;
    dyn.cx += nx * pen;
    dyn.cy += ny * pen;
    dyn.syncXY();
    const dot = dyn.vx * nx + dyn.vy * ny;
    if (dot < 0) {
      dyn.vx -= (1 + dyn.bounce) * dot * nx;
      dyn.vy -= (1 + dyn.bounce) * dot * ny;
      dyn.vx *= FRICTION_GROUND;
    }
  }
}

function closestPointOnSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax, aby = by - ay;
  const len2 = abx * abx + aby * aby;
  if (len2 === 0) return [ax, ay, 0];
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / len2));
  return [ax + t * abx, ay + t * aby, t];
}

// ─── Collision: dynamic vs dynamic ───────────────────────────────────────────
function collideDynamic(a, b) {
  if (!a.alive || !b.alive) return;
  // Both circles
  if (a.shape === 'circle' && b.shape === 'circle') {
    const dx = b.cx - a.cx, dy = b.cy - a.cy;
    const dist = Math.hypot(dx, dy);
    const minD = a.r + b.r;
    if (dist < minD && dist > 0) {
      const nx = dx / dist, ny = dy / dist;
      const pen = (minD - dist) / 2;
      a.cx -= nx * pen; a.cy -= ny * pen;
      b.cx += nx * pen; b.cy += ny * pen;
      a.syncXY(); b.syncXY();
      const relVx = a.vx - b.vx, relVy = a.vy - b.vy;
      const dot = relVx * nx + relVy * ny;
      if (dot > 0) {
        const impulse = dot * (1 + Math.max(a.bounce, b.bounce));
        a.vx -= impulse * nx / 2; a.vy -= impulse * ny / 2;
        b.vx += impulse * nx / 2; b.vy += impulse * ny / 2;
      }
      if (a.isDestructible) destroyObject(a);
      if (b.isDestructible) destroyObject(b);
    }
    return;
  }
  // Otherwise AABB
  const aB = a.bounds(), bB = b.bounds();
  const ox = Math.min(aB.r, bB.r) - Math.max(aB.l, bB.l);
  const oy = Math.min(aB.b, bB.b) - Math.max(aB.t, bB.t);
  if (ox > 0 && oy > 0) {
    if (ox < oy) {
      const sign = a.cx < b.cx ? -1 : 1;
      const half = ox / 2;
      a.cx -= sign * half; b.cx += sign * half;
      const avg = (a.vx + b.vx) / 2;
      a.vx = avg + (a.vx - avg) * -a.bounce;
      b.vx = avg + (b.vx - avg) * -b.bounce;
    } else {
      const sign = a.cy < b.cy ? -1 : 1;
      const half = oy / 2;
      a.cy -= sign * half; b.cy += sign * half;
      const avg = (a.vy + b.vy) / 2;
      a.vy = avg + (a.vy - avg) * -a.bounce;
      b.vy = avg + (b.vy - avg) * -b.bounce;
    }
    a.syncXY(); b.syncXY();
    if (a.isDestructible) destroyObject(a);
    if (b.isDestructible) destroyObject(b);
  }
}

// ─── Destroy ─────────────────────────────────────────────────────────────────
function destroyObject(o) {
  if (!o.alive) return;
  o.alive = false;
  // Spawn explosion particles
  for (let i = 0; i < 12; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 80 + Math.random() * 200;
    particles.push({
      x: o.cx, y: o.cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: 3 + Math.random() * 5,
      color: o.color || '#e74c3c',
      life: 0.5 + Math.random() * 0.5,
    });
  }
}

// ─── Rendering ────────────────────────────────────────────────────────────────
function renderFrame() {
  ctx.clearRect(0, 0, CW, CH);

  // Background
  const bgGrad = ctx.createLinearGradient(0, 0, 0, CH);
  bgGrad.addColorStop(0, '#08111e');
  bgGrad.addColorStop(1, '#0d1b2a');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, CW, CH);

  // Grid
  ctx.strokeStyle = 'rgba(255,255,255,0.025)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= CW; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CH); ctx.stroke(); }
  for (let y = 0; y <= CH; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CW, y); ctx.stroke(); }

  // Floor
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  ctx.fillRect(0, CH - 4, CW, 4);

  // Particles
  for (const p of particles) {
    const alpha = Math.max(0, p.life / 1.0);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Objects
  for (const o of objects) {
    if (!o.alive) continue;
    drawObject(o);
  }

  // Play overlay
  if (!isPlaying && objects.length === 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Select objects from the left panel and click here to place them', CW/2, CH/2);
  }
}

function drawObject(o) {
  ctx.save();
  ctx.translate(o.cx, o.cy);

  if (o.shape === 'circle') {
    const r = o.r;
    // Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 6;
    // Fill
    ctx.fillStyle = o.color;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Icon
    ctx.font = `${Math.max(10, r * 1.2)}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(o.icon, 0, 1);

    // Highlight (bubbles)
    if (o.typeKey === 'bubble') {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.beginPath();
      ctx.ellipse(-r*0.25, -r*0.3, r*0.3, r*0.2, -0.5, 0, Math.PI * 2);
      ctx.fill();
    }

  } else if (o.shape === 'rect') {
    const hw = o.w / 2, hh = o.h / 2;
    // Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 5;
    ctx.fillStyle = o.color;
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1.5;

    // Spring compression
    const compY = o.def.isSpring ? (o.springComp * 8) : 0;
    if (o.def.isSpring && o.springComp > 0) o.springComp = Math.max(0, o.springComp - 0.04);

    ctx.beginPath();
    ctx.roundRect(-hw, -hh + compY, o.w, o.h - compY, 4);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.stroke();

    // Special visuals
    if (o.def.isTrampoline) {
      ctx.strokeStyle = '#ff69b4';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-hw, 0); ctx.lineTo(hw, 0);
      ctx.stroke();
    }
    if (o.def.isConveyor) {
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1.5;
      const dir = o.def.conveyorVx > 0 ? 1 : -1;
      for (let x = -hw + 8; x < hw; x += 16) {
        ctx.beginPath();
        ctx.moveTo(x, -4);
        ctx.lineTo(x + 8 * dir, 0);
        ctx.lineTo(x, 4);
        ctx.stroke();
      }
    }
    if (o.def.isFan) {
      // Draw fan blades
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 2;
      for (let k = 0; k < 4; k++) {
        const angle = (k / 4) * Math.PI * 2 + (wobbleTime * 5);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(angle) * 12, Math.sin(angle) * 12);
        ctx.stroke();
      }
      // Arrow showing direction
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(o.icon, 0, 0);
      ctx.restore();
    }
    if (o.def.isMagnet) {
      // Magnetic field lines
      ctx.strokeStyle = 'rgba(255,100,100,0.4)';
      ctx.lineWidth = 1;
      for (let k = 1; k <= 3; k++) {
        ctx.beginPath();
        ctx.arc(0, 0, o.def.magnetRange * k / 3, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Icon + label
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = `${Math.min(o.w * 0.55, o.h * 0.65, 20)}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(o.icon, 0, 0);

  } else if (o.shape === 'ramp') {
    const hw = o.w / 2, hh = o.h / 2;
    ctx.rotate(o.angle);
    ctx.fillStyle = o.color;
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.roundRect(-hw, -hh, o.w, o.h, 3);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(o.icon, 0, 0);
  }

  ctx.restore();
}

function setStatus(msg) {
  document.getElementById('physics-status').textContent = msg;
}

// ─── Init ─────────────────────────────────────────────────────────────────────
buildPalette();
renderFrame();
