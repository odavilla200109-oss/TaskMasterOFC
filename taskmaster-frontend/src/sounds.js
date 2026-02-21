/**
 * sounds.js — Efeitos sonoros via Web Audio API
 * Sem dependências externas, funciona em qualquer navegador moderno.
 */

let ctx = null;

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function playTone({ freq = 440, type = "sine", duration = 0.15, gain = 0.3, decay = 0.1, detune = 0 }) {
  try {
    const c   = getCtx();
    const osc = c.createOscillator();
    const env = c.createGain();

    osc.type            = type;
    osc.frequency.value = freq;
    osc.detune.value    = detune;

    env.gain.setValueAtTime(gain, c.currentTime);
    env.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);

    osc.connect(env);
    env.connect(c.destination);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + duration + decay);
  } catch (_) {
    // Silencia erros de AudioContext (ex: política de autoplay do browser)
  }
}

// Bloop suave ao criar um nó novo
export function soundNodeCreate() {
  playTone({ freq: 520, type: "sine", duration: 0.12, gain: 0.25 });
  setTimeout(() => playTone({ freq: 780, type: "sine", duration: 0.10, gain: 0.15 }), 80);
}

// Pop dopaminérgico ao concluir tarefa
export function soundNodeComplete() {
  playTone({ freq: 440, type: "sine", duration: 0.08, gain: 0.2 });
  setTimeout(() => playTone({ freq: 660, type: "sine", duration: 0.08, gain: 0.2 }),  60);
  setTimeout(() => playTone({ freq: 880, type: "sine", duration: 0.12, gain: 0.25 }), 120);
}

// Bip leve ao criar subtarefa
export function soundSubtaskCreate() {
  playTone({ freq: 600, type: "triangle", duration: 0.08, gain: 0.18 });
  setTimeout(() => playTone({ freq: 750, type: "triangle", duration: 0.07, gain: 0.12 }), 60);
}

// Clique suave ao excluir
export function soundDelete() {
  playTone({ freq: 220, type: "triangle", duration: 0.1, gain: 0.15 });
}
