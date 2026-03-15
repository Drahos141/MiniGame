/**
 * Simon Says
 *
 * The computer flashes a growing sequence of colored buttons.
 * The player must repeat the full sequence in the correct order.
 * Each round adds one new step. Speed increases every 5 levels.
 * One wrong click ends the game.
 */

const COLORS = ['red', 'green', 'blue', 'yellow'];

let sequence        = [];
let playerIndex     = 0;
let level           = 0;
let isShowingSeq    = false;
let gameActive      = false;
let flashSpeed      = 700;   // ms per step (decreases over time)

/* ── DOM references ──────────────────────────────────────── */
const levelEl   = document.getElementById('level-num');
const statusEl  = document.getElementById('simon-status');
const messageEl = document.getElementById('simon-message');
const btnStart  = document.getElementById('btn-start-simon');

const simonBtns = {};
COLORS.forEach(c => {
  simonBtns[c] = document.querySelector(`.simon-btn[data-color="${c}"]`);
});

/* ── Start / reset ───────────────────────────────────────── */
function startGame() {
  sequence        = [];
  playerIndex     = 0;
  level           = 0;
  gameActive      = true;
  flashSpeed      = 700;

  messageEl.className = 'hidden';
  messageEl.innerHTML = '';
  btnStart.textContent = 'Restart';
  levelEl.textContent  = '—';

  setButtonsInteractive(false);
  setTimeout(nextRound, 500);
}

/* ── Round progression ───────────────────────────────────── */
function nextRound() {
  level++;
  levelEl.textContent = level;
  statusEl.innerHTML  = 'Watch carefully…';

  // Adjust speed every 5 levels
  if (level % 5 === 0) {
    flashSpeed = Math.max(300, flashSpeed - 80);
  }

  sequence.push(COLORS[Math.floor(Math.random() * COLORS.length)]);
  playerIndex = 0;

  showSequence();
}

/* ── Sequence display ────────────────────────────────────── */
function showSequence() {
  isShowingSeq = true;
  setButtonsInteractive(false);

  let i = 0;
  const gap = flashSpeed + 150;   // pause between flashes

  function flashNext() {
    if (i >= sequence.length) {
      isShowingSeq = false;
      setButtonsInteractive(true);
      statusEl.innerHTML = 'Your turn! Repeat the sequence.';
      return;
    }
    flashButton(sequence[i]);
    i++;
    setTimeout(flashNext, gap);
  }

  // Small initial delay so player knows the sequence is about to play
  setTimeout(flashNext, 400);
}

/* ── Button flash ────────────────────────────────────────── */
function flashButton(color) {
  const btn = simonBtns[color];
  btn.classList.add('active');
  setTimeout(() => btn.classList.remove('active'), flashSpeed * 0.55);
}

/* ── Player input ────────────────────────────────────────── */
function setButtonsInteractive(enabled) {
  COLORS.forEach(c => {
    simonBtns[c].disabled = !enabled;
  });
}

COLORS.forEach(color => {
  simonBtns[color].addEventListener('click', () => {
    if (!gameActive || isShowingSeq) return;

    flashButton(color);

    if (color === sequence[playerIndex]) {
      playerIndex++;

      if (playerIndex === sequence.length) {
        // Completed the full sequence for this round
        setButtonsInteractive(false);
        statusEl.innerHTML = `✅ Round ${level} complete!`;
        setTimeout(nextRound, 1000);
      }
    } else {
      // Wrong button
      endGame();
    }
  });
});

/* ── End game ────────────────────────────────────────────── */
function endGame() {
  gameActive = false;
  setButtonsInteractive(false);

  // Flash all buttons red to signal failure
  COLORS.forEach(c => simonBtns[c].classList.add('wrong'));
  setTimeout(() => COLORS.forEach(c => simonBtns[c].classList.remove('wrong')), 600);

  statusEl.innerHTML = '';
  messageEl.classList.remove('hidden', 'win');
  messageEl.classList.add('lose');
  messageEl.innerHTML = `❌ Wrong! You reached <strong>level ${level}</strong>. ${level >= 10 ? '🏆 Impressive!' : level >= 5 ? '👍 Not bad!' : 'Keep practicing!'}`;
}

/* ── Controls ────────────────────────────────────────────── */
btnStart.addEventListener('click', startGame);

/* ── Initial state ───────────────────────────────────────── */
setButtonsInteractive(false);
