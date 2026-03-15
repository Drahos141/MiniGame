// Kingdom Wars – Full strategy game with resource management, buildings, units, and AI

// =================== CONSTANTS ===================
const COLS = 15, ROWS = 10;

const TERRAIN_TYPES = ['grass','forest','mountain','water','plains'];
const TERRAIN_EMOJI = { grass:'🌿', forest:'🌲', mountain:'⛰️', water:'🌊', plains:'🏔️' };
const TERRAIN_PASSABLE = { grass:true, forest:true, mountain:false, water:false, plains:true };

const BUILDINGS = {
  castle:  { name:'Castle',     emoji:'🏰', cost:{}, defense:20, maxHp:100 },
  lumbermill:{ name:'Lumber Mill',emoji:'🪵', cost:{wood:50,stone:20}, gen:{wood:10}, maxHp:30 },
  mine:    { name:'Mine',       emoji:'⛏️', cost:{wood:40,stone:30}, gen:{stone:8,gold:2}, maxHp:30 },
  farm:    { name:'Farm',       emoji:'🌾', cost:{wood:30,stone:10}, gen:{food:15}, maxHp:30 },
  barracks:{ name:'Barracks',   emoji:'⚔️', cost:{wood:80,stone:60,gold:40}, trainable:true, maxHp:50 },
  tower:   { name:'Tower',      emoji:'🗼', cost:{wood:60,stone:80}, defense:10, attackRange:2, attackPow:5, maxHp:60 },
  market:  { name:'Market',     emoji:'🏪', cost:{wood:50,stone:30,gold:20}, gen:{gold:5}, maxHp:30 },
};

const UNITS = {
  soldier: { name:'Soldier', emoji:'⚔️', cost:{gold:20,food:10}, atk:5, def:3, hp:20, maxHp:20, speed:1, owner:null },
  archer:  { name:'Archer',  emoji:'🏹', cost:{gold:30,food:15}, atk:7, def:2, hp:15, maxHp:15, speed:1, range:3, owner:null },
  knight:  { name:'Knight',  emoji:'🐴', cost:{gold:50,food:25}, atk:10, def:6, hp:35, maxHp:35, speed:2, owner:null },
};

const AI_UNITS = {
  goblin:  { name:'Goblin',  emoji:'👺', atk:4, def:1, hp:8,  maxHp:8,  speed:1, owner:'ai' },
  troll:   { name:'Troll',   emoji:'🛡️', atk:6, def:4, hp:20, maxHp:20, speed:1, owner:'ai' },
  dragon:  { name:'Dragon',  emoji:'🐉', atk:12, def:3, hp:30, maxHp:30, speed:2, owner:'ai' },
};

const playerCount = parseInt(localStorage.getItem('miniGamePlayers') || '1', 10);
const pvp = playerCount >= 2; // player 2 controls right side instead of AI

// =================== STATE ===================
let map = [];          // 2D array of { terrain, building, unit, owner }
let resources = [
  { wood:100, stone:50, gold:50, food:100 },
  { wood:100, stone:50, gold:50, food:100 },
];
let turn = 1;
let currentSide = 0;   // 0 = player1/left, 1 = player2/right or AI
let selectedCell = null;
let selectedUnit = null;
let unitMoved = {};    // track which units moved this turn
let gameOver = false;

// =================== MAP GENERATION ===================
function generateMap() {
  map = [];
  for (let r = 0; r < ROWS; r++) {
    map[r] = [];
    for (let c = 0; c < COLS; c++) {
      let terrain = randomTerrain(r, c);
      map[r][c] = { terrain, building: null, unit: null, owner: null };
    }
  }
  // Place castles
  map[ROWS >> 1][1].building = 'castle';
  map[ROWS >> 1][1].owner = 0;
  map[ROWS >> 1][COLS - 2].building = 'castle';
  map[ROWS >> 1][COLS - 2].owner = 1;
  // Clear terrain around castles
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    const nr = (ROWS >> 1) + dr, nc1 = 1 + dc, nc2 = COLS - 2 + dc;
    if (nr >= 0 && nr < ROWS) {
      if (nc1 >= 0 && nc1 < COLS) map[nr][nc1].terrain = 'plains';
      if (nc2 >= 0 && nc2 < COLS) map[nr][nc2].terrain = 'plains';
    }
  }
  // Place some forest and mountains in the middle
  for (let r = 0; r < ROWS; r++) {
    for (let c = 3; c < COLS - 3; c++) {
      if (map[r][c].building) continue;
      const noise = Math.random();
      if (noise < 0.15) map[r][c].terrain = 'forest';
      else if (noise < 0.22) map[r][c].terrain = 'mountain';
      else if (noise < 0.27) map[r][c].terrain = 'water';
    }
  }
}

function randomTerrain(r, c) {
  if (c < 3) return 'plains';
  if (c >= COLS - 3) return 'plains';
  const n = Math.random();
  if (n < 0.5) return 'grass';
  if (n < 0.7) return 'plains';
  if (n < 0.85) return 'forest';
  return 'grass';
}

// =================== RENDER ===================
function renderMap() {
  const table = document.getElementById('strategy-map');
  table.innerHTML = '';
  for (let r = 0; r < ROWS; r++) {
    const tr = document.createElement('tr');
    for (let c = 0; c < COLS; c++) {
      const cell = map[r][c];
      const td = document.createElement('td');
      td.className = `map-cell terrain-${cell.terrain}`;
      td.dataset.r = r;
      td.dataset.c = c;

      let content = TERRAIN_EMOJI[cell.terrain];
      if (cell.building) {
        const b = BUILDINGS[cell.building];
        content = `<span class="cell-building">${b.emoji}</span>`;
      }
      if (cell.unit) {
        content += `<span class="cell-unit">${cell.unit.emoji}</span>`;
      }
      td.innerHTML = content;

      // Highlight selected
      if (selectedCell && selectedCell.r === r && selectedCell.c === c) {
        td.classList.add('selected');
      }

      td.addEventListener('click', () => handleCellClick(r, c));
      tr.appendChild(td);
    }
    table.appendChild(tr);
  }
}

// =================== CELL CLICK ===================
function handleCellClick(r, c) {
  if (gameOver) return;
  const cell = map[r][c];

  // If we have a selected unit and click a valid move target
  if (selectedUnit) {
    const { unitR, unitC } = selectedUnit;
    if (unitR === r && unitC === c) {
      // Deselect
      selectedUnit = null;
      selectedCell = null;
      renderMap();
      updatePanel(r, c);
      return;
    }

    // Try to move or attack
    const unitCell = map[unitR][unitC];
    if (!unitCell.unit) { selectedUnit = null; selectedCell = null; }
    else if (canMoveTo(unitR, unitC, r, c)) {
      moveUnit(unitR, unitC, r, c);
      selectedUnit = null;
      selectedCell = { r, c };
      renderMap();
      updatePanel(r, c);
      return;
    } else if (cell.unit && cell.unit.owner !== currentSide && canAttack(unitR, unitC, r, c)) {
      combatUnit(unitR, unitC, r, c);
      selectedUnit = null;
      selectedCell = null;
      renderMap();
      return;
    } else if (cell.building && cell.owner !== currentSide && distanceTo(unitR, unitC, r, c) <= 1) {
      attackBuilding(unitR, unitC, r, c);
      selectedUnit = null;
      selectedCell = null;
      renderMap();
      return;
    }
    selectedUnit = null;
  }

  selectedCell = { r, c };

  // Select unit for movement
  if (cell.unit && cell.unit.owner === currentSide && !unitMoved[`${r},${c}`]) {
    selectedUnit = { unitR: r, unitC: c };
  }

  renderMap();
  updatePanel(r, c);
}

function distanceTo(r1, c1, r2, c2) {
  return Math.abs(r1 - r2) + Math.abs(c1 - c2);
}

function canMoveTo(fromR, fromC, toR, toC) {
  const unit = map[fromR][fromC].unit;
  if (!unit) return false;
  const dist = distanceTo(fromR, fromC, toR, toC);
  const target = map[toR][toC];
  return dist <= (unit.speed || 1) &&
    TERRAIN_PASSABLE[target.terrain] &&
    !target.unit &&
    !target.building;
}

function canAttack(fromR, fromC, toR, toC) {
  const unit = map[fromR][fromC].unit;
  const range = unit.range ?? 1;
  return distanceTo(fromR, fromC, toR, toC) <= range;
}

function moveUnit(fromR, fromC, toR, toC) {
  const unit = map[fromR][fromC].unit;
  map[toR][toC].unit = unit;
  map[fromR][fromC].unit = null;
  unitMoved[`${toR},${toC}`] = true;
  log(`${unit.emoji} ${unit.name} moves`);
}

function combatUnit(atkR, atkC, defR, defC) {
  const attacker = map[atkR][atkC].unit;
  const defender = map[defR][defC].unit;
  const dmg = Math.max(1, attacker.atk - defender.def + randInt(-1, 2));
  defender.hp -= dmg;
  log(`${attacker.emoji} attacks ${defender.emoji} for ${dmg} dmg (${defender.hp}/${defender.maxHp} HP)`);
  if (defender.hp <= 0) {
    log(`${defender.emoji} ${defender.name} is slain!`);
    map[defR][defC].unit = null;
  }
  unitMoved[`${atkR},${atkC}`] = true;
}

function attackBuilding(atkR, atkC, defR, defC) {
  const attacker = map[atkR][atkC].unit;
  const cell = map[defR][defC];
  const bData = BUILDINGS[cell.building];
  if (!bData.maxHp) return;
  if (!cell.buildingHp) cell.buildingHp = bData.maxHp;
  const dmg = Math.max(1, attacker.atk - 2);
  cell.buildingHp -= dmg;
  log(`${attacker.emoji} attacks ${bData.emoji} ${bData.name} for ${dmg} dmg`);
  if (cell.buildingHp <= 0) {
    log(`${bData.emoji} ${bData.name} is destroyed!`);
    if (cell.building === 'castle') {
      const winner = currentSide === 0 ? 'Player 1' : (pvp ? 'Player 2' : 'AI');
      gameOver = true;
      showMessage(`🏆 ${winner} wins by destroying the castle!`);
    }
    cell.building = null;
    cell.owner = null;
  }
  unitMoved[`${atkR},${atkC}`] = true;
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// =================== PANEL UPDATE ===================
function updatePanel(r, c) {
  const cell = map[r][c];
  const info = document.getElementById('panel-info-content');
  let html = `<b>Tile (${r},${c})</b><br>`;
  html += `Terrain: ${TERRAIN_EMOJI[cell.terrain]} ${cell.terrain}<br>`;
  if (cell.building) {
    const b = BUILDINGS[cell.building];
    html += `Building: ${b.emoji} ${b.name}<br>`;
    if (cell.owner !== null) html += `Owner: ${cell.owner === 0 ? '🔵 P1' : (pvp ? '🔴 P2' : '🔴 AI')}<br>`;
    if (cell.buildingHp) html += `HP: ${cell.buildingHp}/${b.maxHp}<br>`;
    if (b.gen) {
      const gens = Object.entries(b.gen).map(([k,v]) => `+${v} ${k}`).join(', ');
      html += `Generates: ${gens}/turn<br>`;
    }
  }
  if (cell.unit) {
    const u = cell.unit;
    html += `Unit: ${u.emoji} ${u.name}<br>`;
    html += `HP: ${u.hp}/${u.maxHp} | ATK: ${u.atk} | DEF: ${u.def}<br>`;
    const moved = unitMoved[`${r},${c}`] ? '(moved)' : '(ready)';
    html += `Status: ${moved}<br>`;
  }
  info.innerHTML = html;

  // Build options (only on empty passable tiles owned/near player, if current player's turn)
  updateBuildPanel(r, c);
  updateTrainPanel();
}

function updateBuildPanel(r, c) {
  const buildDiv = document.getElementById('build-options');
  buildDiv.innerHTML = '';
  const cell = map[r][c];
  const res = resources[0]; // player 1 always left

  // Only show build options for player's tiles or adjacent empty tiles
  const canBuild = currentSide === 0 &&
    !cell.building && !cell.unit &&
    TERRAIN_PASSABLE[cell.terrain];

  if (!canBuild) {
    buildDiv.innerHTML = '<span style="font-family:\'Cinzel\',serif;font-size:0.72rem;color:var(--parchment-dim);">Select an empty tile</span>';
    return;
  }

  Object.entries(BUILDINGS).forEach(([key, b]) => {
    if (key === 'castle') return; // can't build castles
    const div = document.createElement('div');
    div.className = 'build-option';
    const canAfford = Object.entries(b.cost).every(([k, v]) => (res[k] || 0) >= v);
    if (!canAfford) div.classList.add('disabled');
    const costStr = Object.entries(b.cost).map(([k,v]) => `${v}${k[0].toUpperCase()}`).join(' ');
    div.innerHTML = `<span class="build-icon">${b.emoji}</span>
      <div><div>${b.name}</div><div class="build-cost">${costStr}</div></div>`;
    if (canAfford) {
      div.addEventListener('click', () => buildAt(r, c, key));
    }
    buildDiv.appendChild(div);
  });
}

function updateTrainPanel() {
  const trainDiv = document.getElementById('train-options');
  trainDiv.innerHTML = '';
  if (currentSide !== 0) {
    trainDiv.innerHTML = '<span style="font-family:\'Cinzel\',serif;font-size:0.72rem;color:var(--parchment-dim);">Not your turn</span>';
    return;
  }

  // Check if player has a barracks
  const hasBarracks = map.some(row => row.some(c => c.building === 'barracks' && c.owner === 0));
  if (!hasBarracks) {
    trainDiv.innerHTML = '<span style="font-family:\'Cinzel\',serif;font-size:0.72rem;color:var(--parchment-dim);">Build a Barracks first</span>';
    return;
  }

  const res = resources[0];
  Object.entries(UNITS).forEach(([key, u]) => {
    const div = document.createElement('div');
    div.className = 'build-option';
    const canAfford = Object.entries(u.cost).every(([k,v]) => (res[k] || 0) >= v);
    if (!canAfford) div.classList.add('disabled');
    const costStr = Object.entries(u.cost).map(([k,v]) => `${v}${k[0].toUpperCase()}`).join(' ');
    div.innerHTML = `<span class="build-icon">${u.emoji}</span>
      <div><div>${u.name}</div><div class="build-cost">${costStr} | ATK:${u.atk} DEF:${u.def} HP:${u.hp}</div></div>`;
    if (canAfford) {
      div.addEventListener('click', () => trainUnit(key));
    }
    trainDiv.appendChild(div);
  });
}

// =================== BUILDING ===================
function buildAt(r, c, buildingKey) {
  if (currentSide !== 0) return;
  const b = BUILDINGS[buildingKey];
  const res = resources[0];
  if (!Object.entries(b.cost).every(([k,v]) => (res[k]||0) >= v)) return;

  // Deduct cost
  Object.entries(b.cost).forEach(([k,v]) => { res[k] -= v; });
  map[r][c].building = buildingKey;
  map[r][c].owner = 0;
  map[r][c].buildingHp = b.maxHp;

  log(`${b.emoji} Built ${b.name} at (${r},${c})`);
  updateResourceDisplay();
  renderMap();
  updateBuildPanel(r, c);
}

// =================== TRAINING ===================
function trainUnit(unitKey) {
  if (currentSide !== 0) return;
  const u = UNITS[unitKey];
  const res = resources[0];
  if (!Object.entries(u.cost).every(([k,v]) => (res[k]||0) >= v)) return;

  // Find an empty tile near player's barracks
  let spawnR = -1, spawnC = -1;
  outer: for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS >> 1; c++) {
      if (!map[r][c].unit && !map[r][c].building && TERRAIN_PASSABLE[map[r][c].terrain]) {
        spawnR = r; spawnC = c; break outer;
      }
    }
  }
  if (spawnR === -1) { log('No space to train unit!'); return; }

  Object.entries(u.cost).forEach(([k,v]) => { res[k] -= v; });
  map[spawnR][spawnC].unit = { ...u, owner: 0, hp: u.maxHp };
  log(`${u.emoji} Trained ${u.name}`);
  updateResourceDisplay();
  renderMap();
  updateTrainPanel();
}

// =================== RESOURCE DISPLAY ===================
function updateResourceDisplay() {
  const res = resources[currentSide === 0 ? 0 : (pvp ? 1 : 0)];
  const r0 = resources[0];
  document.getElementById('res-wood').textContent  = r0.wood;
  document.getElementById('res-stone').textContent = r0.stone;
  document.getElementById('res-gold').textContent  = r0.gold;
  document.getElementById('res-food').textContent  = r0.food;
}

// =================== END TURN ===================
function endTurn() {
  if (gameOver) return;

  if (pvp) {
    // Alternate between player 1 and player 2
    collectResources(currentSide);
    towerAttacks(currentSide);
    unitMoved = {};
    currentSide = currentSide === 0 ? 1 : 0;
    if (currentSide === 0) turn++;
    selectedCell = null;
    selectedUnit = null;
    document.getElementById('strategy-turn-info').textContent = `Turn ${turn} | Player ${currentSide + 1}`;
    log(`--- Player ${currentSide + 1}'s Turn (Turn ${turn}) ---`);
  } else {
    // Player ends turn → AI acts
    collectResources(0);
    towerAttacks(0);
    unitMoved = {};
    currentSide = 1;
    document.getElementById('strategy-turn-info').textContent = `Turn ${turn} | AI thinking…`;
    document.getElementById('btn-end-turn').disabled = true;
    log(`--- AI Turn ${turn} ---`);
    setTimeout(() => {
      aiTurn();
      collectResources(1);
      towerAttacks(1);
      unitMoved = {};
      currentSide = 0;
      turn++;
      document.getElementById('strategy-turn-info').textContent = `Turn ${turn} | Player 1`;
      document.getElementById('btn-end-turn').disabled = false;
      log(`--- Player 1 Turn ${turn} ---`);
      selectedCell = null;
      selectedUnit = null;
      updateResourceDisplay();
      renderMap();
    }, 800);
  }

  updateResourceDisplay();
  renderMap();
}

function collectResources(side) {
  map.forEach(row => row.forEach(cell => {
    if (cell.building && cell.owner === side) {
      const b = BUILDINGS[cell.building];
      if (b.gen) {
        const res = resources[side];
        Object.entries(b.gen).forEach(([k, v]) => {
          res[k] = Math.min(999, (res[k] || 0) + v);
        });
      }
    }
  }));
}

function towerAttacks(side) {
  map.forEach((row, r) => row.forEach((cell, c) => {
    if (cell.building === 'tower' && cell.owner === side) {
      const range = BUILDINGS.tower.attackRange;
      const power = BUILDINGS.tower.attackPow;
      // Find nearest enemy unit in range
      for (let dr = -range; dr <= range; dr++) {
        for (let dc = -range; dc <= range; dc++) {
          const nr = r + dr, nc = c + dc;
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
          const target = map[nr][nc];
          if (target.unit && target.unit.owner !== side) {
            target.unit.hp -= power;
            log(`🗼 Tower hits ${target.unit.emoji} for ${power} dmg`);
            if (target.unit.hp <= 0) {
              log(`${target.unit.emoji} destroyed by tower!`);
              target.unit = null;
            }
            return;
          }
        }
      }
    }
  }));
}

// =================== AI ===================
function aiTurn() {
  if (gameOver) return;
  const aiRes = resources[1];

  // Build logic: prefer farm → barracks → tower
  const buildPriority = ['farm','barracks','tower','mine','lumbermill','market'];
  for (const key of buildPriority) {
    const b = BUILDINGS[key];
    if (Object.entries(b.cost).every(([k,v]) => (aiRes[k]||0) >= v)) {
      // Find an empty tile on right half
      for (let r = 0; r < ROWS; r++) {
        for (let c = COLS - 1; c >= COLS >> 1; c--) {
          const cell = map[r][c];
          if (!cell.building && !cell.unit && TERRAIN_PASSABLE[cell.terrain]) {
            Object.entries(b.cost).forEach(([k,v]) => { aiRes[k] -= v; });
            cell.building = key;
            cell.owner = 1;
            cell.buildingHp = b.maxHp;
            log(`AI builds ${b.emoji} ${b.name}`);
            break;
          }
        }
      }
      break;
    }
  }

  // Train units if barracks exists
  const hasBarracks = map.some(row => row.some(c => c.building === 'barracks' && c.owner === 1));
  if (hasBarracks && aiRes.gold >= 20 && aiRes.food >= 10) {
    const unitKey = aiRes.gold >= 50 ? 'knight' : aiRes.gold >= 30 ? 'archer' : 'soldier';
    const u = UNITS[unitKey];
    if (Object.entries(u.cost).every(([k,v]) => (aiRes[k]||0) >= v)) {
      for (let r = 0; r < ROWS; r++) {
        for (let c = COLS - 1; c >= COLS >> 1; c--) {
          const cell = map[r][c];
          if (!cell.unit && !cell.building && TERRAIN_PASSABLE[cell.terrain]) {
            Object.entries(u.cost).forEach(([k,v]) => { aiRes[k] -= v; });
            cell.unit = { ...u, owner: 1, hp: u.maxHp };
            log(`AI trains ${u.emoji} ${u.name}`);
            break;
          }
        }
      }
    }
  }

  // Move/attack with all AI units
  for (let r = 0; r < ROWS; r++) {
    for (let c = COLS - 1; c >= 0; c--) {
      const cell = map[r][c];
      if (!cell.unit || cell.unit.owner !== 1) continue;
      if (unitMoved[`${r},${c}`]) continue;

      // Try to attack adjacent player units or building
      let attacked = false;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr, nc = c + dc;
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
          const t = map[nr][nc];
          if (t.unit && t.unit.owner === 0) {
            combatUnit(r, c, nr, nc);
            attacked = true;
            break;
          } else if (t.building && t.owner === 0) {
            attackBuilding(r, c, nr, nc);
            attacked = true;
            break;
          }
        }
        if (attacked) break;
      }
      if (attacked || !map[r][c].unit) continue;

      // Move toward player castle
      const targetC = 1;
      const targetR = ROWS >> 1;
      const dc = targetC < c ? -1 : targetC > c ? 1 : 0;
      const dr = targetR < r ? -1 : targetR > r ? 1 : 0;
      const moveC = c + dc, moveR = r + dr;
      if (moveR >= 0 && moveR < ROWS && moveC >= 0 && moveC < COLS &&
          TERRAIN_PASSABLE[map[moveR][moveC].terrain] && !map[moveR][moveC].unit && !map[moveR][moveC].building) {
        map[moveR][moveC].unit = map[r][c].unit;
        map[r][c].unit = null;
        unitMoved[`${moveR},${moveC}`] = true;
      }
    }
  }
}

// =================== LOG ===================
function log(msg) {
  const logEl = document.getElementById('strategy-log');
  logEl.textContent = msg + '\n' + logEl.textContent;
  if (logEl.textContent.length > 1000) logEl.textContent = logEl.textContent.slice(0, 1000);
}

function showMessage(msg) {
  const el = document.getElementById('strategy-message');
  el.textContent = msg;
  el.classList.remove('hidden');
}

// =================== INIT ===================
function initGame() {
  gameOver = false;
  turn = 1;
  currentSide = 0;
  selectedCell = null;
  selectedUnit = null;
  unitMoved = {};
  resources = [
    { wood:100, stone:50, gold:50, food:100 },
    { wood:100, stone:50, gold:50, food:100 },
  ];

  generateMap();
  renderMap();
  updateResourceDisplay();
  document.getElementById('strategy-turn-info').textContent = `Turn 1 | Player 1`;
  document.getElementById('strategy-message').classList.add('hidden');
  document.getElementById('strategy-log').textContent = '';
  document.getElementById('btn-end-turn').disabled = false;
  log('⚔️ Kingdom Wars has begun!');
  log('Click tiles to select, build, and train units.');
  log('Click End Turn to advance — destroy the enemy castle to win!');
  if (pvp) log(`2-Player Mode: Players alternate turns.`);
}

document.getElementById('btn-end-turn').addEventListener('click', endTurn);
initGame();
