const CELL = 20;
const COLS = 20, ROWS = 20;
const canvas = document.getElementById('snake-canvas');
const ctx = canvas.getContext('2d');

// Multiplayer
const playerCount = parseInt(localStorage.getItem('miniGamePlayers') || '1', 10);
let mpCurrentPlayer = 0;
let mpScores = Array(playerCount).fill(0);

let snake, dir, nextDir, apple, score, bestScore, level, gameLoop, gameActive;
bestScore = 0;

function updatePlayerBanner() {
  const banner = document.getElementById('snake-player-banner');
  if (playerCount > 1 && banner) {
    const icons = ['🟡', '🔵', '🔴', '🟢'];
    banner.textContent = `${icons[mpCurrentPlayer]} Player ${mpCurrentPlayer + 1}'s Round`;
    banner.classList.remove('hidden');
  }
}

function initSnake() {
  snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
  dir = { x: 1, y: 0 };
  nextDir = { x: 1, y: 0 };
  score = 0; level = 1; gameActive = false;
  placeApple();
  document.getElementById('snake-score').textContent = '0';
  document.getElementById('snake-level').textContent = '1';
  document.getElementById('snake-message').classList.add('hidden');
  clearInterval(gameLoop);
  draw();
}

function placeApple() {
  do {
    apple = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
  } while (snake.some(s => s.x === apple.x && s.y === apple.y));
}

function startSnake() {
  document.getElementById('btn-start-snake').textContent = 'Restart';
  if (playerCount > 1) {
    mpCurrentPlayer = 0;
    mpScores = Array(playerCount).fill(0);
    updatePlayerBanner();
  }
  clearInterval(gameLoop);
  initSnake();
  gameActive = true;
  const speed = () => Math.max(80, 200 - (level - 1) * 20);
  const tick = () => {
    if (!gameActive) return;
    update();
    draw();
    gameLoop = setTimeout(tick, speed());
  };
  gameLoop = setTimeout(tick, speed());
}

function update() {
  dir = { ...nextDir };
  const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
  if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) return endSnake();
  if (snake.some(s => s.x === head.x && s.y === head.y)) return endSnake();
  snake.unshift(head);
  if (head.x === apple.x && head.y === apple.y) {
    score += 10 * level;
    if (score > bestScore) bestScore = score;
    level = Math.floor(score / 100) + 1;
    document.getElementById('snake-score').textContent = score;
    document.getElementById('snake-best').textContent = bestScore;
    document.getElementById('snake-level').textContent = level;
    placeApple();
  } else {
    snake.pop();
  }
}

function draw() {
  ctx.fillStyle = '#0a1a08';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Grid dots
  ctx.fillStyle = 'rgba(255,255,255,0.02)';
  for (let x = 0; x < COLS; x++) for (let y = 0; y < ROWS; y++) {
    ctx.fillRect(x * CELL + CELL/2 - 1, y * CELL + CELL/2 - 1, 2, 2);
  }

  // Apple
  ctx.font = `${CELL * 0.9}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🍎', apple.x * CELL + CELL/2, apple.y * CELL + CELL/2);

  // Snake
  const playerColors = [
    { head: '#6fee8e', body: '39,174,96' },
    { head: '#6eb4fe', body: '41,128,185' },
    { head: '#fe6e6e', body: '192,57,43' },
    { head: '#fee96e', body: '212,160,23' },
  ];
  const pColor = playerColors[mpCurrentPlayer] || playerColors[0];

  snake.forEach((seg, i) => {
    const t = i / snake.length;
    const g = ctx.createRadialGradient(
      seg.x * CELL + CELL/2, seg.y * CELL + CELL/2, 1,
      seg.x * CELL + CELL/2, seg.y * CELL + CELL/2, CELL/2
    );
    if (i === 0) {
      g.addColorStop(0, pColor.head);
      g.addColorStop(1, `rgb(${pColor.body})`);
    } else {
      const brightness = 1 - t * 0.4;
      g.addColorStop(0, `rgba(${pColor.body},${brightness})`);
      g.addColorStop(1, `rgba(${pColor.body.split(',').map((v,i)=>i<2?Math.max(0,parseInt(v)-40):v).join(',')},${brightness})`);
    }
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(seg.x * CELL + 1, seg.y * CELL + 1, CELL - 2, CELL - 2, 4);
    ctx.fill();

    if (i === 0) {
      ctx.fillStyle = '#fff';
      const ex = dir.x !== 0 ? (dir.x > 0 ? 0.6 : 0.2) : 0.3;
      const ey = dir.y !== 0 ? (dir.y > 0 ? 0.6 : 0.25) : 0.3;
      ctx.beginPath();
      ctx.arc(seg.x * CELL + CELL * ex, seg.y * CELL + CELL * ey, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(seg.x * CELL + CELL * (1 - ex), seg.y * CELL + CELL * (dir.y !== 0 ? ey : 0.7), 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(seg.x * CELL + CELL * ex, seg.y * CELL + CELL * ey, 1.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(seg.x * CELL + CELL * (1 - ex), seg.y * CELL + CELL * (dir.y !== 0 ? ey : 0.7), 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  if (!gameActive) {
    ctx.fillStyle = 'rgba(10,26,8,0.75)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(212,160,23,0.9)';
    ctx.font = 'bold 16px Cinzel, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Press Start Game', canvas.width/2, canvas.height/2);
  }
}

function endSnake() {
  gameActive = false;
  clearInterval(gameLoop);

  if (playerCount > 1) {
    mpScores[mpCurrentPlayer] = score;
    const nextPlayer = mpCurrentPlayer + 1;
    if (nextPlayer < playerCount) {
      const msg = document.getElementById('snake-message');
      msg.classList.remove('hidden');
      msg.textContent = `💀 P${mpCurrentPlayer + 1} scored ${score}! Pass to P${nextPlayer + 1}…`;
      mpCurrentPlayer = nextPlayer;
      updatePlayerBanner();
      setTimeout(() => {
        msg.classList.add('hidden');
        initSnake();
        gameActive = true;
        const speed = () => Math.max(80, 200 - (level - 1) * 20);
        const tick = () => { if (!gameActive) return; update(); draw(); gameLoop = setTimeout(tick, speed()); };
        gameLoop = setTimeout(tick, speed());
      }, 2500);
    } else {
      // All done
      let bestIdx = 0;
      mpScores.forEach((s, i) => { if (s > mpScores[bestIdx]) bestIdx = i; });
      const msg = document.getElementById('snake-message');
      msg.classList.remove('hidden');
      const scoreStr = mpScores.map((s, i) => `P${i+1}:${s}`).join(' | ');
      msg.textContent = `🏆 Game over! ${scoreStr} — Winner: P${bestIdx + 1}!`;
      document.getElementById('btn-start-snake').textContent = 'Play Again';
    }
  } else {
    const msg = document.getElementById('snake-message');
    msg.classList.remove('hidden');
    msg.textContent = `💀 Game over! Score: ${score}${score >= bestScore && score > 0 ? ' 🏆 New Best!' : ''}`;
    document.getElementById('btn-start-snake').textContent = 'Play Again';
  }
  draw();
}

document.addEventListener('keydown', e => {
  const map = { ArrowUp:'up', ArrowDown:'down', ArrowLeft:'left', ArrowRight:'right',
                w:'up', s:'down', a:'left', d:'right' };
  const action = map[e.key];
  if (!action) return;
  e.preventDefault();
  if (!gameActive) { startSnake(); return; }
  if (action === 'up'    && dir.y === 0) nextDir = { x: 0, y: -1 };
  if (action === 'down'  && dir.y === 0) nextDir = { x: 0, y: 1 };
  if (action === 'left'  && dir.x === 0) nextDir = { x: -1, y: 0 };
  if (action === 'right' && dir.x === 0) nextDir = { x: 1, y: 0 };
});

document.getElementById('btn-start-snake').addEventListener('click', startSnake);

let touchStartX = 0, touchStartY = 0;
canvas.addEventListener('touchstart', e => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
  e.preventDefault();
}, { passive: false });
canvas.addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  if (Math.abs(dx) > Math.abs(dy)) {
    if (dx > 20 && dir.x === 0) nextDir = { x: 1, y: 0 };
    if (dx < -20 && dir.x === 0) nextDir = { x: -1, y: 0 };
  } else {
    if (dy > 20 && dir.y === 0) nextDir = { x: 0, y: 1 };
    if (dy < -20 && dir.y === 0) nextDir = { x: 0, y: -1 };
  }
}, { passive: false });

initSnake();

