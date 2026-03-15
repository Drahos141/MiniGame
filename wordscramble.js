// Word Scramble – Fantasy themed word guessing game with multiplayer

const WORDS = [
  { word: 'dragon',    category: 'Creature', hint: 'A fire-breathing beast of legend' },
  { word: 'wizard',    category: 'Character', hint: 'Master of arcane arts' },
  { word: 'castle',    category: 'Place', hint: 'A fortified royal stronghold' },
  { word: 'potion',    category: 'Item', hint: 'A magical brew in a vial' },
  { word: 'dungeon',   category: 'Place', hint: 'Underground prison beneath a castle' },
  { word: 'knight',    category: 'Character', hint: 'Armored warrior on horseback' },
  { word: 'goblin',    category: 'Creature', hint: 'Small green mischievous creature' },
  { word: 'treasure',  category: 'Item', hint: 'Gold and gems hidden by a dragon' },
  { word: 'enchant',   category: 'Magic', hint: 'To place a magical spell upon' },
  { word: 'shield',    category: 'Item', hint: 'Defensive armor for the arm' },
  { word: 'sword',     category: 'Item', hint: 'A sharp-bladed melee weapon' },
  { word: 'forest',    category: 'Place', hint: 'Dense woodland full of mystery' },
  { word: 'archer',    category: 'Character', hint: 'Fighter who uses a bow' },
  { word: 'goblet',    category: 'Item', hint: 'A decorative drinking cup' },
  { word: 'mystic',    category: 'Magic', hint: 'Of hidden or supernatural quality' },
  { word: 'portal',    category: 'Magic', hint: 'A magical gateway to another realm' },
  { word: 'realm',     category: 'Place', hint: 'A kingdom or domain' },
  { word: 'rogue',     category: 'Character', hint: 'A cunning thief in the shadows' },
  { word: 'shadow',    category: 'Magic', hint: 'Darkness cast by blocking light' },
  { word: 'temple',    category: 'Place', hint: 'Sacred building for worship' },
  { word: 'tower',     category: 'Place', hint: 'Tall structure in a castle' },
  { word: 'warlock',   category: 'Character', hint: 'A sorcerer of dark magic' },
  { word: 'fairy',     category: 'Creature', hint: 'Tiny winged magical being' },
  { word: 'gnome',     category: 'Creature', hint: 'Small earth-dwelling creature' },
  { word: 'troll',     category: 'Creature', hint: 'Large creature living under bridges' },
  { word: 'unicorn',   category: 'Creature', hint: 'A magical horse with a horn' },
  { word: 'phoenix',   category: 'Creature', hint: 'Mythical bird reborn from ashes' },
  { word: 'grail',     category: 'Item', hint: 'A sacred legendary cup' },
  { word: 'rune',      category: 'Magic', hint: 'An ancient magical symbol' },
  { word: 'totem',     category: 'Magic', hint: 'A carved spiritual symbol' },
];

const WORDS_PER_ROUND = 10;
const WORD_TIME = 30;

// Multiplayer
const playerCount = parseInt(localStorage.getItem('miniGamePlayers') || '1', 10);
let currentPlayer = 0;
let playerScores = Array(playerCount).fill(0);

// Game state
let wordQueue = [];
let currentWordIdx = 0;
let currentEntry = null;
let scrambled = '';
let timeLeft = WORD_TIME;
let timerInterval = null;
let hintUsed = false;
let gameActive = false;

function scrambleWord(word) {
  const arr = word.split('');
  let shuffled;
  do {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    shuffled = arr.join('');
  } while (shuffled === word);
  return shuffled;
}

function initGame() {
  wordQueue = shuffle([...WORDS]).slice(0, WORDS_PER_ROUND);
  currentWordIdx = 0;
  currentPlayer = 0;
  playerScores = Array(playerCount).fill(0);
  gameActive = true;

  document.getElementById('ws-message').classList.add('hidden');
  document.getElementById('ws-score').textContent = '0';
  updatePlayerDisplay();
  loadWord();
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function loadWord() {
  if (currentWordIdx >= wordQueue.length) {
    if (playerCount > 1 && currentPlayer + 1 < playerCount) {
      // Next player's turn with same word set
      currentPlayer++;
      currentWordIdx = 0;
      document.getElementById('ws-feedback').className = 'log-info';
      document.getElementById('ws-feedback').textContent = `🏆 P${currentPlayer}'s turn complete! Pass to P${currentPlayer + 1}…`;
      updatePlayerDisplay();
      setTimeout(loadWord, 2000);
      return;
    } else {
      endGame();
      return;
    }
  }

  currentEntry = wordQueue[currentWordIdx];
  scrambled = scrambleWord(currentEntry.word);
  hintUsed = false;
  timeLeft = WORD_TIME;

  document.getElementById('ws-scrambled').textContent = scrambled.toUpperCase();
  document.getElementById('ws-hint-text').textContent = '—';
  document.getElementById('ws-category').textContent = currentEntry.category;
  document.getElementById('ws-word-num').textContent = `${currentWordIdx + 1}/${wordQueue.length}`;
  document.getElementById('ws-input').value = '';
  document.getElementById('ws-input').disabled = false;
  document.getElementById('ws-feedback').textContent = '';
  document.getElementById('ws-feedback').className = '';
  document.getElementById('btn-ws-hint').disabled = false;

  updateTimerBar();
  startTimer();
  document.getElementById('ws-input').focus();
}

function startTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimerBar();
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      onTimeout();
    }
  }, 1000);
}

function updateTimerBar() {
  const fill = document.getElementById('ws-timer-fill');
  const pct = (timeLeft / WORD_TIME) * 100;
  fill.style.width = pct + '%';
  fill.classList.toggle('warning', pct < 33);
}

function onTimeout() {
  document.getElementById('ws-input').disabled = true;
  document.getElementById('ws-feedback').textContent = `⏰ Time! The word was: ${currentEntry.word.toUpperCase()}`;
  document.getElementById('ws-feedback').className = 'ws-wrong';
  setTimeout(nextWord, 1800);
}

function submitAnswer() {
  if (!gameActive) return;
  const input = document.getElementById('ws-input').value.trim().toLowerCase();
  if (!input) return;

  clearInterval(timerInterval);
  document.getElementById('ws-input').disabled = true;

  if (input === currentEntry.word) {
    const timeBonus = Math.ceil(timeLeft * 2);
    const hintPenalty = hintUsed ? 5 : 0;
    const points = Math.max(5, 10 + timeBonus - hintPenalty);
    playerScores[currentPlayer] += points;
    document.getElementById('ws-score').textContent = playerScores[currentPlayer];
    document.getElementById('ws-feedback').textContent = `✨ Correct! +${points} pts`;
    document.getElementById('ws-feedback').className = 'ws-correct';
    setTimeout(nextWord, 1200);
  } else {
    document.getElementById('ws-feedback').textContent = `❌ Wrong! Answer: ${currentEntry.word.toUpperCase()}`;
    document.getElementById('ws-feedback').className = 'ws-wrong';
    setTimeout(nextWord, 1800);
  }
}

function nextWord() {
  currentWordIdx++;
  loadWord();
}

function showHint() {
  hintUsed = true;
  document.getElementById('ws-hint-text').textContent = currentEntry.hint;
  document.getElementById('btn-ws-hint').disabled = true;
}

function updatePlayerDisplay() {
  document.getElementById('ws-player').textContent = `P${currentPlayer + 1}`;
  document.getElementById('ws-score').textContent = playerScores[currentPlayer];

  const banner = document.getElementById('ws-player-banner');
  if (playerCount > 1) {
    banner.classList.remove('hidden');
    const icons = ['🟡', '🔵', '🔴', '🟢'];
    banner.textContent = `${icons[currentPlayer]} Player ${currentPlayer + 1}'s Turn`;
  } else {
    banner.classList.add('hidden');
  }
}

function endGame() {
  gameActive = false;
  clearInterval(timerInterval);
  document.getElementById('ws-input').disabled = true;
  document.getElementById('ws-scrambled').textContent = '🎉';

  const msg = document.getElementById('ws-message');
  msg.classList.remove('hidden');

  if (playerCount === 1) {
    msg.textContent = `🏆 Quest Complete! Final Score: ${playerScores[0]} pts`;
  } else {
    let maxScore = -1, winner = -1;
    playerScores.forEach((s, i) => { if (s > maxScore) { maxScore = s; winner = i; } });
    let text = `🏆 Quest Complete!\n`;
    text += playerScores.map((s, i) => `P${i + 1}: ${s} pts`).join('  ') + '\n';
    text += `\n🥇 Winner: P${winner + 1} with ${maxScore} pts!`;
    msg.textContent = text;
    msg.style.whiteSpace = 'pre-line';
  }
}

// Event listeners
document.getElementById('btn-ws-submit').addEventListener('click', submitAnswer);
document.getElementById('ws-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') submitAnswer();
});
document.getElementById('btn-ws-hint').addEventListener('click', showHint);
document.getElementById('btn-ws-new').addEventListener('click', initGame);

initGame();
