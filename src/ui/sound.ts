// TF2 UI sounds. The click is sound/ui/buttonclick.wav from tf2_sound_misc_dir.vpk, and the others are processed copies
// of sound/ui files from the same VPK (see docs/development.md). Web Audio instead of `new Audio()` per play, since a
// fresh media element clips short sounds at their start or end. The context is created on the first gesture, which the
// autoplay policy allows, and the files are fetched then too, so muted visitors never download them.
const sfxBase = `${import.meta.env.BASE_URL}ui/sfx/`;
const soundUrls = {
  click: `${sfxBase}buttonclick.wav`,
  "panel-open": `${sfxBase}panel-open.wav`,
  "panel-close": `${sfxBase}panel-close.wav`,
  "dashboard-ready": `${sfxBase}dashboard-ready.wav`,
  error: `${sfxBase}error.wav`,
  "strip-open": `${sfxBase}strip-open.wav`,
  "strip-close": `${sfxBase}strip-close.wav`,
};

export type SoundName = keyof typeof soundUrls;

interface SoundOutput {
  context: AudioContext;
  output: GainNode;
  // Set per sound once its fetch and decode finish. A sound requested sooner stays silent.
  buffers: Map<string, AudioBuffer>;
}

let audio: SoundOutput | undefined;
// Set when unmuting before the click buffer is ready. The decode callback plays the click once, then clears it.
let playWhenReady = false;

const storageKey = "tf2viz-muted";
let muted = localStorage.getItem(storageKey) === "1";
const listeners = new Set<() => void>();

export const isMuted = () => muted;

// Shaped for useSyncExternalStore, so the toggle button re-renders when the mute state changes.
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function toggleMuted(): void {
  muted = !muted;
  localStorage.setItem(storageKey, muted ? "1" : "0");
  // The document click listener runs before this toggle, so it still saw muted and stayed silent. Play here when
  // unmuting; muting already got its click from that listener.
  if (!muted) {
    prepare();
    if (audio?.buffers.has("click")) playSound("click");
    else playWhenReady = true;
  }
  for (const listener of listeners) listener();
}

// Runs on the first pointerdown or keydown while unmuted, so the files are ready before the click event plays them.
function prepare(): void {
  if (audio || muted) return;
  const context = new AudioContext();
  const output = context.createGain();
  output.gain.value = 0.5;
  output.connect(context.destination);
  const created: SoundOutput = { context, output, buffers: new Map() };
  audio = created;
  for (const [name, url] of Object.entries(soundUrls)) loadSound(created, name, url);
}

// Each file loads on its own, so a missing file or failed decode only silences that sound and never breaks the page.
function loadSound(sound: SoundOutput, name: string, url: string): void {
  fetch(url)
    .then((response) => response.arrayBuffer())
    .then((data) => sound.context.decodeAudioData(data))
    .then((decoded) => {
      sound.buffers.set(name, decoded);
      if (name === "click" && playWhenReady) {
        playWhenReady = false;
        playSound("click");
      }
    })
    .catch((error: unknown) => console.error(`${name} sound failed to load`, error));
}

// Silent while muted or before that sound's buffer is ready. The document listener below calls it for matched controls,
// and other sounds are played by the code that opens or closes the panel or row.
export function playSound(name: SoundName, gainDb = 0): void {
  if (muted || !audio) return;
  const buffer = audio.buffers.get(name);
  if (!buffer) return;
  const { context, output } = audio;
  const source = context.createBufferSource();
  source.buffer = buffer;
  if (gainDb === 0) {
    source.connect(output);
  } else {
    // A gain for this play only, so a quieter copy can sound alongside another sound on the shared output
    const gain = context.createGain();
    gain.gain.value = 10 ** (gainDb / 20);
    source.connect(gain).connect(output);
  }
  source.start();
}

// Every TF2 control makes the click, including keyboard activation, which fires a click event too. Canvas bars are
// not in this selector, so MapsChartPanel plays its own click. Controls marked data-sound="none" are skipped, for
// triggers whose panel sound already plays on the same press.
// Capture phase, because FilterMenu stops bubbling at its controls and a bubble listener would miss them.
const controls = ".tf-button, .tab-button, .text-button, .filter-item";
document.addEventListener("click", (event) => {
  if (muted) return;
  if (!(event.target instanceof Element)) return;
  const control = event.target.closest(controls);
  if (control && !control.matches(":disabled") && !event.target.closest('[data-sound="none"]')) playSound("click");
}, true);
document.addEventListener("pointerdown", prepare, { passive: true });
document.addEventListener("keydown", prepare);
