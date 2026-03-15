// Dungeon Dice – RPG dice game with enemy waves and multiplayer support

const DICE_FACES = ['⚔️', '🛡️', '💀', '✨', '💊', '🎯'];
// ⚔️ attack +3,  🛡️ defense +3,  💀 lose 2 HP,  ✨ magic +5 atk,  💊 heal 4,  🎯 critical x2

const ENEMIES = [
  { name: 'Goblin',  emoji: '👺', maxHp: 10, attack: [1, 4] },
  { name: 'Orc',     emoji: '👹', maxHp: 20, attack: [2, 6] },
  { name: 'Dragon',  emoji: '🐉', maxHp: 40, attack: [4, 10] },
];

const PLAYER_MAX_HP = 20;
const playerCount = parseInt(localStorage.getItem('miniGamePlayers') || '1', 10);

let currentPlayer = 0;
let playerHP = Array(playerCount).fill(PLAYER_MAX_HP);
let playerAlive = Array(playerCount).fill(true);
let wave = 0;
let enemy = null;
let gameActive = false;

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function rollDie() {
  return DICE_FACES[Math.floor(Math.random() * DICE_FACES.length)];
}

function initGame() {
  wave = 0;
  currentPlayer = 0;
  playerHP = Array(playerCount).fill(PLAYER_MAX_HP);
  playerAlive = Array(playerCount).fill(true);
  gameActive = true;

  document.getElementById('dungeon-message').classList.add('hidden');
  document.getElementById('dungeon-log').innerHTML = '';
  document.getElementById('attack-die').textContent = '⚔️';
  document.getElementById('defense-die').textContent = '🛡️';
  document.getElementById('btn-roll-dice').disabled = false;

  updatePlayerBanner();
  renderPlayerHP();
  spawnEnemy();
}

function spawnEnemy() {
  if (wave >= ENEMIES.length) {
    winGame();
    return;
  }
  enemy = { ...ENEMIES[wave], hp: ENEMIES[wave].maxHp };
  wave++;
  document.getElementById('dungeon-wave').textContent = `${wave}/3`;
  document.getElementById('enemy-name').textContent = enemy.name;
  document.getElementById('enemy-emoji').textContent = enemy.emoji;
  updateEnemyHP();
  log(`⚔️ Wave ${wave}: ${enemy.emoji} ${enemy.name} appears! (${enemy.hp} HP)`, 'log-info');
}

function doRoll() {
  if (!gameActive) return;
  const btn = document.getElementById('btn-roll-dice');
  btn.disabled = true;

  const atkDie = document.getElementById('attack-die');
  const defDie = document.getElementById('defense-die');

  // Animate dice
  atkDie.classList.add('rolling');
  defDie.classList.add('rolling');

  setTimeout(() => {
    atkDie.classList.remove('rolling');
    defDie.classList.remove('rolling');

    const attackFace = rollDie();
    const defenseFace = rollDie();
    atkDie.textContent = attackFace;
    defDie.textContent = defenseFace;

    resolveTurn(attackFace, defenseFace);
    btn.disabled = false;
  }, 550);
}

function resolveTurn(attackFace, defenseFace) {
  const pIdx = currentPlayer;
  let playerDmg = 0;
  let enemyDmg = 0;
  let defenseBonus = 0;
  let logLines = [];

  // Resolve defense die first
  switch (defenseFace) {
    case '🛡️': defenseBonus = 3; logLines.push({ msg: `P${pIdx+1} raises shield! (+3 defense)`, cls: 'log-good' }); break;
    case '✨': defenseBonus = 2; logLines.push({ msg: `P${pIdx+1} conjures a ward! (+2 defense)`, cls: 'log-good' }); break;
    case '💀': playerDmg += 2; logLines.push({ msg: `💀 Dark omen! P${pIdx+1} loses 2 HP`, cls: 'log-bad' }); break;
    case '💊': playerHP[pIdx] = Math.min(PLAYER_MAX_HP, playerHP[pIdx] + 4); logLines.push({ msg: `💊 P${pIdx+1} drinks a potion! (+4 HP)`, cls: 'log-good' }); break;
    default: logLines.push({ msg: `P${pIdx+1} braces for impact`, cls: '' }); break;
  }

  // Resolve attack die
  switch (attackFace) {
    case '⚔️': enemyDmg = 3; logLines.push({ msg: `⚔️ P${pIdx+1} strikes for 3 damage!`, cls: 'log-good' }); break;
    case '🎯': enemyDmg = 6; logLines.push({ msg: `🎯 Critical hit! P${pIdx+1} deals 6 damage!`, cls: 'log-good' }); break;
    case '✨': enemyDmg = 5; logLines.push({ msg: `✨ Magic blast! P${pIdx+1} deals 5 damage!`, cls: 'log-good' }); break;
    case '💀': playerDmg += 3; logLines.push({ msg: `💀 The attack backfires! P${pIdx+1} takes 3 damage`, cls: 'log-bad' }); break;
    case '🛡️': logLines.push({ msg: `🛡️ P${pIdx+1} defends instead of attacking`, cls: '' }); break;
    case '💊': playerHP[pIdx] = Math.min(PLAYER_MAX_HP, playerHP[pIdx] + 2); logLines.push({ msg: `💊 P${pIdx+1} finds a herb! (+2 HP)`, cls: 'log-good' }); break;
  }

  // Enemy counter-attack
  const enemyAtk = randInt(enemy.attack[0], enemy.attack[1]);
  const dmgToPlayer = Math.max(0, enemyAtk - defenseBonus);
  if (dmgToPlayer > 0) {
    playerDmg += dmgToPlayer;
    logLines.push({ msg: `${enemy.emoji} ${enemy.name} attacks P${pIdx+1} for ${dmgToPlayer} damage (${enemyAtk} - ${defenseBonus} def)`, cls: 'log-bad' });
  } else {
    logLines.push({ msg: `🛡️ Defense blocked all ${enemyAtk} dmg from ${enemy.name}!`, cls: 'log-good' });
  }

  // Apply damage to enemy
  if (enemyDmg > 0) {
    enemy.hp = Math.max(0, enemy.hp - enemyDmg);
    updateEnemyHP();
  }

  // Apply damage to player
  playerHP[pIdx] = Math.max(0, playerHP[pIdx] - playerDmg);

  logLines.forEach(l => log(l.msg, l.cls));
  renderPlayerHP();
  updateHUDHP();

  // Check enemy death
  if (enemy.hp <= 0) {
    log(`💥 ${enemy.emoji} ${enemy.name} has been defeated!`, 'log-info');
    setTimeout(() => {
      if (wave >= ENEMIES.length) {
        winGame();
      } else {
        nextPlayerTurn(true);
      }
    }, 800);
    return;
  }

  // Check player death
  if (playerHP[pIdx] <= 0) {
    playerAlive[pIdx] = false;
    log(`💀 P${pIdx + 1} has fallen!`, 'log-bad');
    if (playerAlive.every(a => !a)) {
      loseGame();
      return;
    }
  }

  nextPlayerTurn(false);
}

function nextPlayerTurn(enemyDefeated) {
  if (playerCount === 1) {
    if (enemyDefeated) setTimeout(spawnEnemy, 600);
    return;
  }

  // Find next alive player
  let next = (currentPlayer + 1) % playerCount;
  let tries = 0;
  while (!playerAlive[next] && tries < playerCount) {
    next = (next + 1) % playerCount;
    tries++;
  }

  if (tries >= playerCount) {
    loseGame();
    return;
  }

  currentPlayer = next;
  document.getElementById('dungeon-player').textContent = `P${currentPlayer + 1}`;
  updatePlayerBanner();

  if (enemyDefeated) {
    setTimeout(spawnEnemy, 600);
  }
}

function updateEnemyHP() {
  const pct = enemy.hp / enemy.maxHp * 100;
  document.getElementById('enemy-hp-fill').style.width = pct + '%';
  document.getElementById('enemy-hp-text').textContent = `${enemy.hp} / ${enemy.maxHp} HP`;
}

function updateHUDHP() {
  document.getElementById('player-hp').textContent = playerHP[currentPlayer];
}

function renderPlayerHP() {
  const container = document.getElementById('player-hp-bars');
  if (playerCount === 1) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = playerHP.map((hp, i) => {
    const pct = Math.max(0, hp / PLAYER_MAX_HP * 100);
    const alive = playerAlive[i];
    return `<div style="margin-bottom:6px;">
      <div style="font-family:'Press Start 2P',monospace;font-size:0.42rem;color:var(--parchment-dim);margin-bottom:3px;">
        P${i+1}: ${hp} HP ${!alive ? '💀' : ''}
      </div>
      <div class="hp-bar"><div class="hp-fill player" style="width:${pct}%;${!alive ? 'opacity:0.3' : ''}"></div></div>
    </div>`;
  }).join('');
}

function log(msg, cls = '') {
  const logEl = document.getElementById('dungeon-log');
  const entry = document.createElement('div');
  entry.className = `log-entry ${cls}`;
  entry.textContent = msg;
  logEl.appendChild(entry);
  logEl.scrollTop = logEl.scrollHeight;
}

function winGame() {
  gameActive = false;
  document.getElementById('btn-roll-dice').disabled = true;
  const msg = document.getElementById('dungeon-message');
  msg.classList.remove('hidden');
  if (playerCount === 1) {
    msg.textContent = `🏆 Victory! You cleared all 3 waves with ${playerHP[0]} HP remaining!`;
  } else {
    const survivors = playerHP.map((hp, i) => hp > 0 ? `P${i+1}(${hp}HP)` : null).filter(Boolean);
    msg.textContent = `🏆 Victory! Survivors: ${survivors.join(', ')}`;
  }
}

function loseGame() {
  gameActive = false;
  document.getElementById('btn-roll-dice').disabled = true;
  const msg = document.getElementById('dungeon-message');
  msg.classList.remove('hidden');
  msg.textContent = `💀 Defeated! The dungeon claims your souls… Try again, brave adventurers!`;
}

function updatePlayerBanner() {
  const banner = document.getElementById('dungeon-player-banner');
  if (playerCount > 1) {
    banner.classList.remove('hidden');
    const icons = ['🟡', '🔵', '🔴', '🟢'];
    banner.textContent = `${icons[currentPlayer]} Player ${currentPlayer + 1}'s Turn`;
  } else {
    banner.classList.add('hidden');
  }
}

document.getElementById('btn-roll-dice').addEventListener('click', doRoll);

initGame();
