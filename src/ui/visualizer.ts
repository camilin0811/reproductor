// las barras que bailan, dibujadas a mano sobre un lienzo
// el audio solo se puede enchufar al analizador una vez en toda la sesion

let audioCtx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let source: MediaElementAudioSourceNode | null = null;
let canvas: HTMLCanvasElement | null = null;
let ctx2d: CanvasRenderingContext2D | null = null;
let rafId = 0;
let playing = false;

const FFT_SIZE = 2048;
const SMOOTHING = 0.8;
const BARS = 64;
const MIN_FREQ = 40;
const MAX_FREQ = 12000;
const GAIN = 1.6;

export function initVisualizer(c: HTMLCanvasElement): void {
  canvas = c;
  ctx2d = c.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const rect = c.getBoundingClientRect();
  c.width = rect.width * dpr;
  c.height = rect.height * dpr;
  if (ctx2d) ctx2d.scale(dpr, dpr);
}

function ensureAudio(audioEl: HTMLAudioElement): void {
  if (audioCtx !== null) return;
  audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = FFT_SIZE;
  analyser.smoothingTimeConstant = SMOOTHING;
  try {
    source = audioCtx.createMediaElementSource(audioEl);
    source.connect(analyser);
    analyser.connect(audioCtx.destination);
  } catch {
    // ya estaba enchufado
  }
}

export function resumeContext(): void {
  if (audioCtx?.state === "suspended") audioCtx.resume().catch(() => {});
}

export function attachVisualizer(audioEl: HTMLAudioElement, c: HTMLCanvasElement): void {
  initVisualizer(c);
  const start = (): void => {
    ensureAudio(audioEl);
    resumeContext();
    document.removeEventListener("click", start);
    document.removeEventListener("keydown", start);
  };
  document.addEventListener("click", start, { once: true });
  document.addEventListener("keydown", start, { once: true });
}

export function setVisualizerPlaying(v: boolean): void {
  playing = v;
  if (v) loop();
  else if (rafId) cancelAnimationFrame(rafId);
}

// se exporta para poder probarlo sin pagina ni sonido
export function computeLogBins(sampleRate: number, fftSize: number, barsHalf: number, minFreq: number, maxFreq: number): number[] {
  const bins: number[] = [];
  const binCount = fftSize / 2;
  const freqPerBin = sampleRate / fftSize;
  for (let j = 0; j < barsHalf; j++) {
    const t = barsHalf === 1 ? 0 : j / (barsHalf - 1);
    const freq = minFreq * Math.pow(maxFreq / minFreq, t);
    let idx = Math.round(freq / freqPerBin);
    if (idx < 0) idx = 0;
    if (idx >= binCount) idx = binCount - 1;
    bins.push(idx);
  }
  return bins;
}

export function mirroredIndex(i: number, bars: number): number {
  const half = bars / 2;
  if (i < half) return half - 1 - i;
  return i - half;
}

function loop(): void {
  if (!canvas || !ctx2d) {
    if (playing) rafId = requestAnimationFrame(loop);
    return;
  }
  // sin acceso a la senal real, las barras respiran en falso
  // el motor deja escrito en la etiqueta si puede analizarse o no
  const label = document.getElementById("visualizerLabel");
  const labelIsNA = !!(label && label.textContent && label.textContent.includes("N/A"));
  const isIdleEngine = labelIsNA;
  if (!analyser || isIdleEngine) {
    // movimiento inventado, solo decorativo
    if (!canvas) return;
    const w = canvas.getBoundingClientRect().width;
    const h = canvas.getBoundingClientRect().height;
    const barW = w / BARS;
    ctx2d.clearRect(0, 0, w, h);
    const isInHero = canvas.closest(".hero") !== null;
    const inkRgb = "28,20,16";
    for (let i = 0; i < BARS; i++) {
      const val = (0.2 + 0.15 * Math.sin(Date.now() / 500 + i * 0.5)) * 0.3;
      const barH = val * h + 4;
      const x = i * barW + barW * 0.15;
      const bw = Math.max(1, barW * 0.7);
      const y = (h - barH) / 2;
      ctx2d.fillStyle = isInHero ? `rgba(${inkRgb},0.55)` : `rgb(${inkRgb})`;
      ctx2d.fillRect(x, y, bw, barH);
    }
    if (playing || document.visibilityState === "visible" || isIdleEngine) rafId = requestAnimationFrame(loop);
    return;
  }
  const w = canvas.getBoundingClientRect().width;
  const h = canvas.getBoundingClientRect().height;
  const barW = w / BARS;

  ctx2d.clearRect(0, 0, w, h);

  const data = new Uint8Array(analyser.frequencyBinCount);
  if (playing) analyser.getByteFrequencyData(data);
  else {
    for (let i = 0; i < data.length; i++) data[i] = 20 + 15 * Math.sin(Date.now() / 500 + i * 0.5);
  }

  const sampleRate = audioCtx?.sampleRate ?? 48000;
  const half = BARS / 2;
  const logBins = computeLogBins(sampleRate, FFT_SIZE, half, MIN_FREQ, MAX_FREQ);

  const isInHero = canvas.closest(".hero") !== null;
  const inkRgb = "28,20,16";
  const heights: number[] = new Array(BARS).fill(0);
  for (let i = 0; i < BARS; i++) {
    const j = mirroredIndex(i, BARS);
    const bin = logBins[j] ?? 0;
    let val = (data[bin] ?? 0) / 255;
    val = Math.min(1, val * GAIN + 0.04);
    if (!playing) val = val * 0.3;
    const barH = playing ? val * h * 0.85 + h * 0.08 : val * 0.3 * h + 4;
    heights[i] = barH;
  }

  for (let i = 0; i < BARS; i++) {
    const barH = heights[i]!;
    const x = i * barW + barW * 0.15;
    const bw = Math.max(1, barW * 0.7);
    const y = (h - barH) / 2;
    if (isInHero) {
      ctx2d.fillStyle = `rgba(${inkRgb},0.55)`;
    } else {
      ctx2d.fillStyle = `rgb(${inkRgb})`;
    }
    ctx2d.fillRect(x, y, bw, barH);
  }

  if (playing || document.visibilityState === "visible") {
    rafId = requestAnimationFrame(loop);
  }
}
