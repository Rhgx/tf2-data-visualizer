import { lazy, startTransition, Suspense, useCallback, useEffect, useRef, useState, type JSX } from "react";
import { parseCsv } from "./data/csv";
import type { Match } from "./data/match";
import { MainMenu } from "./menu/MainMenu";
import { whenIdle } from "./lib/idle";

const PARSE_ERROR = "Could not read this file as a match history CSV. Check that it is unedited, then try again.";
const PASTE_ERROR = "Could not read the pasted text as a match history CSV. Check that you copied the whole file, then try again.";
const CHUNK_ERROR = "Could not load the dashboard. Check your connection and reload the page.";

// A lazy chunk failed to load. It is told apart from a CSV parse failure so the alert can name the connection.
class ChunkLoadError extends Error {}

// The dashboard and the CSV-to-match conversion (which pulls in the map data) are kept out of the entry chunk. Each load
// starts both imports alongside the CSV parse. The module is cached after its first import, so repeat calls are free.
const loadDashboard = () => import("./dashboard/Dashboard");
const Dashboard = lazy(() => loadDashboard().then((loaded) => ({ default: loaded.Dashboard })));

// One loaded file. The id changes on every load, so the dashboard remounts and its filters, search and tab start fresh.
interface Upload {
  id: number;
  matches: Match[];
}

function isFileDrag(event: DragEvent): boolean {
  return event.dataTransfer?.types.includes("Files") ?? false;
}

// No upload means the menu is showing. Going back clears the upload, which drops the loaded matches.
export function App(): JSX.Element {
  const [upload, setUpload] = useState<Upload | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  // Each load takes the next id. Only the latest id may apply its result or error, and Back moves the counter on
  // so a load still parsing cannot reopen the dashboard.
  const latestLoad = useRef(0);

  const loadSource = useCallback(async (source: File | string, failureMessage: string): Promise<void> => {
    latestLoad.current += 1;
    const loadId = latestLoad.current;
    setLoading(true);
    try {
      // Joined into the same Promise.all as the parse, so a failed chunk rejects this load and is never left unhandled.
      const chunks = Promise.all([import("./data/match"), loadDashboard()]).catch((cause: unknown) => {
        throw new ChunkLoadError(CHUNK_ERROR, { cause });
      });
      const [rows, [{ toMatches }]] = await Promise.all([parseCsv(source), chunks]);
      if (loadId !== latestLoad.current) return;
      const matches = toMatches(rows);
      // A transition keeps the menu on screen until the dashboard renders, instead of showing an empty fallback. Back
      // can run before React renders this update, so the updater checks the id again.
      startTransition(() => {
        setUpload((previous) => (loadId === latestLoad.current ? { id: (previous?.id ?? 0) + 1, matches } : previous));
      });
    } catch (error) {
      if (loadId !== latestLoad.current) return;
      console.error(error);
      alert(error instanceof ChunkLoadError ? error.message : failureMessage);
    } finally {
      if (loadId === latestLoad.current) setLoading(false);
    }
  }, []);

  // The pending load skips its own loading reset once it is dropped, so Back clears the loading line itself.
  const goBack = () => {
    latestLoad.current += 1;
    setLoading(false);
    setUpload(null);
  };

  // Fetches the dashboard chunk once the menu is up, so a load that follows does not wait on the network.
  useEffect(() => {
    return whenIdle(() => {
      loadDashboard().catch((error: unknown) => console.error(error));
    });
  }, []);

  useEffect(() => {
    // dragenter and dragleave fire for every child element, so the depth counts the enters still open.
    let dragDepth = 0;

    const handleDragEnter = (event: DragEvent) => {
      if (!isFileDrag(event)) return;
      dragDepth++;
      setDragging(true);
    };
    const handleDragLeave = () => {
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) setDragging(false);
    };
    const handleDragOver = (event: DragEvent) => {
      // Without preventDefault the browser never fires drop, and it opens the file instead.
      if (isFileDrag(event)) event.preventDefault();
    };
    const handleDrop = (event: DragEvent) => {
      if (!isFileDrag(event)) return;
      event.preventDefault();
      dragDepth = 0;
      setDragging(false);
      const file = event.dataTransfer?.files[0];
      if (file) loadSource(file, PARSE_ERROR);
    };
    // Pasting CSV text anywhere on the page loads it, except into a field where the paste is meant as text
    const handlePaste = (event: ClipboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      const text = event.clipboardData?.getData("text/plain") ?? "";
      if (/[,;\t]/.test(text)) loadSource(text, PASTE_ERROR);
    };

    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("drop", handleDrop);
    window.addEventListener("paste", handlePaste);
    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("drop", handleDrop);
      window.removeEventListener("paste", handlePaste);
    };
  }, [loadSource]);

  return (
    <>
      {/* The boundary is mounted from the start, so the transition in loadSource keeps the menu up while the dashboard resolves. */}
      <Suspense fallback={null}>
        {upload ? (
          <Dashboard key={upload.id} matches={upload.matches} onBack={goBack} />
        ) : (
          <MainMenu loading={loading} onFile={(file) => loadSource(file, PARSE_ERROR)} />
        )}
      </Suspense>

      {dragging && (
        <div className="drop-overlay" aria-hidden="true">
          <p>Drop CSV to load</p>
        </div>
      )}
    </>
  );
}
