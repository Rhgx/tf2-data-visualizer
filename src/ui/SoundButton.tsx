import { useSyncExternalStore } from "react";
import { TfButton } from "./Button";
import { isMuted, subscribe, toggleMuted } from "./sound";

// The speaker shows waves while sound is on and a cross when muted. CSS picks the part from aria-pressed (base.css).
export function SoundButton() {
  const muted = useSyncExternalStore(subscribe, isMuted);
  return (
    <TfButton iconOnly label="Sound" className="sound-button" aria-pressed={!muted} onClick={toggleMuted}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path className="speaker" d="M3 9h4l5-4.5v15L7 15H3z" />
        <path className="waves" d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9.5 9.5 0 0 1 0 13" />
        <path className="cross" d="M15.5 9l6 6m0-6l-6 6" />
      </svg>
    </TfButton>
  );
}
