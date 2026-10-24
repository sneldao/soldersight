import type {
  Benchmark,
  Board,
  Classification,
  Comparison,
  DefectType,
  Disposition,
  Inspection,
  LaneSummary,
  Rules,
  Severity,
  VerifyResult,
} from "./types";

export async function fetchBoards(): Promise<Board[]> {
  const res = await fetch("/boards");
  if (!res.ok) throw new Error(`boards failed: ${res.status}`);
  return res.json();
}

async function postForm<T>(url: string, form: FormData): Promise<T> {
  const res = await fetch(url, { method: "POST", body: form });
  if (!res.ok) throw new Error(`${url} failed (${res.status}): ${await res.text()}`);
  return res.json();
}

// Sends an image (a board photo or a camera frame) to /triage. With a reference
// template attached the backend diffs against it; without one it's four quadrant
// crops.
export function triage(
  image: Blob,
  filename: string,
  lane: string,
  template?: File | null,
): Promise<Inspection> {
  const form = new FormData();
  form.append("image", image, filename);
  form.append("lane", lane);
  if (template) form.append("template", template);
  return postForm<Inspection>("/triage", form);
}

// A dataset board: only the cells that differ from its known-good template are sent.
export function triageBoard(boardId: string, lane: string): Promise<Inspection> {
  const form = new FormData();
  form.append("lane", lane);
  return postForm<Inspection>(`/triage/board/${boardId}`, form);
}

export async function fetchRules(): Promise<Rules> {
  const res = await fetch("/rules");
  if (!res.ok) throw new Error(`rules failed: ${res.status}`);
  return res.json();
}

export async function compare(boardIds: string[]): Promise<Comparison> {
  const res = await fetch("/compare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ board_ids: boardIds, lanes: ["baseline", "adapted"] }),
  });
  if (!res.ok) throw new Error(`compare failed (${res.status}): ${await res.text()}`);
  return res.json();
}

export async function fetchMetrics(): Promise<Record<string, LaneSummary>> {
  const res = await fetch("/metrics");
  if (!res.ok) throw new Error(`metrics failed: ${res.status}`);
  const body = (await res.json()) as { lanes: Record<string, LaneSummary> };
  return body.lanes;
}

// The recorded two-lane capture, so the numbers quoted on stage are ones we measured.
export async function fetchBenchmark(): Promise<Benchmark | null> {
  const res = await fetch("/benchmark");
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`benchmark failed: ${res.status}`);
  return res.json();
}

// The policy gate: ask Banyan Sapling whether the vision model's proposed
// disposition is actually allowed. Evidence is the model's own region notes —
// the trace path needs no answer key.
export async function verifyBoard(
  boardId: string,
  result: Inspection,
): Promise<VerifyResult> {
  const res = await fetch(`/verify/board/${boardId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      disposition: result.disposition,
      confidence: result.confidence,
      regions: result.regions,
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`verify failed (${res.status}): ${detail}`);
  }
  return res.json();
}

export interface CorrectionInput {
  boardId: string;
  original: Classification;
  corrected: { defect_type: DefectType; severity: Severity; disposition: Disposition };
  reason: string;
}

// An inspector's corrected label: it joins the adapted lane's instructions, which is
// how Mubit separates one task from another.
export async function sendCorrection(input: CorrectionInput): Promise<Rules> {
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
  return res.json();
}

// Take a rule back out of the adapted task — an appended ledger row, not a delete.
export async function disableCorrection(index: number): Promise<Rules> {
  const res = await fetch(`/corrections/${index}/disable`, { method: "POST" });
  if (!res.ok) throw new Error(`disable failed (${res.status})`);
  return res.json();
}
