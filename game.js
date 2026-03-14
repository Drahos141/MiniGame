/**
 * Mastermind – Logic Game
 *
 * The computer picks a secret sequence of 4 colors (duplicates allowed).
 * The player has MAX_TURNS attempts to guess it.
 * After each guess the player receives feedback:
 *   - black peg : correct color in the correct position
 *   - white peg : correct color in the wrong position
 */

const COLORS = [
  { id: 'red',    hex: '#e74c3c' },
  { id: 'orange', hex: '#e67e22' },
  { id: 'yellow', hex: '#f1c40f' },
  { id: 'green',  hex: '#2ecc71' },
  { id: 'blue',   hex: '#3498db' },
  { id: 'purple', hex: '#9b59b6' },
  { id: 'pink',   hex: '#e91e8c' },
  { id: 'cyan',   hex: '#1abc9c' },
];

const CODE_LENGTH = 4;
const MAX_TURNS   = 10;

let secretCode    = [];
let currentGuess  = Array(CODE_LENGTH).fill(null);
let selectedColor = null;
let turnNumber    = 0;
let gameOver      = false;

/* ── DOM references ──────────────────────────────────────── */
const boardEl       = document.getElementById('board');
const paletteEl     = document.getElementById('color-palette');
const slotsEl       = document.querySelectorAll('.slot');
const btnGuess      = document.getElementById('btn-guess');
const btnClear      = document.getElementById('btn-clear');
const btnNewGame    = document.getElementById('btn-new-game');
const messageEl     = document.getElementById('message');

/* ── Initialisation ──────────────────────────────────────── */
function initGame() {
  secretCode    = generateCode();
  currentGuess  = Array(CODE_LENGTH).fill(null);
  selectedColor = null;
  turnNumber    = 0;
  gameOver      = false;

  boardEl.innerHTML   = '';
  messageEl.className = 'hidden';
  messageEl.textContent = '';

  buildPalette();
  renderCurrentGuess();
  updateGuessButton();
}

function generateCode() {
  return Array.from({ length: CODE_LENGTH }, () =>
    COLORS[Math.floor(Math.random() * COLORS.length)]
  );
}

/* ── Palette ─────────────────────────────────────────────── */
function buildPalette() {
  paletteEl.innerHTML = '';
  COLORS.forEach(color => {
    const btn = document.createElement('button');
    btn.className   = 'palette-color';
    btn.style.background = color.hex;
    btn.title       = color.id;
    btn.dataset.id  = color.id;
    btn.setAttribute('aria-label', color.id);
    btn.addEventListener('click', () => selectColor(color));
    paletteEl.appendChild(btn);
  });
}

function selectColor(color) {
  if (gameOver) return;
  selectedColor = color;

  document.querySelectorAll('.palette-color').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.id === color.id);
  });
}

/* ── Current guess slots ─────────────────────────────────── */
function renderCurrentGuess() {
  slotsEl.forEach((slot, i) => {
    const color = currentGuess[i];
    slot.style.background = color ? color.hex : '';
    slot.classList.toggle('filled', !!color);
  });
  updateGuessButton();
}

function updateGuessButton() {
  btnGuess.disabled = gameOver || currentGuess.some(c => c === null);
}

slotsEl.forEach(slot => {
  slot.addEventListener('click', () => {
    if (gameOver || !selectedColor) return;
    const idx = parseInt(slot.dataset.index, 10);
    currentGuess[idx] = selectedColor;
    renderCurrentGuess();
  });
});

/* ── Guess logic ─────────────────────────────────────────── */
btnGuess.addEventListener('click', submitGuess);
btnClear.addEventListener('click', clearGuess);
btnNewGame.addEventListener('click', initGame);

function clearGuess() {
  currentGuess = Array(CODE_LENGTH).fill(null);
  renderCurrentGuess();
}

function submitGuess() {
  if (gameOver || currentGuess.some(c => c === null)) return;

  turnNumber++;
  const feedback = evaluateGuess(secretCode, currentGuess);
  addBoardRow(turnNumber, [...currentGuess], feedback);

  if (feedback.black === CODE_LENGTH) {
    endGame(true);
    return;
  }
  if (turnNumber >= MAX_TURNS) {
    endGame(false);
    return;
  }

  currentGuess = Array(CODE_LENGTH).fill(null);
  renderCurrentGuess();
}

/**
 * Returns { black, white } counts.
 * Uses the classic algorithm that avoids double-counting.
 */
function evaluateGuess(secret, guess) {
  let black = 0;
  let white = 0;
  const secretLeft = [];
  const guessLeft  = [];

  for (let i = 0; i < CODE_LENGTH; i++) {
    if (secret[i].id === guess[i].id) {
      black++;
    } else {
      secretLeft.push(secret[i].id);
      guessLeft.push(guess[i].id);
    }
  }

  guessLeft.forEach(id => {
    const idx = secretLeft.indexOf(id);
    if (idx !== -1) {
      white++;
      secretLeft.splice(idx, 1);
    }
  });

  return { black, white };
}

/* ── Board rendering ─────────────────────────────────────── */
function addBoardRow(turn, guess, feedback) {
  const row = document.createElement('div');
  row.className = 'board-row';

  const num = document.createElement('span');
  num.className   = 'turn-number';
  num.textContent = turn;

  const pegsDiv = document.createElement('div');
  pegsDiv.className = 'pegs';
  guess.forEach(color => {
    const peg = document.createElement('div');
    peg.className = 'peg filled';
    peg.style.background = color.hex;
    pegsDiv.appendChild(peg);
  });

  const feedbackDiv = document.createElement('div');
  feedbackDiv.className = 'feedback';
  for (let i = 0; i < CODE_LENGTH; i++) {
    const fp = document.createElement('div');
    fp.className = 'feedback-peg';
    if (i < feedback.black) fp.classList.add('black');
    else if (i < feedback.black + feedback.white) fp.classList.add('white');
    feedbackDiv.appendChild(fp);
  }

  row.append(num, pegsDiv, feedbackDiv);
  boardEl.appendChild(row);
}

/* ── End game ────────────────────────────────────────────── */
function endGame(won) {
  gameOver = true;
  updateGuessButton();

  const secretHtml = secretCode
    .map(c => `<span class="peg filled" style="background:${c.hex};display:inline-block;width:22px;height:22px;border-radius:50%;border:2px solid rgba(255,255,255,0.4);margin:0 2px;vertical-align:middle;"></span>`)
    .join('');

  messageEl.classList.remove('hidden', 'win', 'lose');

  if (won) {
    messageEl.classList.add('win');
    messageEl.innerHTML = `🎉 You cracked the code in ${turnNumber} ${turnNumber === 1 ? 'try' : 'tries'}!`;
  } else {
    messageEl.classList.add('lose');
    messageEl.innerHTML = `😞 Out of tries! The secret code was:<br>${secretHtml}`;
  }
}

/* ── Start ───────────────────────────────────────────────── */
initGame();
