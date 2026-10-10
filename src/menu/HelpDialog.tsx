import { useEffect, useRef, useState, type JSX } from "react";
import { TfButton } from "../ui/Button";

const MATCH_HISTORY_URL = "https://steamcommunity.com/my/gcpd/440/?tab=playermatchhistory";

// The script is about 10 kB and only needed once the dialog opens, so it is its own chunk. The module is cached after
// the first import, so calling this again is cheap.
function loadFetcherScript(): Promise<string> {
  return import("../../scripts/fetcher.js?raw").then((loaded) => loaded.default);
}

// Starts the download before the dialog opens, from the button that opens it. The dialog's own load then resolves from
// the module cache.
export function preloadFetcherScript(): void {
  loadFetcherScript().catch((error: unknown) => console.error("Failed to load script:", error));
}

interface HelpDialogProps {
  open: boolean;
  onClose: () => void;
  // Closes the dialog and opens the file picker, which the menu owns.
  onLoad: () => void;
}

// The help dialog is modal (focus trap and backdrop), so it opens with showModal rather than the open attribute.
export function HelpDialog({ open, onClose, onLoad }: HelpDialogProps): JSX.Element {
  const dialog = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);
  const [fetcherScript, setFetcherScript] = useState<string | null>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  useEffect(() => {
    if (!open || fetcherScript !== null) return;
    loadFetcherScript()
      .then(setFetcherScript)
      .catch((error: unknown) => console.error("Failed to load script:", error));
  }, [open, fetcherScript]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  // The text is already loaded (the button is disabled until then), so the clipboard write starts inside the click.
  // Safari only allows it during the user gesture, and an await for the script would end that window.
  function copyScript(): void {
    if (fetcherScript === null) return;
    navigator.clipboard.writeText(fetcherScript).then(
      () => setCopied(true),
      (error: unknown) => {
        console.error("Failed to copy script:", error);
        alert("Failed to copy. Please try again.");
      }
    );
  }

  function openMatchHistory(): void {
    window.open(MATCH_HISTORY_URL, "_blank", "noopener");
  }

  return (
    <dialog
      ref={dialog}
      className="help-modal"
      aria-labelledby="help-modal-title"
      onClose={onClose}
      // A click on the dialog element itself (not its content) is a click on the backdrop
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
    >
      <section className="panel help-panel">
        <header className="panel-title">
          <h2 id="help-modal-title">How do I get my data?</h2>
          <button
            className="tf-button icon-button small-button"
            type="button"
            aria-label="Close"
            data-tip="Close"
            onClick={() => dialog.current?.close()}
          >
            <img src="ui/glyphs/close_x.png" alt="" />
          </button>
        </header>

        <ol className="help-steps">
          <li className="help-step">
            <span className="step-number">1</span>
            <div className="step-body">
              <div className="step-text">
                <strong className="step-title">Open your match history</strong>
                <p className="step-detail">In a browser, signed in to Steam.</p>
              </div>
              <TfButton size="small" onClick={openMatchHistory}>
                Open Steam page
              </TfButton>
            </div>
          </li>

          <li className="help-step">
            <span className="step-number">2</span>
            <div className="step-body">
              <div className="step-text">
                <strong className="step-title">Copy the script</strong>
              </div>
              <TfButton size="small" disabled={fetcherScript === null} onClick={copyScript}>
                {copied ? "Copied!" : "Copy script"}
              </TfButton>
            </div>
          </li>

          <li className="help-step">
            <span className="step-number">3</span>
            <div className="step-body">
              <div className="step-text">
                <strong className="step-title">Run it in the console</strong>
                <p className="step-line">
                  <kbd>F12</kbd>, Console, paste, <kbd>Enter</kbd>
                </p>
                <p className="step-detail">
                  Chrome may ask you to type <code>allow pasting</code> first.
                </p>
              </div>
            </div>
          </li>

          <li className="help-step">
            <span className="step-number">4</span>
            <div className="step-body">
              <div className="step-text">
                <strong className="step-title">Wait for the download</strong>
                <p className="step-detail">
                  It saves <code>{"casual_<name>.csv"}</code> when it finishes. Progress is logged in the console.
                </p>
              </div>
            </div>
          </li>

          <li className="help-step">
            <span className="step-number">5</span>
            <div className="step-body">
              <div className="step-text">
                <strong className="step-title">Load it here</strong>
                <p className="step-detail">Or drop it anywhere.</p>
              </div>
              <TfButton size="small" onClick={onLoad}>
                Load CSV
              </TfButton>
            </div>
          </li>
        </ol>

        <details className="help-details">
          <summary>What does the script do?</summary>
          <p>
            It reads your match history pages on steamcommunity.com with your signed in Steam session, then builds the
            CSV in your browser. Nothing is sent to any other server.
          </p>
          {fetcherScript !== null && <pre className="well help-script">{fetcherScript}</pre>}
        </details>
      </section>
    </dialog>
  );
}
