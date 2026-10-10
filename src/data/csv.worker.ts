import Papa from "papaparse";
import type { CsvRow, ParseResponse } from "./csv";

// Delimiter guesses parse fine with the default comma, so only broken quoting and field counts fail an upload.
const STRUCTURAL_ERROR_TYPES = new Set<Papa.ParseError["type"]>(["Quotes", "FieldMismatch"]);

function respond(response: ParseResponse): void {
  self.postMessage(response);
}

function isBlankText(value: unknown): boolean {
  return typeof value === "string" && value.trim() === "";
}

// PapaParse stores fields past the header in __parsed_extra as an array, so a value can be a list of strings.
function isBlankRow(row: CsvRow): boolean {
  return Object.values(row).every((value: unknown) =>
    Array.isArray(value) ? value.every(isBlankText) : isBlankText(value)
  );
}

// A whitespace-only line (common at the end of exports) is flagged by PapaParse but holds no data.
// Quotes errors can point past the data, so only a field mismatch on an existing blank row is exempt.
function isHarmless(error: Papa.ParseError, rows: CsvRow[]): boolean {
  if (error.type !== "FieldMismatch" || error.row === undefined) return false;
  const row = rows[error.row];
  return row !== undefined && isBlankRow(row);
}

function parseResponse(results: Papa.ParseResult<CsvRow>): ParseResponse {
  const problem = results.errors.find(
    (error) => STRUCTURAL_ERROR_TYPES.has(error.type) && !isHarmless(error, results.data)
  );
  // Blank lines are dropped here too, so a whitespace-only trailing line is not counted as a match
  if (!problem) return { ok: true, rows: results.data.filter((row) => !isBlankRow(row)) };
  const where = problem.row === undefined ? "CSV" : `CSV row ${problem.row + 1}`;
  return { ok: false, error: `${where} is malformed: ${problem.message}` };
}

self.onmessage = (event: MessageEvent<File | string>) => {
  const source = event.data;
  const config = {
    header: true,
    skipEmptyLines: true,
    complete: (results: Papa.ParseResult<CsvRow>) => respond(parseResponse(results)),
    error: (error: Error) => respond({ ok: false, error: error.message }),
  };
  Papa.parse<CsvRow>(source, config);
};
