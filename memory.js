/**
 * Memory Match
 *
 * 4×4 grid of face-down cards (8 emoji pairs).
 * Flip two at a time; matched pairs stay revealed.
 * Win when all 8 pairs are found.
 */

const EMOJI_PAIRS = ['🦊','🐼','🦁','🐸','🐨','🦄','🐶','🐱'];

let deck       = [];
let flipped    = [];   // indices of currently face-up (unmatched) cards
let matched    = [];   // indices of matched cards
let moves      = 0;
let canFlip    = true;
let timerInterval = null;
let seconds    = 0;
let gameOver   = false;

/* ── DOM references ──────────────────────────────────────── */
const gridEl      = document.getElementById('memory-grid');
const moveCountEl = document.getElementById('move-count');
const pairCountEl = document.getElementById('pair-count');
const timerEl     = document.getElementById('timer');
const messageEl   = document.getElementById('memory-message');
const btnNew      = document.getElementById('btn-new-memory');

/* ── Initialisation ──────────────────────────────────────── */
function initMemory() {
  clearInterval(timerInterval);
  deck      = shuffle([...EMOJI_PAIRS, ...EMOJI_PAIRS]);
  flipped   = [];
  matched   = [];
  moves     = 0;
  canFlip   = true;
  seconds   = 0;
  gameOver  = false;

  moveCountEl.textContent = '0';
  pairCountEl.textContent = '0 / 8';
  timerEl.textContent     = '0:00';
  messageEl.className     = 'hidden';
  messageEl.innerHTML     = '';

  renderGrid();
  startTimer();
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* ── Timer ───────────────────────────────────────────────── */
function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = String(secs % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function startTimer() {
  timerInterval = setInterval(() => {
    if (gameOver) return;
    seconds++;
    timerEl.textContent = formatTime(seconds);
  }, 1000);
}

/* ── Grid rendering ──────────────────────────────────────── */
function renderGrid() {
  gridEl.innerHTML = '';
  deck.forEach((emoji, idx) => {
    const card = document.createElement('div');
    card.className = 'memory-card';
    card.dataset.index = idx;
    card.innerHTML = `
      <div class="card-face card-back">❓</div>
      <div class="card-face card-front">${emoji}</div>
    `;
    card.addEventListener('click', () => handleCardClick(idx));
    gridEl.appendChild(card);
  });
}

function getCardEl(idx) {
  return gridEl.querySelector(`.memory-card[data-index="${idx}"]`);
}

/* ── Flip logic ──────────────────────────────────────────── */
function handleCardClick(idx) {
  if (!canFlip || gameOver) return;
  if (matched.includes(idx))  return;
  if (flipped.includes(idx))  return;
  if (flipped.length >= 2)    return;

  flipCard(idx, true);
  flipped.push(idx);

  if (flipped.length === 2) {
    moves++;
    moveCountEl.textContent = moves;
    canFlip = false;
    setTimeout(checkMatch, 800);
  }
}

function flipCard(idx, faceUp) {
  const el = getCardEl(idx);
  if (!el) return;
  el.classList.toggle('flipped', faceUp);
}

function checkMatch() {
  const [a, b] = flipped;
  if (deck[a] === deck[b]) {
    matched.push(a, b);
    getCardEl(a).classList.add('matched');
    getCardEl(b).classList.add('matched');
    pairCountEl.textContent = `${matched.length / 2} / 8`;

    if (matched.length === deck.length) {
      endGame();
    }
  } else {
    flipCard(a, false);
    flipCard(b, false);
  }
  flipped  = [];
  canFlip  = true;
}

/* ── End game ────────────────────────────────────────────── */
function endGame() {
  clearInterval(timerInterval);
  gameOver = true;

  messageEl.classList.remove('hidden');
  messageEl.classList.add('win');
  messageEl.innerHTML = `🎉 Brilliant! All pairs found in <strong>${moves}</strong> move${moves !== 1 ? 's' : ''} and <strong>${formatTime(seconds)}</strong>!`;
}

/* ── Controls ────────────────────────────────────────────── */
btnNew.addEventListener('click', initMemory);

/* ── Start ───────────────────────────────────────────────── */
initMemory();
