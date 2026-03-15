const MOLE_TYPES = ['🐭','🐹','🦔','🐿️','🦫'];
const HOLES = 9;
const GAME_TIME = 30;

let score = 0, misses = 0, timeLeft = GAME_TIME;
let gameActive = false, timerInterval = null;
let moleTimers = [];
let activeMoles = new Array(HOLES).fill(false);

function buildGrid() {
  const grid = document.getElementById('mole-grid');
  grid.innerHTML = '';
  for (let i = 0; i < HOLES; i++) {
    const hole = document.createElement('div');
    hole.className = 'mole-hole';
    hole.dataset.index = i;
    const type = MOLE_TYPES[i % MOLE_TYPES.length];
    hole.innerHTML = `<div class="mole">${type}</div>`;
    hole.addEventListener('click', () => whack(i));
    grid.appendChild(hole);
  }
}

function whack(idx) {
  if (!gameActive || !activeMoles[idx]) return;
  activeMoles[idx] = false;
  clearTimeout(moleTimers[idx]);
  const hole = document.querySelectorAll('.mole-hole')[idx];
  hole.classList.remove('active');
  hole.classList.add('whacked');
  score += 10;
  document.getElementById('mole-score').textContent = score;
  setTimeout(() => hole.classList.remove('whacked'), 400);
}

function popMole() {
  if (!gameActive) return;
  const available = [];
  for (let i = 0; i < HOLES; i++) if (!activeMoles[i]) available.push(i);
  if (available.length === 0) return;
  const idx = available[Math.floor(Math.random() * available.length)];
  const hole = document.querySelectorAll('.mole-hole')[idx];
  activeMoles[idx] = true;
  hole.classList.add('active');
  const stayTime = Math.max(700, 1400 - (GAME_TIME - timeLeft) * 20);
  moleTimers[idx] = setTimeout(() => {
    if (activeMoles[idx]) {
      activeMoles[idx] = false;
      hole.classList.remove('active');
      misses++;
      document.getElementById('mole-misses').textContent = misses;
    }
  }, stayTime);
}

function startGame() {
  score = 0; misses = 0; timeLeft = GAME_TIME; gameActive = true;
  activeMoles.fill(false);
  moleTimers.forEach(t => clearTimeout(t));
  document.getElementById('mole-score').textContent = '0';
  document.getElementById('mole-misses').textContent = '0';
  document.getElementById('mole-time').textContent = GAME_TIME;
  document.getElementById('mole-message').classList.add('hidden');
  document.querySelectorAll('.mole-hole').forEach(h => h.classList.remove('active','whacked'));
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timeLeft--;
    document.getElementById('mole-time').textContent = timeLeft;
    if (timeLeft <= 0) endGame();
  }, 1000);
  scheduleMoles();
}

function scheduleMoles() {
  if (!gameActive) return;
  popMole();
  const delay = Math.max(400, 900 - (GAME_TIME - timeLeft) * 15);
  setTimeout(scheduleMoles, delay);
}

function endGame() {
  gameActive = false;
  clearInterval(timerInterval);
  moleTimers.forEach(t => clearTimeout(t));
  activeMoles.fill(false);
  document.querySelectorAll('.mole-hole').forEach(h => h.classList.remove('active'));
  const msg = document.getElementById('mole-message');
  msg.classList.remove('hidden');
  let grade = score >= 200 ? '🏆 Amazing!' : score >= 100 ? '👍 Well done!' : '🎯 Keep practicing!';
  msg.textContent = `Game over! Score: ${score} | Missed: ${misses} — ${grade}`;
}

document.getElementById('btn-start-mole').addEventListener('click', startGame);
buildGrid();
