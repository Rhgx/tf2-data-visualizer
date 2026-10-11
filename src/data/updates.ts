// TF2 update releases from Meet Your Match (the start of casual matchmaking) onward: every major update and every seasonal
// update, oldest first. Dates are from the TF2 Wiki Patches and Updates pages (https://wiki.teamfortress.com/wiki/Patches),
// and names are the wiki page titles. To add a release, see docs/development.md#updating-the-update-list.
export type UpdateKind = "major" | "halloween" | "smissmas" | "summer";

// date is "YYYY-MM-DD"
export interface TfUpdate {
  date: string;
  name: string;
  kind: UpdateKind;
}

// Names a release's kind in tooltips, like "Scream Fortress XVIII (Halloween update)"
export const UPDATE_KIND_LABELS: Record<UpdateKind, string> = {
  major: "Major update",
  halloween: "Halloween update",
  smissmas: "Smissmas update",
  summer: "Summer update",
};

export const UPDATES: TfUpdate[] = [
  { date: "2016-07-07", name: "Meet Your Match Update", kind: "major" },
  { date: "2016-10-21", name: "Scream Fortress VIII", kind: "halloween" },
  { date: "2016-12-21", name: "Smissmas 2016", kind: "smissmas" },
  { date: "2017-10-20", name: "Jungle Inferno Update", kind: "major" },
  { date: "2017-10-26", name: "Scream Fortress IX", kind: "halloween" },
  { date: "2017-12-21", name: "Smissmas 2017", kind: "smissmas" },
  { date: "2018-03-28", name: "Blue Moon Pack", kind: "major" },
  { date: "2018-10-19", name: "Scream Fortress X", kind: "halloween" },
  { date: "2018-12-19", name: "Smissmas 2018", kind: "smissmas" },
  { date: "2019-07-25", name: "Summer 2019 Pack", kind: "summer" },
  { date: "2019-10-10", name: "Scream Fortress XI", kind: "halloween" },
  { date: "2019-12-16", name: "Smissmas 2019", kind: "smissmas" },
  { date: "2020-08-21", name: "Summer 2020 Pack", kind: "summer" },
  { date: "2020-10-01", name: "Scream Fortress XII", kind: "halloween" },
  { date: "2020-12-03", name: "Smissmas 2020", kind: "smissmas" },
  { date: "2021-06-22", name: "Summer 2021 Pack", kind: "summer" },
  { date: "2021-10-05", name: "Scream Fortress XIII", kind: "halloween" },
  { date: "2021-12-02", name: "Smissmas 2021", kind: "smissmas" },
  { date: "2022-07-29", name: "Summer 2022 Pack", kind: "summer" },
  { date: "2022-10-05", name: "Scream Fortress XIV", kind: "halloween" },
  { date: "2022-12-05", name: "Smissmas 2022", kind: "smissmas" },
  { date: "2023-07-12", name: "Summer 2023 Update", kind: "summer" },
  { date: "2023-10-09", name: "Scream Fortress XV", kind: "halloween" },
  { date: "2023-12-07", name: "Smissmas 2023", kind: "smissmas" },
  { date: "2024-07-18", name: "Summer 2024 Update", kind: "summer" },
  { date: "2024-10-10", name: "Scream Fortress XVI", kind: "halloween" },
  { date: "2024-12-11", name: "Smissmas 2024", kind: "smissmas" },
  { date: "2025-07-24", name: "Summer 2025 Update", kind: "summer" },
  { date: "2025-10-09", name: "Scream Fortress XVII", kind: "halloween" },
  { date: "2025-12-09", name: "Smissmas 2025", kind: "smissmas" },
  { date: "2026-07-07", name: "Summer 2026 Update", kind: "summer" },
  { date: "2026-10-01", name: "Scream Fortress XVIII", kind: "halloween" },
];

// The updates released on a "YYYY-MM-DD" day, for the calendar outlines
export function updatesOn(dateKey: string): TfUpdate[] {
  return UPDATES.filter((update) => update.date === dateKey);
}
