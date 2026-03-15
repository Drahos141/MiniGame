const EMOJI_PAIRS = ['🦊','🐼','🦁','🐸','🐨','🦄','🐶','🐱'];

// Multiplayer
const playerCount = parseInt(localStorage.getItem('miniGamePlayers') || '1', 10);
let currentPlayer = 0;
let playerScores = Array(playerCount).fill(0);
let playerMovesCnt = Array(playerCount).fill(0);

let deck = [], flipped = [], matched = [], moves = 0, canFlip = true;
let timerInterval = null, seconds = 0, gameStarted = false;

function initMemory() {
  deck = shuffle([...EMOJI_PAIRS, ...EMOJI_PAIRS]);
  flipped = []; matched = []; moves = 0; canFlip = true; gameStarted = false;
  currentPlayer = 0;
  playerScores = Array(playerCount).fill(0);
  playerMovesCnt = Array(playerCount).fill(0);
  clearInterval(timerInterval); seconds = 0;
  document.getElementById('move-count').textContent = '0';
  document.getElementById('pair-count').textContent = '0 / 8';
  document.getElementById('timer').textContent = '0:00';
  document.getElementById('memory-message').classList.add('hidden');
  updatePlayerBanner();
  updateScoreDisplay();
  renderGrid();
}

function updatePlayerBanner() {
  const banner = document.getElementById('memory-player-banner');
  if (!banner) return;
  if (playerCount > 1) {
    const icons = ['🟡', '🔵', '🔴', '🟢'];
    banner.textContent = `${icons[currentPlayer]} Player ${currentPlayer + 1}'s Turn`;
    banner.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
  }
}

function updateScoreDisplay() {
  const scoreRow = document.getElementById('memory-score-row');
  if (!scoreRow) return;
  if (playerCount > 1) {
    scoreRow.innerHTML = playerScores.map((s, i) =>
      `<div class="stat-box" style="${i===currentPlayer?'border-color:var(--gold);':''}">`+
      `<span class="stat-label">P${i+1} Pairs</span>`+
      `<span class="stat-value">${s}</span></div>`
    ).join('');
    scoreRow.style.display = 'flex';
  } else {
    scoreRow.style.display = 'none';
  }
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function formatTime(s) {
  return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
}

function startTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    seconds++;
    document.getElementById('timer').textContent = formatTime(seconds);
  }, 1000);
}

function renderGrid() {
  const grid = document.getElementById('memory-grid');
  grid.innerHTML = '';
  deck.forEach((emoji, i) => {
    const card = document.createElement('div');
    card.className = 'memory-card';
    card.innerHTML = `<div class="memory-card-inner">
      <div class="memory-card-front">?</div>
      <div class="memory-card-back">${emoji}</div>
    </div>`;
    if (matched.includes(i)) card.classList.add('flipped', 'matched');
    else if (flipped.includes(i)) card.classList.add('flipped');
    card.addEventListener('click', () => handleCardClick(i));
    grid.appendChild(card);
  });
}

function handleCardClick(idx) {
  if (!canFlip || flipped.includes(idx) || matched.includes(idx)) return;
  if (!gameStarted) { gameStarted = true; startTimer(); }
  flipped.push(idx);
  flipCard(idx, true);
  if (flipped.length === 2) {
    canFlip = false;
    playerMovesCnt[currentPlayer]++;
    moves++;
    document.getElementById('move-count').textContent = moves;
    setTimeout(checkMatch, 800);
  }
}

function flipCard(idx, faceUp) {
  const cards = document.querySelectorAll('.memory-card');
  if (faceUp) cards[idx].classList.add('flipped');
  else cards[idx].classList.remove('flipped');
}

function checkMatch() {
  const [a, b] = flipped;
  if (deck[a] === deck[b]) {
    matched.push(a, b);
    document.querySelectorAll('.memory-card')[a].classList.add('matched');
    document.querySelectorAll('.memory-card')[b].classList.add('matched');
    playerScores[currentPlayer]++;
    document.getElementById('pair-count').textContent = `${matched.length/2} / 8`;
    updateScoreDisplay();
    if (matched.length === deck.length) {
      endMemoryGame();
    }
    // On match, same player goes again (don't switch)
  } else {
    flipCard(a, false);
    flipCard(b, false);
    // Switch player on miss
    if (playerCount > 1) {
      currentPlayer = (currentPlayer + 1) % playerCount;
      updatePlayerBanner();
      updateScoreDisplay();
    }
  }
  flipped = [];
  canFlip = true;
}

function endMemoryGame() {
  clearInterval(timerInterval);
  const msg = document.getElementById('memory-message');
  msg.classList.remove('hidden');
  if (playerCount === 1) {
    msg.textContent = `🎉 Done in ${moves} moves & ${formatTime(seconds)}!`;
  } else {
    let maxScore = -1, winner = -1;
    playerScores.forEach((s, i) => { if (s > maxScore) { maxScore = s; winner = i; } });
    const scoreStr = playerScores.map((s, i) => `P${i+1}:${s}`).join(' | ');
    msg.textContent = `🎉 Complete! ${scoreStr} — Winner: P${winner+1}!`;
  }
}

document.getElementById('btn-new-memory').addEventListener('click', initMemory);
initMemory();
