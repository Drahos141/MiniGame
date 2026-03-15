let board = Array(9).fill(null);
let isXTurn = true, gameOver = false, mode = 'ai';
let scores = { x: 0, o: 0, draw: 0 };

const WIN_COMBOS = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6]
];

function initGame() {
  board = Array(9).fill(null);
  isXTurn = true; gameOver = false;
  renderBoard(); updateStatus();
  if (mode === 'ai' && !isXTurn) setTimeout(aiMove, 500);
}

function renderBoard() {
  const el = document.getElementById('ttt-board');
  el.innerHTML = '';
  for (let i = 0; i < 9; i++) {
    const cell = document.createElement('div');
    cell.className = 'ttt-cell' + (board[i] ? ' filled' : '');
    if (board[i] === 'X') { cell.textContent = '✕'; cell.classList.add('x-cell'); }
    if (board[i] === 'O') { cell.textContent = '○'; cell.classList.add('o-cell'); }
    cell.addEventListener('click', () => handleClick(i));
    el.appendChild(cell);
  }
}

function handleClick(i) {
  if (gameOver || board[i]) return;
  if (mode === 'ai' && !isXTurn) return;
  makeMove(i, isXTurn ? 'X' : 'O');
  if (!gameOver && mode === 'ai' && !isXTurn) setTimeout(aiMove, 420);
}

function makeMove(i, player) {
  board[i] = player;
  isXTurn = !isXTurn;
  renderBoard();
  const result = checkWinner(board);
  if (result) {
    gameOver = true;
    highlightWinner(result.combo);
    if (result.player === 'X') scores.x++; else scores.o++;
    updateScores();
    setTimeout(() => updateStatus(result.player + ' wins! 🎉'), 100);
  } else if (!board.includes(null)) {
    gameOver = true;
    scores.draw++;
    updateScores();
    setTimeout(() => updateStatus("It's a draw! 🤝"), 100);
  } else {
    updateStatus();
  }
}

function aiMove() {
  if (gameOver) return;
  const move = getBestMove(board);
  if (move !== -1) makeMove(move, 'O');
}

function getBestMove(b) {
  for (let i = 0; i < 9; i++) {
    if (!b[i]) { b[i] = 'O'; if (checkWinner(b)) { b[i] = null; return i; } b[i] = null; }
  }
  for (let i = 0; i < 9; i++) {
    if (!b[i]) { b[i] = 'X'; if (checkWinner(b)) { b[i] = null; return i; } b[i] = null; }
  }
  if (!b[4]) return 4;
  const corners = [0,2,6,8].filter(i => !b[i]);
  if (corners.length) return corners[Math.floor(Math.random() * corners.length)];
  const empties = b.map((v,i) => v ? -1 : i).filter(i => i >= 0);
  return empties.length ? empties[Math.floor(Math.random() * empties.length)] : -1;
}

function checkWinner(b) {
  for (const combo of WIN_COMBOS) {
    const [pos1, pos2, pos3] = combo;
    if (b[pos1] && b[pos1] === b[pos2] && b[pos1] === b[pos3]) return { player: b[pos1], combo };
  }
  return null;
}

function highlightWinner(combo) {
  const cells = document.querySelectorAll('.ttt-cell');
  combo.forEach(i => cells[i].classList.add('winner-cell'));
}

function updateStatus(msg) {
  const el = document.getElementById('ttt-status');
  if (msg) { el.textContent = msg; el.className = 'ttt-status-end'; }
  else {
    const p = isXTurn ? 'X' : 'O';
    const who = (mode === 'ai' && !isXTurn) ? 'AI' : `Player ${p}`;
    el.textContent = `${who}'s turn (${p})`; el.className = '';
  }
}

function updateScores() {
  document.getElementById('x-wins').textContent = scores.x;
  document.getElementById('o-wins').textContent = scores.o;
  document.getElementById('draws').textContent = scores.draw;
}

document.getElementById('mode-ai').addEventListener('click', () => {
  mode = 'ai';
  document.getElementById('mode-ai').classList.add('active');
  document.getElementById('mode-2p').classList.remove('active');
  initGame();
});
document.getElementById('mode-2p').addEventListener('click', () => {
  mode = '2p';
  document.getElementById('mode-2p').classList.add('active');
  document.getElementById('mode-ai').classList.remove('active');
  initGame();
});
document.getElementById('btn-new-ttt').addEventListener('click', initGame);

initGame();
