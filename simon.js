const SIMON_COLORS = ['red', 'green', 'blue', 'yellow'];
let sequence = [], playerIndex = 0, level = 0;
let isShowingSeq = false, gameActive = false, flashSpeed = 700;

function startGame() {
  sequence = []; playerIndex = 0; level = 0; flashSpeed = 700; gameActive = false;
  document.getElementById('simon-message').classList.add('hidden');
  document.getElementById('level-num').textContent = '—';
  document.getElementById('simon-status').innerHTML = 'Get ready…';
  setButtonsInteractive(false);
  setTimeout(nextRound, 600);
}

function nextRound() {
  level++;
  playerIndex = 0;
  document.getElementById('level-num').textContent = level;
  if (level % 5 === 0 && flashSpeed > 300) flashSpeed = Math.max(300, flashSpeed - 80);
  sequence.push(SIMON_COLORS[Math.floor(Math.random() * 4)]);
  showSequence();
}

function showSequence() {
  isShowingSeq = true;
  setButtonsInteractive(false);
  document.getElementById('simon-status').textContent = 'Watch…';
  let i = 0;
  const interval = setInterval(() => {
    flashButton(sequence[i]);
    i++;
    if (i >= sequence.length) {
      clearInterval(interval);
      setTimeout(() => {
        isShowingSeq = false;
        gameActive = true;
        setButtonsInteractive(true);
        document.getElementById('simon-status').textContent = 'Your turn!';
      }, flashSpeed + 200);
    }
  }, flashSpeed + 300);
}

function flashButton(color) {
  const btn = document.querySelector(`.simon-btn[data-color="${color}"]`);
  btn.classList.add('active');
  setTimeout(() => btn.classList.remove('active'), flashSpeed);
}

function setButtonsInteractive(enabled) {
  document.querySelectorAll('.simon-btn').forEach(btn => {
    btn.disabled = !enabled;
  });
}

document.querySelectorAll('.simon-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!gameActive || isShowingSeq) return;
    const color = btn.dataset.color;
    flashButton(color);
    if (color !== sequence[playerIndex]) {
      gameActive = false;
      setButtonsInteractive(false);
      document.getElementById('simon-status').textContent = '❌ Wrong!';
      const msg = document.getElementById('simon-message');
      msg.classList.remove('hidden');
      let feedback = level >= 10 ? '🏆 Impressive!' : level >= 5 ? '👍 Not bad!' : 'Keep practicing!';
      msg.textContent = `Game over at level ${level}. ${feedback}`;
      return;
    }
    playerIndex++;
    if (playerIndex === sequence.length) {
      gameActive = false;
      document.getElementById('simon-status').textContent = '✅ Correct!';
      setTimeout(nextRound, 900);
    }
  });
});

document.getElementById('btn-start-simon').addEventListener('click', startGame);
