import { useRef, useState, type ChangeEvent, type JSX } from "react";
import { SoundButton } from "../ui/SoundButton";
import { TfButton } from "../ui/Button";
import { HelpDialog, preloadFetcherScript } from "./HelpDialog";
import { MENU_CHARACTER } from "./characters";
import "./menu.css";

interface MainMenuProps {
  loading: boolean;
  onFile: (file: File) => void;
}

export function MainMenu({ loading, onFile }: MainMenuProps): JSX.Element {
  const fileInput = useRef<HTMLInputElement>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  function openFilePicker(): void {
    fileInput.current?.click();
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    if (file) onFile(file);
  }

  return (
    <div id="menu-screen">
      {MENU_CHARACTER !== null && (
        <div className="menu-art" aria-hidden="true">
          {/* The source has the same media query as menu.css's .menu-art, so the art is only requested where it is shown. */}
          <picture>
            <source media="(min-width: 900px) and (min-height: 600px)" srcSet={import.meta.env.BASE_URL + MENU_CHARACTER} />
            <img alt="" decoding="async" />
          </picture>
        </div>
      )}

      <div className="menu">
        <div className="menu-main">
          <h1 className="wordmark"><small>TF2 Match Data</small> Visualizer</h1>

          <section className="panel menu-panel" aria-label="Load data">
            <TfButton size="menu" icon="ui/glyphs/csv.svg" onClick={openFilePicker}>
              Load Match History
            </TfButton>
            <input ref={fileInput} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
            <TfButton
              size="menu"
              icon="ui/glyphs/tutorial.png"
              onPointerEnter={preloadFetcherScript}
              onFocus={preloadFetcherScript}
              data-sound="none"
              onClick={() => setHelpOpen(true)}
            >
              How do I get my data?
            </TfButton>
            <p className="menu-hint">Or drop / paste a CSV anywhere.</p>
            <div className={loading ? "loading" : "loading hidden"} role="status" aria-live="polite">
              Processing data...
            </div>
          </section>
        </div>
      </div>

      <footer className="dialog-footer">
        <SoundButton />
        <p>Unofficial fan tool, not affiliated with Valve. Made by <a href="https://github.com/Rhgx">Rocks</a></p>
      </footer>

      <HelpDialog
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        onLoad={() => {
          // The picker opens from this click (a user gesture), so the dialog can close first.
          setHelpOpen(false);
          openFilePicker();
        }}
      />
    </div>
  );
}
