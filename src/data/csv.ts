// One parsed CSV record. Every value is a string; numeric columns are read with cleanNumeric.
export type CsvRow = Record<string, string>;

export type ParseResponse = { ok: true; rows: CsvRow[] } | { ok: false; error: string };

// A new worker per upload keeps the message protocol to one request and one response.
export function parseCsv(source: File | string): Promise<CsvRow[]> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./csv.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<ParseResponse>) => {
      worker.terminate();
      if (event.data.ok) resolve(event.data.rows);
      else reject(new Error(event.data.error));
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message));
    };
    worker.postMessage(source);
  });
}

export function findColumnKey(row: CsvRow, wanted: string): string | undefined {
  const target = wanted.toLowerCase();
  return Object.keys(row).find((key) => key.toLowerCase() === target);
}

export function cleanNumeric(value: string | undefined): number {
  const num = parseFloat(value ?? "");
  return Number.isNaN(num) ? 0 : num;
}

export function isTruthy(value: string | undefined): boolean {
  const normalized = (value ?? "").trim().toLowerCase();
  return ["true", "1", "yes", "y", "on"].includes(normalized);
}
