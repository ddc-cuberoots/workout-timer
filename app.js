const totalTimeInput = document.getElementById("totalTime");
const intervalTimeInput = document.getElementById("intervalTime");
const roundLimitInput = document.getElementById("roundLimit");
const voiceCuesInput = document.getElementById("voiceCues");

const timeLeftEl = document.getElementById("timeLeft");
const roundNowEl = document.getElementById("roundNow");
const roundMaxEl = document.getElementById("roundMax");
const intervalLeftEl = document.getElementById("intervalLeft");
const elapsedEl = document.getElementById("elapsed");
const statusEl = document.getElementById("status");
const progressBar = document.getElementById("progressBar");

const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resetBtn = document.getElementById("resetBtn");
const testSoundBtn = document.getElementById("testSound");

let audioCtx = null;
let timerRaf = null;
let startTimestamp = null;
let pausedElapsed = 0;
let lastCompletedRound = 0;
let running = false;

function parseTime(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  const parts = trimmed.split(":").map((part) => Number(part));
  if (parts.some((part) => Number.isNaN(part))) return null;
  if (parts.length === 1) return Math.max(0, parts[0]);
  if (parts.length === 2) return Math.max(0, parts[0] * 60 + parts[1]);
  return Math.max(0, parts[0] * 3600 + parts[1] * 60 + parts[2]);
}

function formatTime(totalSeconds) {
  const clamped = Math.max(0, Math.ceil(totalSeconds));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

async function ensureAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    await audioCtx.resume();
  }
}

function playBeep({ frequency = 880, duration = 0.1, volume = 0.12 }) {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const oscillator = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(volume, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(gain).connect(audioCtx.destination);
  oscillator.start(now);
  oscillator.stop(now + duration);
}

function speak(text) {
  if (!voiceCuesInput.checked) return;
  if (!("speechSynthesis" in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.volume = 0.9;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function getRunConfig() {
  const totalSeconds = parseTime(totalTimeInput.value);
  const intervalSeconds = parseTime(intervalTimeInput.value);
  const roundLimit = Math.max(1, Number(roundLimitInput.value) || 1);

  if (!totalSeconds || !intervalSeconds) {
    return null;
  }
  const maxFromRounds = intervalSeconds * roundLimit;
  const runTotalSeconds = Math.min(totalSeconds, maxFromRounds);
  return { totalSeconds, intervalSeconds, roundLimit, runTotalSeconds };
}

function updateDisplay(elapsedSeconds, config) {
  const remaining = Math.max(0, config.runTotalSeconds - elapsedSeconds);
  const completedRounds = Math.min(
    config.roundLimit,
    Math.floor(elapsedSeconds / config.intervalSeconds)
  );
  const intervalProgress = elapsedSeconds % config.intervalSeconds;
  const intervalRemaining = Math.max(0, config.intervalSeconds - intervalProgress);

  timeLeftEl.textContent = formatTime(remaining);
  intervalLeftEl.textContent = formatTime(intervalRemaining);
  elapsedEl.textContent = formatTime(elapsedSeconds);
  roundNowEl.textContent = String(completedRounds);
  roundMaxEl.textContent = String(config.roundLimit);

  const progress = config.runTotalSeconds
    ? ((config.runTotalSeconds - remaining) / config.runTotalSeconds) * 100
    : 0;
  progressBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
}

function stopTimer() {
  running = false;
  startTimestamp = null;
  pausedElapsed = 0;
  lastCompletedRound = 0;
  if (timerRaf) {
    cancelAnimationFrame(timerRaf);
    timerRaf = null;
  }
  startBtn.disabled = false;
  pauseBtn.disabled = true;
  statusEl.textContent = "Ready";
}

function finishWorkout() {
  running = false;
  if (timerRaf) {
    cancelAnimationFrame(timerRaf);
    timerRaf = null;
  }
  pauseBtn.disabled = true;
  startBtn.disabled = false;
  statusEl.textContent = "Complete";
  playBeep({ frequency: 440, duration: 0.5, volume: 0.2 });
  speak("Workout complete");
}

function tick(config) {
  if (!running) return;
  const now = performance.now();
  const elapsedSeconds = Math.max(0, (now - startTimestamp) / 1000);

  const completedRounds = Math.min(
    config.roundLimit,
    Math.floor(elapsedSeconds / config.intervalSeconds)
  );

  if (completedRounds > lastCompletedRound && completedRounds <= config.roundLimit) {
    lastCompletedRound = completedRounds;
    playBeep({ frequency: 880, duration: 0.1, volume: 0.14 });
    speak(`Round ${completedRounds}`);
  }

  updateDisplay(elapsedSeconds, config);

  if (elapsedSeconds >= config.runTotalSeconds - 0.05) {
    updateDisplay(config.runTotalSeconds, config);
    finishWorkout();
    return;
  }

  timerRaf = requestAnimationFrame(() => tick(config));
}

function startTimer() {
  const config = getRunConfig();
  if (!config) {
    statusEl.textContent = "Invalid input";
    return;
  }
  statusEl.textContent = "Running";
  startBtn.disabled = true;
  pauseBtn.disabled = false;
  running = true;
  lastCompletedRound = Math.min(
    config.roundLimit,
    Math.floor(pausedElapsed / config.intervalSeconds)
  );
  startTimestamp = performance.now() - pausedElapsed * 1000;
  tick(config);
}

function pauseTimer() {
  if (!running) return;
  running = false;
  if (timerRaf) {
    cancelAnimationFrame(timerRaf);
    timerRaf = null;
  }
  const now = performance.now();
  pausedElapsed = Math.max(0, (now - startTimestamp) / 1000);
  statusEl.textContent = "Paused";
  startBtn.disabled = false;
  pauseBtn.disabled = true;
}

function resetTimer() {
  const config = getRunConfig();
  stopTimer();
  if (!config) {
    timeLeftEl.textContent = "00:00";
    intervalLeftEl.textContent = "00:00";
    elapsedEl.textContent = "00:00";
    progressBar.style.width = "0%";
    roundNowEl.textContent = "0";
    roundMaxEl.textContent = "0";
    return;
  }
  updateDisplay(0, config);
}

function handleInputChange() {
  resetTimer();
}

startBtn.addEventListener("click", async () => {
  await ensureAudio();
  startTimer();
});

pauseBtn.addEventListener("click", pauseTimer);
resetBtn.addEventListener("click", resetTimer);

testSoundBtn.addEventListener("click", async () => {
  await ensureAudio();
  playBeep({ frequency: 660, duration: 0.12, volume: 0.16 });
});

totalTimeInput.addEventListener("change", handleInputChange);
intervalTimeInput.addEventListener("change", handleInputChange);
roundLimitInput.addEventListener("change", handleInputChange);

resetTimer();
