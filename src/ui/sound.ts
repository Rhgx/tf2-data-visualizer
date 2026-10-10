// TF2's button click (sound/ui/buttonclick.wav from tf2_sound_misc_dir.vpk). Web Audio instead of `new Audio()` per
// click, since a fresh media element clips the 79ms sound at its start or end. The context is created on the first
// gesture, which the autoplay policy allows, and the file is fetched then too, so muted visitors never download it.
const soundUrl = `${import.meta.env.BASE_URL}ui/sfx/buttonclick.wav`;

interface ClickSound {
  context: AudioContext;
  output: GainNode;
  // Set once the fetch and decode finish. A click that comes sooner stays silent.
  buffer: AudioBuffer | undefined;
}

let audio: ClickSound | undefined;
// Set when unmuting before the buffer is ready. The decode callback plays the click once, then clears it.
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
    if (audio?.buffer) play();
    else playWhenReady = true;
  }
  for (const listener of listeners) listener();
}

// Runs on the first pointerdown or keydown while unmuted, so the file is ready before the click event plays it.
function prepare(): void {
  if (audio || muted) return;
  const context = new AudioContext();
  const output = context.createGain();
  output.gain.value = 0.5;
  output.connect(context.destination);
  const created: ClickSound = { context, output, buffer: undefined };
  audio = created;
  // A missing file or a failed decode must not break the page; the click just stays silent.
  fetch(soundUrl)
    .then((response) => response.arrayBuffer())
    .then((data) => context.decodeAudioData(data))
    .then((decoded) => {
      created.buffer = decoded;
      if (playWhenReady) {
        playWhenReady = false;
        play();
      }
    })
    .catch((error: unknown) => console.error("Click sound failed to load", error));
}

function play(): void {
  if (muted || !audio?.buffer) return;
  const { context, output, buffer } = audio;
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(output);
  source.start();
}

// Every TF2 control makes the click, including keyboard activation, which fires a click event too.
// Capture phase, because FilterMenu stops bubbling at its controls and a bubble listener would miss them.
const controls = ".tf-button, .tab-button, .text-button, .filter-item";
document.addEventListener("click", (event) => {
  if (muted) return;
  if (!(event.target instanceof Element)) return;
  const control = event.target.closest(controls);
  if (control && !control.matches(":disabled")) play();
}, true);
document.addEventListener("pointerdown", prepare, { passive: true });
document.addEventListener("keydown", prepare);
