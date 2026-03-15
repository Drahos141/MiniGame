const SIMON_COLORS = ['red', 'green', 'blue', 'yellow'];

// Multiplayer
const playerCount = parseInt(localStorage.getItem('miniGamePlayers') || '1', 10);
let mpCurrentPlayer = 0;
let mpEliminated = Array(playerCount).fill(false);

let sequence = [], playerIndex = 0, level = 0;
let isShowingSeq = false, gameActive = false, flashSpeed = 700;

function updatePlayerBanner() {
  const banner = document.getElementById('simon-player-banner');
  if (!banner) return;
  if (playerCount > 1) {
    const icons = ['🟡', '🔵', '🔴', '🟢'];
    banner.textContent = `${icons[mpCurrentPlayer]} Player ${mpCurrentPlayer + 1}'s Turn`;
    banner.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
  }
}

function startGame() {
  sequence = []; playerIndex = 0; level = 0; flashSpeed = 700; gameActive = false;
  mpCurrentPlayer = 0;
  mpEliminated = Array(playerCount).fill(false);
  document.getElementById('simon-message').classList.add('hidden');
  document.getElementById('level-num').textContent = '—';
  document.getElementById('simon-status').innerHTML = 'Get ready…';
  setButtonsInteractive(false);
  updatePlayerBanner();
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
        if (playerCount > 1) {
          document.getElementById('simon-status').textContent = `P${mpCurrentPlayer + 1} — repeat the sequence!`;
        } else {
          document.getElementById('simon-status').textContent = 'Your turn!';
        }
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
  document.querySelectorAll('.simon-btn').forEach(btn => { btn.disabled = !enabled; });
}

document.querySelectorAll('.simon-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!gameActive || isShowingSeq) return;
    const color = btn.dataset.color;
    flashButton(color);
    if (color !== sequence[playerIndex]) {
      gameActive = false;
      setButtonsInteractive(false);

      if (playerCount > 1) {
        mpEliminated[mpCurrentPlayer] = true;
        document.getElementById('simon-status').textContent = `❌ P${mpCurrentPlayer + 1} is OUT at level ${level}!`;
        const remaining = mpEliminated.filter(e => !e).length;
        if (remaining === 0) {
          const msg = document.getElementById('simon-message');
          msg.classList.remove('hidden');
          msg.textContent = `Everyone's out at level ${level}! Great game!`;
          return;
        }
        // Move to next alive player
        let next = (mpCurrentPlayer + 1) % playerCount;
        while (mpEliminated[next]) next = (next + 1) % playerCount;
        mpCurrentPlayer = next;
        updatePlayerBanner();
        setTimeout(() => {
          playerIndex = 0;
          gameActive = true;
          setButtonsInteractive(true);
          document.getElementById('simon-status').textContent = `P${mpCurrentPlayer + 1} — repeat the sequence!`;
        }, 1200);
      } else {
        document.getElementById('simon-status').textContent = '❌ Wrong!';
        const msg = document.getElementById('simon-message');
        msg.classList.remove('hidden');
        let feedback = level >= 10 ? '🏆 Impressive!' : level >= 5 ? '👍 Not bad!' : 'Keep practicing!';
        msg.textContent = `Game over at level ${level}. ${feedback}`;
      }
      return;
    }
    playerIndex++;
    if (playerIndex === sequence.length) {
      gameActive = false;
      document.getElementById('simon-status').textContent = '✅ Correct!';
      if (playerCount > 1) {
        // Cycle to next player for the same sequence, then next round after all have gone
        let next = (mpCurrentPlayer + 1) % playerCount;
        while (mpEliminated[next] && next !== mpCurrentPlayer) next = (next + 1) % playerCount;
        const allWent = next === 0 || (mpCurrentPlayer === playerCount - 1 && next === 0);
        if (next <= mpCurrentPlayer && !mpEliminated[0]) {
          // Full rotation done → next round
          mpCurrentPlayer = 0;
          while (mpEliminated[mpCurrentPlayer]) mpCurrentPlayer++;
          updatePlayerBanner();
          setTimeout(nextRound, 900);
        } else {
          mpCurrentPlayer = next;
          updatePlayerBanner();
          setTimeout(() => {
            playerIndex = 0;
            gameActive = true;
            setButtonsInteractive(true);
            document.getElementById('simon-status').textContent = `P${mpCurrentPlayer + 1} — repeat the sequence!`;
          }, 900);
        }
      } else {
        setTimeout(nextRound, 900);
      }
    }
  });
});

document.getElementById('btn-start-simon').addEventListener('click', startGame);
