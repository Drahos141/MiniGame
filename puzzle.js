// Puzzle Slider – 3x3 sliding tile puzzle with multiplayer support

const TILE_EMOJIS = ['🏰','🗡️','🛡️','🐉','🧙','🏹','⚔️','🔮'];
// Tile 0 = empty, tiles 1-8 mapped to emojis

let tiles = [];           // current board state (0 = empty)
let moves = 0;
let timerInterval = null;
let seconds = 0;
let gameActive = false;

// Multiplayer
const playerCount = parseInt(localStorage.getItem('miniGamePlayers') || '1', 10);
let currentPlayer = 0;
let playerMoves = Array(playerCount).fill(0);
let playerTimes = Array(playerCount).fill(0);
let playerTimers = Array(playerCount).fill(null);
let gamePhase = 'playing'; // 'playing' | 'roundDone' | 'allDone'

const GOAL = [1, 2, 3, 4, 5, 6, 7, 8, 0]; // solved state

function initPuzzle() {
  tiles = generateSolvable();
  moves = 0;
  seconds = 0;
  gameActive = false;
  currentPlayer = 0;
  playerMoves = Array(playerCount).fill(0);
  playerTimes = Array(playerCount).fill(0);
  gamePhase = 'playing';

  clearInterval(timerInterval);

  document.getElementById('puzzle-moves').textContent = '0';
  document.getElementById('puzzle-time').textContent = '0:00';
  document.getElementById('puzzle-player').textContent = `P${currentPlayer + 1}`;
  document.getElementById('puzzle-message').classList.add('hidden');
  updatePlayerBanner();
  render();
}

function generateSolvable() {
  let arr;
  do {
    arr = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 0]);
  } while (!isSolvable(arr) || isGoal(arr));
  return arr;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function isSolvable(arr) {
  // Count inversions; puzzle is solvable if inversion count is even (for 3x3)
  let inv = 0;
  const nums = arr.filter(n => n !== 0);
  for (let i = 0; i < nums.length; i++)
    for (let j = i + 1; j < nums.length; j++)
      if (nums[i] > nums[j]) inv++;
  return inv % 2 === 0;
}

function isGoal(arr) {
  return arr.every((v, i) => v === GOAL[i]);
}

function render() {
  const grid = document.getElementById('puzzle-grid');
  grid.innerHTML = '';
  tiles.forEach((val, idx) => {
    const tile = document.createElement('div');
    tile.className = 'puzzle-tile' + (val === 0 ? ' empty' : '');
    if (val !== 0) {
      // Check if in correct position
      if (val === GOAL[idx]) tile.classList.add('correct');
      tile.innerHTML = `<span>${TILE_EMOJIS[val - 1]}</span><span class="tile-num">${val}</span>`;
      tile.addEventListener('click', () => handleTileClick(idx));
      tile.addEventListener('touchend', e => { e.preventDefault(); handleTileClick(idx); }, { passive: false });
    }
    grid.appendChild(tile);
  });
}

function handleTileClick(idx) {
  if (!gameActive && tiles.some(v => v === 0)) {
    // Auto-start on first move
    gameActive = true;
    startPlayerTimer();
  }
  if (!gameActive || gamePhase !== 'playing') return;

  const emptyIdx = tiles.indexOf(0);
  if (!isAdjacent(idx, emptyIdx)) return;

  [tiles[idx], tiles[emptyIdx]] = [tiles[emptyIdx], tiles[idx]];
  playerMoves[currentPlayer]++;
  document.getElementById('puzzle-moves').textContent = playerMoves[currentPlayer];
  render();

  if (isGoal(tiles)) {
    endRound();
  }
}

function isAdjacent(a, b) {
  const row = [Math.floor(a / 3), Math.floor(b / 3)];
  const col = [a % 3, b % 3];
  return (row[0] === row[1] && Math.abs(col[0] - col[1]) === 1) ||
         (col[0] === col[1] && Math.abs(row[0] - row[1]) === 1);
}

function startPlayerTimer() {
  clearInterval(timerInterval);
  const startTime = Date.now() - playerTimes[currentPlayer] * 1000;
  timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    playerTimes[currentPlayer] = elapsed;
    document.getElementById('puzzle-time').textContent = formatTime(elapsed);
  }, 500);
}

function formatTime(s) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function endRound() {
  clearInterval(timerInterval);
  gameActive = false;

  if (playerCount === 1) {
    const msg = document.getElementById('puzzle-message');
    msg.classList.remove('hidden');
    msg.textContent = `🎉 Solved! ${playerMoves[0]} moves in ${formatTime(playerTimes[0])}!`;
    return;
  }

  // Multiplayer: next player gets a fresh scrambled board
  const nextPlayer = currentPlayer + 1;
  if (nextPlayer < playerCount) {
    const msg = document.getElementById('puzzle-message');
    msg.classList.remove('hidden');
    msg.textContent = `✅ P${currentPlayer + 1} solved in ${playerMoves[currentPlayer]} moves! Pass to P${nextPlayer + 1}…`;
    currentPlayer = nextPlayer;
    document.getElementById('puzzle-player').textContent = `P${currentPlayer + 1}`;
    updatePlayerBanner();

    setTimeout(() => {
      msg.classList.add('hidden');
      tiles = generateSolvable();
      document.getElementById('puzzle-moves').textContent = '0';
      document.getElementById('puzzle-time').textContent = '0:00';
      gameActive = false;
      render();
    }, 2500);
  } else {
    // All players done – show results
    showFinalResults();
  }
}

function showFinalResults() {
  gamePhase = 'allDone';
  let best = { moves: Infinity, player: -1 };
  playerMoves.forEach((m, i) => {
    if (m < best.moves) { best.moves = m; best.player = i; }
  });

  let text = `🏆 Quest Complete!\n`;
  playerMoves.forEach((m, i) => {
    text += `P${i + 1}: ${m} moves (${formatTime(playerTimes[i])})  `;
  });
  text += `\n🥇 Winner: P${best.player + 1}!`;

  const msg = document.getElementById('puzzle-message');
  msg.classList.remove('hidden');
  msg.textContent = text;
  msg.style.whiteSpace = 'pre-line';
}

function updatePlayerBanner() {
  const banner = document.getElementById('puzzle-player-banner');
  if (playerCount > 1) {
    banner.classList.remove('hidden');
    const colors = ['🟡', '🔵', '🔴', '🟢'];
    banner.textContent = `${colors[currentPlayer]} Player ${currentPlayer + 1}'s Turn`;
  } else {
    banner.classList.add('hidden');
  }
}

document.getElementById('btn-new-puzzle').addEventListener('click', initPuzzle);

initPuzzle();
