import type { Board, Classification, DefectType, Disposition, Severity } from "./types";

export async function fetchBoards(): Promise<Board[]> {
  const res = await fetch("/boards");
  if (!res.ok) throw new Error(`boards failed: ${res.status}`);
  return res.json();
}

// Sends an image (a board photo or a camera frame) to /triage.
export async function triage(image: Blob, filename: string): Promise<Classification> {
  const form = new FormData();
  form.append("image", image, filename);
  const res = await fetch("/triage", { method: "POST", body: form });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`triage failed (${res.status}): ${detail}`);
  }
  return res.json();
}

export interface CorrectionInput {
  boardId: string;
  original: Classification;
  corrected: { defect_type: DefectType; severity: Severity; disposition: Disposition };
  reason: string;
}

// Stores an inspector's correction in Mubit so future triage can recall it.
export async function sendCorrection(input: CorrectionInput): Promise<void> {
  const res = await fetch("/corrections", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      board_id: input.boardId,
      original: input.original,
      corrected: input.corrected,
      reason: input.reason,
    }),
  });
  if (!res.ok) throw new Error(`correction failed (${res.status})`);
}
