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

// Multiplayer
const playerCount = parseInt(localStorage.getItem('miniGamePlayers') || '1', 10);
let mpCurrentPlayer = 0;
let mpTurnsUsed = Array(playerCount).fill(0);
let mpSolved = Array(playerCount).fill(false);
let mpActive = Array(playerCount).fill(true);

let secretCode    = [];
let currentGuess  = Array(CODE_LENGTH).fill(null);
let selectedColor = null;
let turnNumber    = 0;
let gameOver      = false;

function updatePlayerBanner() {
  const banner = document.getElementById('mm-player-banner');
  if (!banner) return;
  if (playerCount > 1) {
    const icons = ['🟡', '🔵', '🔴', '🟢'];
    banner.textContent = `${icons[mpCurrentPlayer]} Player ${mpCurrentPlayer + 1}'s Turn`;
    banner.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
  }
}

function initGame() {
  secretCode   = generateCode();
  currentGuess = Array(CODE_LENGTH).fill(null);
  selectedColor = null;
  turnNumber   = 0;
  gameOver     = false;
  mpCurrentPlayer = 0;
  mpTurnsUsed = Array(playerCount).fill(0);
  mpSolved = Array(playerCount).fill(false);
  mpActive = Array(playerCount).fill(true);

  document.getElementById('board').innerHTML = '';
  document.getElementById('message').classList.add('hidden');
  document.getElementById('btn-guess').disabled = true;

  buildPalette();
  renderCurrentGuess();
  updatePlayerBanner();
}

function generateCode() {
  return Array.from({ length: CODE_LENGTH }, () =>
    COLORS[Math.floor(Math.random() * COLORS.length)].id
  );
}

function buildPalette() {
  const palette = document.getElementById('color-palette');
  palette.innerHTML = '';
  COLORS.forEach(c => {
    const btn = document.createElement('button');
    btn.className = 'color-btn';
    btn.style.background = c.hex;
    btn.setAttribute('aria-label', c.id);
    btn.addEventListener('click', () => selectColor(c.id));
    palette.appendChild(btn);
  });
}

function selectColor(colorId) {
  if (gameOver) return;
  selectedColor = colorId;
  document.querySelectorAll('.color-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('aria-label') === colorId);
  });
  const emptySlot = currentGuess.indexOf(null);
  if (emptySlot !== -1) {
    currentGuess[emptySlot] = colorId;
    renderCurrentGuess();
  }
}

function renderCurrentGuess() {
  const slots = document.querySelectorAll('.slot');
  slots.forEach((slot, i) => {
    const colorId = currentGuess[i];
    if (colorId) {
      const color = COLORS.find(c => c.id === colorId);
      slot.style.background  = color.hex;
      slot.style.borderColor = 'rgba(255,255,255,0.4)';
      slot.style.borderStyle = 'solid';
    } else {
      slot.style.background  = '';
      slot.style.borderColor = '';
      slot.style.borderStyle = '';
    }
    slot.onclick = () => {
      if (!gameOver && currentGuess[i]) {
        currentGuess[i] = null;
        renderCurrentGuess();
      }
    };
  });
  document.getElementById('btn-guess').disabled = currentGuess.includes(null);
}

function submitGuess() {
  if (gameOver || currentGuess.includes(null)) return;
  const feedback = evaluateGuess(secretCode, currentGuess);
  addBoardRow(turnNumber, [...currentGuess], feedback);
  turnNumber++;
  mpTurnsUsed[mpCurrentPlayer]++;

  if (feedback.black === CODE_LENGTH) {
    mpSolved[mpCurrentPlayer] = true;
    if (playerCount === 1) {
      endGame(true);
    } else {
      // This player solved it
      const msg = document.getElementById('message');
      msg.classList.remove('hidden');
      msg.textContent = `🎉 P${mpCurrentPlayer + 1} cracked it in ${turnNumber} tries!`;
      msg.style.color = '#2ecc71';
      // Check if all players have had a turn
      mpActive[mpCurrentPlayer] = false;
      const stillPlaying = mpActive.some(a => a);
      if (!stillPlaying) {
        endMultiplayerGame();
      } else {
        setTimeout(() => {
          msg.classList.add('hidden');
          switchToNextPlayer();
        }, 1500);
      }
    }
  } else if (turnNumber >= MAX_TURNS) {
    mpActive[mpCurrentPlayer] = false;
    if (playerCount === 1) {
      endGame(false);
    } else {
      const stillPlaying = mpActive.some(a => a);
      if (!stillPlaying) {
        endMultiplayerGame();
      } else {
        const msg = document.getElementById('message');
        msg.classList.remove('hidden');
        msg.textContent = `😔 P${mpCurrentPlayer + 1} ran out of tries!`;
        setTimeout(() => {
          msg.classList.add('hidden');
          switchToNextPlayer();
        }, 1500);
      }
    }
  } else {
    currentGuess = Array(CODE_LENGTH).fill(null);
    renderCurrentGuess();
    document.getElementById('btn-guess').disabled = true;
  }
}

function switchToNextPlayer() {
  let next = (mpCurrentPlayer + 1) % playerCount;
  while (!mpActive[next] && next !== mpCurrentPlayer) next = (next + 1) % playerCount;
  if (!mpActive[next]) { endMultiplayerGame(); return; }
  mpCurrentPlayer = next;
  turnNumber = mpTurnsUsed[mpCurrentPlayer];
  currentGuess = Array(CODE_LENGTH).fill(null);
  renderCurrentGuess();
  document.getElementById('btn-guess').disabled = true;
  updatePlayerBanner();
  document.getElementById('board').innerHTML = '';
}

function endMultiplayerGame() {
  gameOver = true;
  const solvedPlayers = mpSolved.map((s, i) => s ? i : -1).filter(i => i >= 0);
  const msg = document.getElementById('message');
  msg.classList.remove('hidden');
  if (solvedPlayers.length === 0) {
    const code = secretCode.map(id => {
      const c = COLORS.find(c => c.id === id);
      return `<span style="display:inline-block;width:18px;height:18px;border-radius:50%;background:${c.hex};vertical-align:middle;margin:0 2px;"></span>`;
    }).join('');
    msg.innerHTML = `😔 Nobody cracked it! The code was: ${code}`;
    msg.style.color = '#e74c3c';
  } else {
    // Winner = solved with fewest turns
    let bestTurns = Infinity, winner = -1;
    solvedPlayers.forEach(i => { if (mpTurnsUsed[i] < bestTurns) { bestTurns = mpTurnsUsed[i]; winner = i; } });
    const scoreStr = mpTurnsUsed.map((t, i) => `P${i+1}:${mpSolved[i] ? t+' tries' : 'failed'}`).join(' | ');
    msg.textContent = `🏆 P${winner+1} wins! ${scoreStr}`;
    msg.style.color = '#2ecc71';
  }
}

function evaluateGuess(secret, guess) {
  let black = 0, white = 0;
  const sLeft = [], gLeft = [];
  for (let i = 0; i < CODE_LENGTH; i++) {
    if (secret[i] === guess[i]) { black++; }
    else { sLeft.push(secret[i]); gLeft.push(guess[i]); }
  }
  gLeft.forEach(g => {
    const idx = sLeft.indexOf(g);
    if (idx !== -1) { white++; sLeft.splice(idx, 1); }
  });
  return { black, white };
}

function addBoardRow(turn, guess, feedback) {
  const row = document.createElement('div');
  row.className = 'board-row';
  const guessEl = document.createElement('div');
  guessEl.className = 'board-guess';
  guess.forEach(colorId => {
    const peg = document.createElement('div');
    peg.className = 'board-peg';
    const color = COLORS.find(c => c.id === colorId);
    if (color) peg.style.background = color.hex;
    guessEl.appendChild(peg);
  });
  const feedbackEl = document.createElement('div');
  feedbackEl.className = 'board-feedback';
  for (let i = 0; i < CODE_LENGTH; i++) {
    const peg = document.createElement('div');
    peg.className = 'feedback-peg';
    if (i < feedback.black) peg.classList.add('black');
    else if (i < feedback.black + feedback.white) peg.classList.add('white');
    feedbackEl.appendChild(peg);
  }
  row.appendChild(guessEl);
  row.appendChild(feedbackEl);
  document.getElementById('board').appendChild(row);
}

function endGame(won) {
  gameOver = true;
  const msg = document.getElementById('message');
  msg.classList.remove('hidden');
  if (won) {
    msg.textContent = `🎉 You cracked it in ${turnNumber} tries!`;
    msg.style.color = '#2ecc71';
  } else {
    const code = secretCode.map(id => COLORS.find(c => c.id === id).hex);
    msg.innerHTML = `😔 Out of tries! The code was: ${secretCode.map(id => {
      const c = COLORS.find(c => c.id === id);
      return `<span style="display:inline-block;width:18px;height:18px;border-radius:50%;background:${c.hex};vertical-align:middle;margin:0 2px;"></span>`;
    }).join('')}`;
    msg.style.color = '#e74c3c';
  }
}

document.getElementById('btn-guess').addEventListener('click', submitGuess);
document.getElementById('btn-clear').addEventListener('click', () => {
  currentGuess = Array(CODE_LENGTH).fill(null);
  renderCurrentGuess();
});
document.getElementById('btn-new-game').addEventListener('click', initGame);

initGame();

