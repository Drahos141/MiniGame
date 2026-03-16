// Warcraft Realms – Real-Time Strategy game
// Canvas-based RTS with workers, resources, buildings, units and AI
'use strict';

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const TILE      = 32;
const MAP_W     = 50;
const MAP_H     = 34;
const VIEW_W    = 820;
const VIEW_H    = 520;
const CAM_SPD   = 6;
const CAM_EDGE  = 40;
const CARRY_MAX = 10;   // resources per trip
const GATHER_T  = 90;   // ticks to fill carry
const ATK_CD    = 50;   // ticks between attacks (~1.7 s at 30 fps)
const LOGIC_FPS = 30;

// ─── TERRAIN ─────────────────────────────────────────────────────────────────
const TR       = { GRASS:0, DIRT:1, WATER:2, FOREST:3, MOUNTAIN:4 };
const TR_PASS  = [true, true, false, false, false];
const TR_CLR   = ['#4a7c34','#8c7355','#2a5fa0','#2d5a1a','#6a6a5a'];

// ─── UNIT DEFINITIONS ────────────────────────────────────────────────────────
const UDEFS = {
  peasant:  { n:'Peasant',      e:'👷', hp:30,  atk:5,  def:0, spd:1.8, rng:1, gather:true,  food:1, cost:{gold:75},          trainT:220 },
  footman:  { n:'Footman',      e:'⚔️', hp:70,  atk:12, def:2, spd:1.5, rng:1, gather:false, food:2, cost:{gold:135},         trainT:290 },
  archer:   { n:'Archer',       e:'🏹', hp:45,  atk:10, def:1, spd:1.5, rng:5, gather:false, food:2, cost:{gold:105},         trainT:260 },
  knight:   { n:'Knight',       e:'🛡️', hp:120, atk:22, def:5, spd:2.0, rng:1, gather:false, food:4, cost:{gold:245,lumber:50},trainT:390 },
  peon:     { n:'Peon',         e:'⛏️', hp:30,  atk:5,  def:0, spd:1.8, rng:1, gather:true,  food:0, cost:{},                 trainT:0   },
  grunt:    { n:'Grunt',        e:'👹', hp:75,  atk:14, def:3, spd:1.5, rng:1, gather:false, food:0, cost:{gold:120},         trainT:0   },
  troll:    { n:'Troll Axeman', e:'🪓', hp:50,  atk:12, def:2, spd:1.5, rng:4, gather:false, food:0, cost:{gold:95},          trainT:0   },
  raider:   { n:'Raider',       e:'🐗', hp:110, atk:20, def:4, spd:2.0, rng:1, gather:false, food:0, cost:{gold:220},         trainT:0   },
};

// ─── BUILDING DEFINITIONS ────────────────────────────────────────────────────
const BDEFS = {
  townhall:  { n:'Town Hall',  e:'🏰', hp:600, def:3, atk:0, rng:0, sz:3, trains:['peasant'],                    foodCap:5,  cost:{},                  btime:0   },
  farm:      { n:'Farm',       e:'🌾', hp:100, def:0, atk:0, rng:0, sz:2, trains:[],                             foodCap:10, cost:{lumber:80},           btime:100 },
  barracks:  { n:'Barracks',   e:'⚔️', hp:260, def:2, atk:0, rng:0, sz:2, trains:['footman','archer','knight'],  foodCap:0,  cost:{gold:150,lumber:80},  btime:150 },
  tower:     { n:'Tower',      e:'🗼', hp:180, def:4, atk:15, rng:6, sz:1, trains:[],          atkRate:80,        foodCap:0,  cost:{gold:120,lumber:60},  btime:120 },
  stronghold:{ n:'Stronghold', e:'🏯', hp:600, def:3, atk:0, rng:0, sz:3, trains:['peon','grunt','troll','raider'],foodCap:5, cost:{},                  btime:0   },
  orcfarm:   { n:'Pigfarm',    e:'🐷', hp:100, def:0, atk:0, rng:0, sz:2, trains:[],                             foodCap:10, cost:{},                   btime:0   },
  warcamp:   { n:'War Camp',   e:'🔥', hp:260, def:2, atk:0, rng:0, sz:2, trains:['grunt','troll','raider'],      foodCap:0,  cost:{},                   btime:0   },
};

// ─── GLOBAL STATE ────────────────────────────────────────────────────────────
let canvas, ctx;
let camX = 0, camY = 0;
let mX = VIEW_W / 2, mY = VIEW_H / 2;
let mouseOnCanvas = false;
let mDown = false;
let dragStart = null, selBox = null;
let map = [];
let units = [], buildings = [], resources = [];
let selUnits = [], selBuilding = null;
let buildMode = null;
let gold = 200, lumber = 100, food = 0, foodCap = 0;
let aiGold = 300, aiLumber = 150, aiFood = 0, aiFoodCap = 5;
let gameOver = false;
let ticks = 0;
let msgLog = [];
let aiTimer = 0;
let aiAttCooldown = 1800;   // first attack in 60 s
let nextId = 0;

// ─── ENTITY FACTORIES ────────────────────────────────────────────────────────
function makeUnit(type, wx, wy, owner) {
  const d = UDEFS[type];
  return {
    id: nextId++, type, owner,
    x: wx, y: wy,
    hp: d.hp, maxHp: d.hp,
    atk: d.atk, def: d.def || 0,
    spd: d.spd, rng: d.rng,
    gather: d.gather, emoji: d.e, name: d.n,
    st: 'idle',       // idle | move | attack | gather | return | build
    path: [],
    tgt: null,        // {x,y} movement destination
    atkTgt: null,     // id of attack target
    gRes: null,       // resource node ref
    bTgt: null,       // {type,tx,ty} build order
    atkCd: 0,
    gTick: 0,
    carryG: 0, carryL: 0,
    bTick: 0,
  };
}

function makeBuilding(type, tx, ty, owner) {
  const d = BDEFS[type];
  const sz = d.sz;
  return {
    id: nextId++, type, owner,
    tx, ty,
    x: (tx + sz / 2) * TILE,
    y: (ty + sz / 2) * TILE,
    sz,
    hp: d.hp, maxHp: d.hp,
    def: d.def || 0, atk: d.atk || 0, rng: d.rng || 0,
    emoji: d.e, name: d.n,
    trains: [...(d.trains || [])],
    foodCap: d.foodCap || 0,
    atkRate: d.atkRate || 0,
    tq: [],     // training queue
    tTick: 0,   // training timer
    aTick: 0,   // attack timer
    underConst: d.btime,
  };
}

function makeResource(type, tx, ty, amount) {
  return {
    tx, ty,
    x: (tx + 0.5) * TILE,
    y: (ty + 0.5) * TILE,
    type, amount, max: amount,
    emoji: type === 'gold' ? '💰' : '🌲',
  };
}

// ─── MAP GENERATION ──────────────────────────────────────────────────────────
function genMap() {
  map = [];
  for (let r = 0; r < MAP_H; r++) map.push(new Uint8Array(MAP_W).fill(TR.GRASS));

  const mr = Math.floor(MAP_H / 2);
  const mc = Math.floor(MAP_W / 2);

  // Water pond in centre
  for (let dr = -3; dr <= 3; dr++) {
    for (let dc = -3; dc <= 3; dc++) {
      if (Math.abs(dr) + Math.abs(dc) <= 4) map[mr + dr][mc + dc] = TR.WATER;
    }
  }
  // Crossing paths
  for (let r = mr - 3; r <= mr + 3; r++) {
    map[r][mc - 1] = TR.DIRT;
    map[r][mc]     = TR.DIRT;
  }

  // Scattered forests
  const rng = (a, b) => a + Math.floor(Math.random() * (b - a));
  for (let i = 0; i < 45; i++) {
    const r = rng(1, MAP_H - 1), c = rng(6, MAP_W - 6);
    if (map[r][c] !== TR.WATER) map[r][c] = TR.FOREST;
  }
  // Mountain clusters
  for (let i = 0; i < 12; i++) {
    const r = rng(2, MAP_H - 2), c = rng(10, MAP_W - 10);
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const nr = r + dr, nc = c + dc;
      if (nr > 0 && nr < MAP_H - 1 && nc > 8 && nc < MAP_W - 8 && map[nr][nc] !== TR.WATER)
        map[nr][nc] = TR.MOUNTAIN;
    }
  }

  // Clear zones for player (left) and AI (right) bases
  for (let r = mr - 6; r <= mr + 6; r++) {
    for (let c = 0; c < 14; c++) if (map[r][c] !== TR.WATER) map[r][c] = TR.DIRT;
    for (let c = MAP_W - 14; c < MAP_W; c++) if (map[r][c] !== TR.WATER) map[r][c] = TR.DIRT;
  }
}

// ─── PATHFINDING (A*) ────────────────────────────────────────────────────────
function tileOk(tx, ty) {
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return false;
  if (!TR_PASS[map[ty][tx]]) return false;
  for (const b of buildings) {
    if (b.underConst > 0) continue;
    if (tx >= b.tx && tx < b.tx + b.sz && ty >= b.ty && ty < b.ty + b.sz) return false;
  }
  return true;
}

function astar(sx, sy, gx, gy) {
  const k   = (x, y) => y * MAP_W + x;
  const h   = (x, y) => Math.abs(x - gx) + Math.abs(y - gy);
  const open = new Map();
  const closed = new Set();
  open.set(k(sx, sy), { x: sx, y: sy, g: 0, f: h(sx, sy), parent: null });

  let bestNode = null, bestH = Infinity;

  for (let iter = 0; iter < 600 && open.size > 0; iter++) {
    let cur = null;
    for (const n of open.values()) { if (!cur || n.f < cur.f) cur = n; }
    const ck = k(cur.x, cur.y);
    open.delete(ck);
    closed.add(ck);

    const ch = h(cur.x, cur.y);
    if (ch < bestH) { bestH = ch; bestNode = cur; }
    if (cur.x === gx && cur.y === gy) break;

    const dirs = [[0,-1],[1,0],[0,1],[-1,0],[1,-1],[1,1],[-1,1],[-1,-1]];
    for (const [dx, dy] of dirs) {
      const nx = cur.x + dx, ny = cur.y + dy;
      const nk = k(nx, ny);
      if (closed.has(nk)) continue;
      const isGoal = nx === gx && ny === gy;
      if (!isGoal && !tileOk(nx, ny)) continue;
      const g = cur.g + (dx && dy ? 1.41 : 1.0);
      const ex = open.get(nk);
      if (!ex || g < ex.g) open.set(nk, { x: nx, y: ny, g, f: g + h(nx, ny), parent: cur });
    }
  }

  if (!bestNode) return null;
  const path = [];
  for (let n = bestNode; n && n.parent; n = n.parent)
    path.unshift({ x: n.x * TILE + TILE / 2, y: n.y * TILE + TILE / 2 });
  return path;
}

function setPath(unit, wx, wy) {
  const sx = Math.floor(unit.x / TILE), sy = Math.floor(unit.y / TILE);
  const gx = Math.floor(wx / TILE),     gy = Math.floor(wy / TILE);
  if (sx === gx && sy === gy) { unit.path = []; return; }
  unit.path = astar(sx, sy, gx, gy) || [{ x: wx, y: wy }];
  unit.tgt  = { x: wx, y: wy };
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const dst = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);

function getById(id) {
  return units.find(u => u.id === id) || buildings.find(b => b.id === id) || null;
}

function unitAt(wx, wy) {
  for (const u of units)
    if (u.hp > 0 && dst(u.x, u.y, wx, wy) < TILE * 0.75) return u;
  return null;
}

function buildingAt(wx, wy) {
  const tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE);
  return buildings.find(b => b.hp > 0 && tx >= b.tx && tx < b.tx + b.sz && ty >= b.ty && ty < b.ty + b.sz) || null;
}

function resourceAt(tx, ty) {
  return resources.find(r => r.tx === tx && r.ty === ty && r.amount > 0) || null;
}

function nearestResource(unit, type) {
  let best = null, bd = Infinity;
  for (const r of resources) {
    if (type && r.type !== type) continue;
    if (r.amount <= 0) continue;
    const d = dst(unit.x, unit.y, r.x, r.y);
    if (d < bd) { bd = d; best = r; }
  }
  return best;
}

function playerBase(owner) {
  const t = owner === 0 ? 'townhall' : 'stronghold';
  return buildings.find(b => b.owner === owner && b.type === t && b.hp > 0) || null;
}

function nearestEnemy(ent, maxD) {
  let best = null, bd = maxD;
  for (const u of units) {
    if (u.owner === ent.owner || u.hp <= 0) continue;
    const d = dst(ent.x, ent.y, u.x, u.y);
    if (d < bd) { bd = d; best = u; }
  }
  for (const b of buildings) {
    if (b.owner === ent.owner || b.hp <= 0 || b.underConst > 0) continue;
    const d = dst(ent.x, ent.y, b.x, b.y);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}

function canPlace(type, tx, ty) {
  const sz = BDEFS[type].sz;
  for (let r = ty; r < ty + sz; r++) {
    for (let c = tx; c < tx + sz; c++) {
      if (c < 0 || r < 0 || c >= MAP_W || r >= MAP_H) return false;
      if (!TR_PASS[map[r][c]]) return false;
      for (const b of buildings)
        if (c >= b.tx && c < b.tx + b.sz && r >= b.ty && r < b.ty + b.sz) return false;
      for (const res of resources)
        if (res.tx === c && res.ty === r) return false;
    }
  }
  return true;
}

function addLog(icon, msg) {
  msgLog.unshift({ icon, msg });
  if (msgLog.length > 7) msgLog.pop();
}

// ─── UNIT MOVEMENT ───────────────────────────────────────────────────────────
function stepUnit(unit) {
  if (!unit.path || unit.path.length === 0) return true;
  const nxt = unit.path[0];
  const dx = nxt.x - unit.x, dy = nxt.y - unit.y;
  const d = Math.hypot(dx, dy);
  if (d <= unit.spd + 0.01) {
    unit.x = nxt.x; unit.y = nxt.y;
    unit.path.shift();
    return unit.path.length === 0;
  }
  unit.x += (dx / d) * unit.spd;
  unit.y += (dy / d) * unit.spd;
  return false;
}

// ─── UNIT STATE MACHINE ───────────────────────────────────────────────────────
function updateUnits() {
  for (const u of units) {
    if (u.hp <= 0) continue;
    if (u.atkCd > 0) u.atkCd--;

    switch (u.st) {

      case 'idle': {
        // Auto-attack nearby enemies
        const e = nearestEnemy(u, TILE * 4);
        if (e) { u.atkTgt = e.id; u.st = 'attack'; setPath(u, e.x, e.y); }
        break;
      }

      case 'move': {
        if (stepUnit(u)) u.st = 'idle';
        break;
      }

      case 'attack': {
        const tgt = getById(u.atkTgt);
        if (!tgt || tgt.hp <= 0) { u.atkTgt = null; u.st = 'idle'; break; }
        const d = dst(u.x, u.y, tgt.x, tgt.y);
        const range = u.rng * TILE + TILE * 0.6;
        if (d <= range) {
          if (u.atkCd <= 0) {
            const dmg = Math.max(1, u.atk - (tgt.def || 0));
            tgt.hp -= dmg;
            u.atkCd = ATK_CD;
            if (tgt.hp <= 0)
              addLog(u.owner === 0 ? '⚔️' : '💀', `${u.name} slew ${tgt.name}!`);
          }
        } else {
          // Recalculate path every 30 ticks to follow moving targets
          if (u.path.length === 0 || ticks % 30 === 0) setPath(u, tgt.x, tgt.y);
          stepUnit(u);
        }
        break;
      }

      case 'gather': {
        const res = u.gRes;
        if (!res || res.amount <= 0) {
          const nr = nearestResource(u, res?.type);
          if (nr) { u.gRes = nr; setPath(u, nr.x, nr.y); }
          else    { u.st = 'idle'; u.gRes = null; }
          break;
        }
        const d = dst(u.x, u.y, res.x, res.y);
        if (d > TILE * 1.6) {
          if (u.path.length === 0) setPath(u, res.x, res.y);
          stepUnit(u);
        } else {
          // At resource – gather over time
          if (u.gTick <= 0) {
            const take = Math.min(CARRY_MAX, res.amount);
            if (res.type === 'gold') u.carryG = take;
            else                     u.carryL = take;
            res.amount -= take;
            u.gTick = GATHER_T;
            // Head back to base
            const base = playerBase(u.owner);
            if (base) { u.st = 'return'; setPath(u, base.x, base.y); }
          } else u.gTick--;
        }
        break;
      }

      case 'return': {
        const base = playerBase(u.owner);
        if (!base) { u.st = 'idle'; break; }
        const d = dst(u.x, u.y, base.x, base.y);
        if (d <= TILE * 2.5) {
          if (u.owner === 0) { gold += u.carryG; lumber += u.carryL; }
          else               { aiGold += u.carryG; aiLumber += u.carryL; }
          u.carryG = 0; u.carryL = 0;
          // Go back to same resource if still has some
          if (u.gRes && u.gRes.amount > 0) { u.st = 'gather'; setPath(u, u.gRes.x, u.gRes.y); }
          else {
            const nr = nearestResource(u, null);
            if (nr) { u.gRes = nr; u.st = 'gather'; setPath(u, nr.x, nr.y); }
            else    u.st = 'idle';
          }
        } else {
          if (u.path.length === 0) setPath(u, base.x, base.y);
          stepUnit(u);
        }
        break;
      }

      case 'build': {
        const bt = u.bTgt;
        if (!bt) { u.st = 'idle'; break; }
        const bx = (bt.tx + BDEFS[bt.type].sz / 2) * TILE;
        const by = (bt.ty + BDEFS[bt.type].sz / 2) * TILE;
        const d = dst(u.x, u.y, bx, by);
        if (d > TILE * 2.5) {
          if (u.path.length === 0) setPath(u, bx, by);
          stepUnit(u);
        } else {
          if (u.bTick > 0) {
            u.bTick--;
          } else {
            // Construction complete
            const b = makeBuilding(bt.type, bt.tx, bt.ty, 0);
            b.underConst = 0;
            buildings.push(b);
            addLog('🏗️', `${b.name} construction complete!`);
            u.bTgt = null; u.bTick = 0; u.st = 'idle';
          }
        }
        break;
      }
    }
  }

  // Remove dead units
  for (let i = units.length - 1; i >= 0; i--) {
    if (units[i].hp <= 0) {
      selUnits = selUnits.filter(u => u !== units[i]);
      units.splice(i, 1);
    }
  }
}

// ─── BUILDING UPDATES ─────────────────────────────────────────────────────────
function updateBuildings() {
  for (const b of buildings) {
    if (b.hp <= 0) continue;

    // Tower auto-attacks
    if (b.atk > 0 && b.rng > 0) {
      if (b.aTick > 0) { b.aTick--; }
      else {
        const e = nearestEnemy(b, b.rng * TILE);
        if (e) {
          const dmg = Math.max(1, b.atk - (e.def || 0));
          e.hp -= dmg;
          b.aTick = b.atkRate || 80;
          if (e.hp <= 0) addLog('🗼', `Tower destroyed ${e.name}!`);
        }
      }
    }

    // Train queue
    if (b.tq.length > 0) {
      b.tTick++;
      const type = b.tq[0];
      const trainT = UDEFS[type]?.trainT || 300;
      if (b.tTick >= trainT) {
        b.tTick = 0;
        b.tq.shift();
        const spawnX = b.x + (Math.random() - 0.5) * b.sz * TILE * 1.2;
        const spawnY = b.y + b.sz * TILE * 0.55 + TILE;
        const u = makeUnit(type, spawnX, spawnY, b.owner);
        units.push(u);
        if (b.owner === 0) addLog('⚔️', `${u.name} is ready!`);
      }
    }
  }

  // Remove destroyed buildings
  for (let i = buildings.length - 1; i >= 0; i--) {
    if (buildings[i].hp <= 0) {
      addLog('💥', `${buildings[i].name} has been destroyed!`);
      if (selBuilding === buildings[i]) selBuilding = null;
      buildings.splice(i, 1);
    }
  }
}

// ─── FOOD / RESOURCE COUNTERS ────────────────────────────────────────────────
function updateCounters() {
  food = 0; foodCap = 0; aiFood = 0; aiFoodCap = 0;
  for (const b of buildings) {
    if (b.underConst > 0) continue;
    if (b.owner === 0) foodCap += b.foodCap;
    else               aiFoodCap += b.foodCap;
  }
  for (const u of units) {
    const def = UDEFS[u.type];
    if (u.owner === 0) food += (def.food || 0);
    else               aiFood += (def.food || 0);
  }
}

// ─── AI LOGIC ────────────────────────────────────────────────────────────────
function updateAI() {
  aiTimer++;
  const secs = ticks / LOGIC_FPS;

  // Assign idle AI workers to gather resources
  for (const u of units) {
    if (u.owner !== 1 || !u.gather || u.st !== 'idle') continue;
    const res = nearestResource(u, null);
    if (res) { u.gRes = res; u.st = 'gather'; setPath(u, res.x, res.y); }
  }

  // Phase: build economy
  if (secs < 40) {
    if (aiTimer % 350 === 0 && aiFoodCap < 25) aiBuild('orcfarm');
    if (secs > 15 && aiTimer % 700 === 0)       aiBuild('warcamp');
  }
  // Phase: grow army
  else if (secs < 100) {
    if (aiTimer % 180 === 0)                     aiTrain();
    if (aiTimer % 500 === 0 && aiFoodCap < 40)   aiBuild('orcfarm');
    if (aiTimer % 800 === 0)                     aiBuild('warcamp');
  }
  // Phase: attack
  else {
    if (aiTimer % 240 === 0) aiTrain();
    if (aiTimer % 600 === 0 && aiFoodCap < 60) aiBuild('orcfarm');

    if (aiAttCooldown > 0) aiAttCooldown--;
    else { aiLaunchAttack(); aiAttCooldown = Math.max(400, 900 - Math.floor(secs / 30) * 60); }
  }
}

function aiBuild(type) {
  const def = BDEFS[type];
  if (aiGold < (def.cost?.gold || 0)) return;
  if (aiLumber < (def.cost?.lumber || 0)) return;

  const base = playerBase(1);
  if (!base) return;

  // Find a free spot around the AI base
  for (let attempt = 0; attempt < 30; attempt++) {
    const tx = base.tx + Math.floor(Math.random() * 12) - 6;
    const ty = base.ty + Math.floor(Math.random() * 12) - 6;
    if (canPlace(type, tx, ty)) {
      aiGold   -= (def.cost?.gold   || 0);
      aiLumber -= (def.cost?.lumber || 0);
      const b   = makeBuilding(type, tx, ty, 1);
      b.underConst = 0;  // AI builds instantly
      buildings.push(b);
      return;
    }
  }
}

function aiTrain() {
  const camps = buildings.filter(b => b.owner === 1 && b.type === 'warcamp' && b.hp > 0);
  if (camps.length === 0) return;

  const types = ['grunt', 'troll', 'raider'];
  for (const camp of camps) {
    if (camp.tq.length >= 2) continue;
    // Pick a unit type the AI can afford
    for (const t of types) {
      const cost = UDEFS[t].cost;
      if (aiGold < (cost.gold || 0)) continue;
      if (aiFoodCap <= aiFood + (UDEFS[t].food || 0)) continue;
      aiGold -= (cost.gold || 0);
      // Spawn directly for the AI
      const spawnX = camp.x + (Math.random() - 0.5) * camp.sz * TILE * 1.5;
      const spawnY = camp.y + camp.sz * TILE * 0.5 + TILE;
      units.push(makeUnit(t, spawnX, spawnY, 1));
      break;
    }
  }
}

function aiLaunchAttack() {
  const army = units.filter(u => u.owner === 1 && !u.gather && u.hp > 0);
  if (army.length < 2) return;
  const target = playerBase(0);
  if (!target) return;
  addLog('⚠️', `Enemy army attacks! (${army.length} units)`);
  for (const u of army) {
    u.st = 'attack';
    u.atkTgt = target.id;
    setPath(u, target.x, target.y);
  }
}

// ─── GAME INIT ───────────────────────────────────────────────────────────────
function initGame() {
  units = []; buildings = []; resources = [];
  selUnits = []; selBuilding = null; buildMode = null;
  gold = 200; lumber = 100; food = 0; foodCap = 0;
  aiGold = 300; aiLumber = 150; aiFood = 0; aiFoodCap = 5;
  gameOver = false; ticks = 0; msgLog = [];
  aiTimer = 0; aiAttCooldown = 1800; nextId = 0;

  genMap();

  const mr = Math.floor(MAP_H / 2);

  // ── Player base ──
  const pTX = 2, pTY = mr - 1;
  buildings.push(makeBuilding('townhall', pTX, pTY, 0));
  for (let i = 0; i < 3; i++) {
    units.push(makeUnit('peasant', (pTX + 4 + i * 1.5) * TILE, (pTY + 1) * TILE, 0));
  }

  // ── AI base ──
  const aTX = MAP_W - 5, aTY = mr - 1;
  const aiStronghold = makeBuilding('stronghold', aTX, aTY, 1);
  aiStronghold.underConst = 0;
  buildings.push(aiStronghold);

  const aiPigfarm = makeBuilding('orcfarm', aTX - 4, aTY - 3, 1);
  aiPigfarm.underConst = 0;
  buildings.push(aiPigfarm);

  const aiWarcamp = makeBuilding('warcamp', aTX - 4, aTY + 3, 1);
  aiWarcamp.underConst = 0;
  buildings.push(aiWarcamp);

  for (let i = 0; i < 3; i++) {
    units.push(makeUnit('peon', (aTX - 5 - i * 1.5) * TILE, (aTY + 1) * TILE, 1));
  }

  // ── Resource nodes ──
  // Player-side gold mine
  resources.push(makeResource('gold', pTX + 5, pTY - 3, 1500));
  // Player-side lumber
  resources.push(makeResource('lumber', pTX + 6, pTY + 3, 2000));
  // Centre gold mine
  resources.push(makeResource('gold', Math.floor(MAP_W / 2) - 1, mr - 5, 1200));
  // Centre lumber
  resources.push(makeResource('lumber', Math.floor(MAP_W / 2) + 1, mr + 5, 1800));
  // AI-side gold mine
  resources.push(makeResource('gold', aTX - 7, aTY - 3, 1500));
  // AI-side lumber
  resources.push(makeResource('lumber', aTX - 7, aTY + 3, 2000));

  // Mark forest tiles around lumber nodes
  for (const res of resources.filter(r => r.type === 'lumber')) {
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const tx = res.tx + dc, ty = res.ty + dr;
      if (tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H) map[ty][tx] = TR.FOREST;
    }
  }

  // Centre camera on player Town Hall
  camX = Math.max(0, pTX * TILE - VIEW_W / 2);
  camY = Math.max(0, pTY * TILE - VIEW_H / 2);

  document.getElementById('wc-message').textContent = '';
  document.getElementById('wc-message').className = '';

  addLog('📯', 'Game started! Gather resources and build your army.');
  addLog('💡', 'Right-click workers on 💰/🌲 to gather. Build → Farm for more food.');
}

// ─── PLAYER COMMANDS ─────────────────────────────────────────────────────────
function cmdUnits(wx, wy) {
  const tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE);
  const enemyUnit = unitAt(wx, wy);
  const enemyBuilding = buildingAt(wx, wy);
  const res = resourceAt(tx, ty);

  for (const u of selUnits) {
    if (u.owner !== 0) continue;

    if (enemyUnit && enemyUnit.owner !== 0) {
      u.st = 'attack'; u.atkTgt = enemyUnit.id; u.gRes = null;
      setPath(u, enemyUnit.x, enemyUnit.y);
    } else if (enemyBuilding && enemyBuilding.owner !== 0) {
      u.st = 'attack'; u.atkTgt = enemyBuilding.id; u.gRes = null;
      setPath(u, enemyBuilding.x, enemyBuilding.y);
    } else if (res && u.gather) {
      u.gRes = res; u.st = 'gather'; u.atkTgt = null;
      setPath(u, res.x, res.y);
    } else {
      u.st = 'move'; u.atkTgt = null; u.gRes = null;
      setPath(u, wx, wy);
    }
  }
}

function tryBuild(type, tx, ty) {
  const def = BDEFS[type];
  if (gold   < (def.cost?.gold   || 0)) { addLog('❌', 'Not enough gold!');   return false; }
  if (lumber < (def.cost?.lumber || 0)) { addLog('❌', 'Not enough lumber!'); return false; }
  if (!canPlace(type, tx, ty))           { addLog('❌', 'Cannot build here!'); return false; }

  gold   -= (def.cost?.gold   || 0);
  lumber -= (def.cost?.lumber || 0);

  // Send a selected worker to build
  const worker = selUnits.find(u => u.gather && u.owner === 0);
  if (worker) {
    worker.bTgt  = { type, tx, ty };
    worker.bTick = def.btime;
    worker.st    = 'build';
    setPath(worker, (tx + def.sz / 2) * TILE, (ty + def.sz / 2) * TILE);
    addLog('🏗️', `Worker en route to build ${def.n}...`);
  } else {
    // No worker in selection – place immediately for convenience
    const b = makeBuilding(type, tx, ty, 0);
    b.underConst = 0;
    buildings.push(b);
    addLog('🏗️', `${def.n} placed!`);
  }
  return true;
}

function trainUnit(building, type) {
  const def = UDEFS[type];
  if (gold   < (def.cost?.gold   || 0)) { addLog('❌', 'Not enough gold!');           return; }
  if (lumber < (def.cost?.lumber || 0)) { addLog('❌', 'Not enough lumber!');         return; }
  if (food + (def.food || 0) > foodCap) { addLog('❌', 'Not enough food! Build Farms.'); return; }
  if (building.tq.length >= 5)          { addLog('❌', 'Train queue is full!');        return; }

  gold   -= (def.cost?.gold   || 0);
  lumber -= (def.cost?.lumber || 0);
  building.tq.push(type);
  addLog('⚔️', `Training ${def.n}…`);
  refreshPanel();
}

// ─── WIN / LOSE ───────────────────────────────────────────────────────────────
function checkEnd() {
  if (gameOver) return;
  if (!playerBase(0)) {
    gameOver = true;
    const el = document.getElementById('wc-message');
    el.textContent = '💀 DEFEAT – Your Town Hall has fallen! Click "New Game" to try again.';
    el.className = 'wc-defeat';
  } else if (!playerBase(1)) {
    gameOver = true;
    const el = document.getElementById('wc-message');
    el.textContent = '🏆 VICTORY – The enemy Stronghold is destroyed! Glory to your kingdom!';
    el.className = 'wc-victory';
  }
}

// ─── HUD & PANEL ─────────────────────────────────────────────────────────────
function refreshHUD() {
  document.getElementById('wc-gold').textContent   = gold;
  document.getElementById('wc-lumber').textContent = lumber;
  document.getElementById('wc-food').textContent   = `${food}/${foodCap}`;
  const m = Math.floor(ticks / (LOGIC_FPS * 60));
  const s = Math.floor((ticks / LOGIC_FPS) % 60);
  document.getElementById('wc-time').textContent   = `${m}:${String(s).padStart(2, '0')}`;
}

function refreshPanel() {
  const info = document.getElementById('wc-info');
  const cmds = document.getElementById('wc-cmds');
  cmds.innerHTML = '';

  if (buildMode) {
    info.innerHTML = `<b>Placing: ${BDEFS[buildMode].n}</b><br>
      <span style="color:var(--parchment-dim)">Click on the map to place.<br>Right-click to cancel.</span>`;
    return;
  }

  if (selBuilding) {
    const b = selBuilding;
    const def = BDEFS[b.type];
    const queueStr = b.tq.length ? `<br>🔧 Training: ${UDEFS[b.tq[0]]?.n || b.tq[0]}${b.tq.length > 1 ? ` (+${b.tq.length - 1})` : ''}` : '';
    const constStr = b.underConst > 0 ? `<br>🏗️ Under construction (${b.underConst} ticks)` : '';
    info.innerHTML = `<b>${b.name}</b><br>HP: ${Math.ceil(b.hp)}/${b.maxHp}${constStr}${queueStr}`;

    if (b.underConst <= 0) {
      for (const type of b.trains) {
        const udef = UDEFS[type];
        const btn  = document.createElement('button');
        btn.className = 'wc-btn';
        btn.innerHTML = `${udef.e} ${udef.n}<br><small>🪙${udef.cost?.gold || 0}${udef.cost?.lumber ? ` 🌲${udef.cost.lumber}` : ''} 🍞${udef.food || 0}</small>`;
        btn.onclick = () => trainUnit(b, type);
        cmds.appendChild(btn);
      }
    }
  } else if (selUnits.length > 0) {
    const u = selUnits[0];
    const extra = selUnits.length > 1 ? ` (+${selUnits.length - 1})` : '';
    const carry  = u.carryG ? ' 🪙' : u.carryL ? ' 🌲' : '';
    info.innerHTML = `<b>${u.name}${extra}</b><br>HP: ${Math.ceil(u.hp)}/${u.maxHp}<br>State: ${u.st}${carry}`;

    if (u.gather) {
      const bOpts = [
        { type:'farm',     label:'🌾 Farm',     },
        { type:'barracks', label:'⚔️ Barracks',  },
        { type:'tower',    label:'🗼 Tower',     },
      ];
      for (const opt of bOpts) {
        const def = BDEFS[opt.type];
        const btn = document.createElement('button');
        btn.className = 'wc-btn';
        btn.innerHTML = `${opt.label}<br><small>🪙${def.cost?.gold || 0} 🌲${def.cost?.lumber || 0}</small>`;
        btn.onclick = () => { buildMode = opt.type; refreshPanel(); };
        cmds.appendChild(btn);
      }
    }
  } else {
    info.innerHTML = '<i>Click a unit or building to select it</i>';
  }

  // Log
  const logEl = document.getElementById('wc-log');
  logEl.innerHTML = msgLog.slice(0, 7).map(l =>
    `<div class="wc-log-entry">${l.icon} ${l.msg}</div>`).join('');
}

// ─── RENDERING ───────────────────────────────────────────────────────────────
function render() {
  if (!ctx) return;
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);

  // Terrain
  for (let r = 0; r < MAP_H; r++) {
    for (let c = 0; c < MAP_W; c++) {
      const sx = c * TILE - camX, sy = r * TILE - camY;
      if (sx + TILE < 0 || sy + TILE < 0 || sx > VIEW_W || sy > VIEW_H) continue;
      ctx.fillStyle = TR_CLR[map[r][c]];
      ctx.fillRect(sx, sy, TILE, TILE);
      ctx.strokeStyle = 'rgba(0,0,0,0.08)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(sx, sy, TILE, TILE);
    }
  }

  // Resource nodes
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const res of resources) {
    if (res.amount <= 0) continue;
    const sx = res.x - camX, sy = res.y - camY;
    if (sx < -TILE || sy < -TILE || sx > VIEW_W + TILE || sy > VIEW_H + TILE) continue;
    ctx.font = `${Math.round(TILE * 0.85)}px serif`;
    ctx.fillText(res.emoji, sx, sy);
    // Depletion bar
    const pct = res.amount / res.max;
    ctx.fillStyle = res.type === 'gold' ? '#f5c518' : '#3a8c2a';
    ctx.fillRect(sx - TILE / 2, sy + TILE / 2 - 3, TILE * pct, 4);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx - TILE / 2, sy + TILE / 2 - 3, TILE, 4);
  }

  // Buildings
  for (const b of buildings) {
    if (b.hp <= 0) continue;
    const bw = b.sz * TILE, bh = b.sz * TILE;
    const sx = b.tx * TILE - camX, sy = b.ty * TILE - camY;
    if (sx + bw < 0 || sy + bh < 0 || sx > VIEW_W || sy > VIEW_H) continue;

    ctx.fillStyle = b.underConst > 0
      ? 'rgba(80,60,20,0.55)'
      : (b.owner === 0 ? 'rgba(15,50,120,0.85)' : 'rgba(110,15,15,0.85)');
    ctx.fillRect(sx, sy, bw, bh);

    ctx.strokeStyle = b === selBuilding
      ? '#ffff44'
      : (b.owner === 0 ? '#5588ff' : '#ff5555');
    ctx.lineWidth = b === selBuilding ? 3 : 1.5;
    ctx.strokeRect(sx, sy, bw, bh);

    ctx.font = `${Math.round(bw * 0.55)}px serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.globalAlpha = b.underConst > 0 ? 0.5 : 1.0;
    ctx.fillText(b.emoji, sx + bw / 2, sy + bh / 2);
    ctx.globalAlpha = 1.0;

    if (b.underConst > 0) {
      ctx.fillStyle = '#fff';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🏗️', sx + bw / 2, sy + bh / 2 + bw * 0.25);
    }

    drawBar(sx, sy - 5, bw, b.hp / b.maxHp);

    // Training progress bar
    if (b.tq.length > 0) {
      const trainT = UDEFS[b.tq[0]]?.trainT || 300;
      ctx.fillStyle = '#44aaff';
      ctx.fillRect(sx, sy + bh, bw * (b.tTick / trainT), 3);
    }
  }

  // Units
  for (const u of units) {
    if (u.hp <= 0) continue;
    const sx = u.x - camX, sy = u.y - camY;
    if (sx < -TILE || sy < -TILE || sx > VIEW_W + TILE || sy > VIEW_H + TILE) continue;

    // Selection ring
    if (selUnits.includes(u)) {
      ctx.strokeStyle = '#44ff44';
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.ellipse(sx, sy + TILE * 0.28, TILE * 0.42, TILE * 0.13, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + TILE * 0.28, TILE * 0.32, TILE * 0.10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body circle
    ctx.fillStyle   = u.owner === 0 ? '#1a4fa0' : '#a01a1a';
    ctx.strokeStyle = u.owner === 0 ? '#7aabff' : '#ff7a7a';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.arc(sx, sy, TILE * 0.36, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Emoji
    ctx.font = `${Math.round(TILE * 0.48)}px serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(u.emoji, sx, sy);

    drawBar(sx - TILE / 2, sy - TILE * 0.55, TILE, u.hp / u.maxHp);

    // Carry indicator
    if (u.carryG > 0 || u.carryL > 0) {
      ctx.font = '11px serif';
      ctx.fillText(u.carryG > 0 ? '🪙' : '🌲', sx + TILE * 0.36, sy - TILE * 0.32);
    }
  }

  // Rubber-band selection box
  if (selBox) {
    const x  = Math.min(selBox.x1, selBox.x2);
    const y  = Math.min(selBox.y1, selBox.y2);
    const bw = Math.abs(selBox.x2 - selBox.x1);
    const bh = Math.abs(selBox.y2 - selBox.y1);
    ctx.strokeStyle = '#44ff44';
    ctx.lineWidth   = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(x, y, bw, bh);
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(68,255,68,0.06)';
    ctx.fillRect(x, y, bw, bh);
  }

  // Build-placement ghost
  if (buildMode) {
    const tx  = Math.floor((mX + camX) / TILE);
    const ty  = Math.floor((mY + camY) / TILE);
    const sz  = BDEFS[buildMode].sz;
    const ok  = canPlace(buildMode, tx, ty);
    const sx  = tx * TILE - camX, sy = ty * TILE - camY;
    ctx.fillStyle   = ok ? 'rgba(0,200,0,0.25)' : 'rgba(200,0,0,0.25)';
    ctx.strokeStyle = ok ? '#00cc00' : '#cc0000';
    ctx.lineWidth   = 2;
    ctx.fillRect(sx, sy, sz * TILE, sz * TILE);
    ctx.strokeRect(sx, sy, sz * TILE, sz * TILE);
    ctx.font = `${Math.round(sz * TILE * 0.48)}px serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.75;
    ctx.fillText(BDEFS[buildMode].e, sx + sz * TILE / 2, sy + sz * TILE / 2);
    ctx.globalAlpha = 1.0;
  }

  drawMiniMap();
}

function drawBar(x, y, w, pct) {
  ctx.fillStyle = '#111';
  ctx.fillRect(x, y, w, 4);
  ctx.fillStyle = pct > 0.6 ? '#33cc33' : pct > 0.3 ? '#ccaa22' : '#cc2222';
  ctx.fillRect(x, y, w * Math.max(0, pct), 4);
}

function drawMiniMap() {
  const mmX = VIEW_W - 132, mmY = VIEW_H - 88, mmW = 122, mmH = 78;
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillRect(mmX - 2, mmY - 2, mmW + 4, mmH + 4);
  ctx.strokeStyle = '#555'; ctx.lineWidth = 1;
  ctx.strokeRect(mmX - 2, mmY - 2, mmW + 4, mmH + 4);

  const scX = mmW / (MAP_W * TILE), scY = mmH / (MAP_H * TILE);

  // Terrain
  for (let r = 0; r < MAP_H; r++) {
    for (let c = 0; c < MAP_W; c++) {
      ctx.fillStyle = TR_CLR[map[r][c]];
      ctx.fillRect(mmX + c * scX * TILE, mmY + r * scY * TILE,
                   Math.ceil(scX * TILE) + 1, Math.ceil(scY * TILE) + 1);
    }
  }

  // Buildings
  for (const b of buildings) {
    if (b.hp <= 0) continue;
    ctx.fillStyle = b.owner === 0 ? '#4488ff' : '#ff4444';
    ctx.fillRect(mmX + b.x * scX, mmY + b.y * scY, Math.max(3, b.sz * TILE * scX), Math.max(3, b.sz * TILE * scY));
  }
  // Units
  for (const u of units) {
    if (u.hp <= 0) continue;
    ctx.fillStyle = u.owner === 0 ? '#88ccff' : '#ff8888';
    ctx.fillRect(mmX + u.x * scX - 1, mmY + u.y * scY - 1, 2, 2);
  }

  // Viewport rect
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 0.75;
  ctx.strokeRect(mmX + camX * scX, mmY + camY * scY, VIEW_W * scX, VIEW_H * scY);
}

// ─── INPUT ───────────────────────────────────────────────────────────────────
function toWorld(cx, cy) { return { wx: cx + camX, wy: cy + camY }; }
function clampCam(v, axis) {
  return axis === 'x'
    ? Math.max(0, Math.min(MAP_W * TILE - VIEW_W, v))
    : Math.max(0, Math.min(MAP_H * TILE - VIEW_H, v));
}

function setupInput() {
  canvas.addEventListener('mouseenter', () => { mouseOnCanvas = true; });
  canvas.addEventListener('mouseleave', () => { mouseOnCanvas = false; mDown = false; dragStart = null; selBox = null; });

  canvas.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    mDown = true;
    const r = canvas.getBoundingClientRect();
    const cx = e.clientX - r.left, cy = e.clientY - r.top;
    dragStart = { x: cx, y: cy };
  });

  canvas.addEventListener('mousemove', e => {
    const r = canvas.getBoundingClientRect();
    mX = e.clientX - r.left; mY = e.clientY - r.top;
    if (mDown && dragStart) {
      const dx = mX - dragStart.x, dy = mY - dragStart.y;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5)
        selBox = { x1: dragStart.x, y1: dragStart.y, x2: mX, y2: mY };
    }
  });

  canvas.addEventListener('mouseup', e => {
    if (e.button !== 0) return;
    const r  = canvas.getBoundingClientRect();
    const cx = e.clientX - r.left, cy = e.clientY - r.top;
    const { wx, wy } = toWorld(cx, cy);

    if (buildMode) {
      const tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE);
      tryBuild(buildMode, tx, ty);
      buildMode = null;
      refreshPanel();
      mDown = false; dragStart = null; selBox = null;
      return;
    }

    if (selBox) {
      const x1w = Math.min(selBox.x1, selBox.x2) + camX;
      const y1w = Math.min(selBox.y1, selBox.y2) + camY;
      const x2w = Math.max(selBox.x1, selBox.x2) + camX;
      const y2w = Math.max(selBox.y1, selBox.y2) + camY;
      selUnits     = units.filter(u => u.owner === 0 && u.x >= x1w && u.x <= x2w && u.y >= y1w && u.y <= y2w);
      selBuilding  = null;
    } else if (dragStart) {
      // Single click
      const u = unitAt(wx, wy);
      const b = buildingAt(wx, wy);
      if (u && u.owner === 0)      { selUnits = [u]; selBuilding = null; }
      else if (b && b.owner === 0) { selBuilding = b; selUnits = []; }
      else                          { selUnits = []; selBuilding = null; }
    }

    mDown = false; dragStart = null; selBox = null;
    refreshPanel();
  });

  canvas.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (buildMode) { buildMode = null; refreshPanel(); return; }
    const r  = canvas.getBoundingClientRect();
    const cx = e.clientX - r.left, cy = e.clientY - r.top;
    const { wx, wy } = toWorld(cx, cy);
    if (selUnits.length > 0) cmdUnits(wx, wy);
  });

  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    camX = clampCam(camX + e.deltaX * 0.6, 'x');
    camY = clampCam(camY + e.deltaY * 0.6, 'y');
  }, { passive: false });

  document.addEventListener('keydown', e => {
    const s = TILE * 2;
    if (e.key === 'ArrowLeft'  || e.key === 'a') camX = clampCam(camX - s, 'x');
    if (e.key === 'ArrowRight' || e.key === 'd') camX = clampCam(camX + s, 'x');
    if (e.key === 'ArrowUp'    || e.key === 'w') camY = clampCam(camY - s, 'y');
    if (e.key === 'ArrowDown'  || e.key === 's') camY = clampCam(camY + s, 'y');
    if (e.key === 'Escape') { buildMode = null; selUnits = []; selBuilding = null; refreshPanel(); }
  });
}

// Camera edge scrolling
function edgeScroll() {
  if (!mouseOnCanvas) return;
  if (mX < CAM_EDGE)             camX = clampCam(camX - CAM_SPD, 'x');
  if (mX > VIEW_W - CAM_EDGE)    camX = clampCam(camX + CAM_SPD, 'x');
  if (mY < CAM_EDGE)             camY = clampCam(camY - CAM_SPD, 'y');
  if (mY > VIEW_H - CAM_EDGE)    camY = clampCam(camY + CAM_SPD, 'y');
}

// ─── GAME LOOP ────────────────────────────────────────────────────────────────
const STEP = 1000 / LOGIC_FPS;
let acc = 0, last = 0;

function loop(ts) {
  const dt = Math.min(ts - last, 150);
  last = ts;

  if (!gameOver) {
    acc += dt;
    while (acc >= STEP) {
      updateUnits();
      updateBuildings();
      updateCounters();
      updateAI();
      checkEnd();
      ticks++;
      acc -= STEP;
    }
    edgeScroll();
    refreshHUD();
    // Panel refresh every ~10 frames to keep selection info current
    if (ticks % 10 === 0) refreshPanel();
  }

  render();
  requestAnimationFrame(loop);
}

// ─── BOOTSTRAP ───────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  canvas = document.getElementById('wc-canvas');
  ctx    = canvas.getContext('2d');

  document.getElementById('btn-new-wc').addEventListener('click', () => {
    gameOver = false;
    initGame();
  });

  setupInput();
  initGame();

  last = performance.now();
  requestAnimationFrame(loop);
});
