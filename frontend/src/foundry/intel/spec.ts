/**
 * Lane 3 — Mubit Netlist Architect (`spec.ts`).
 *
 * Turns a one-line hardware brief ("3-stage RC power filter, 6 pads") into a
 * schema-validated `Netlist` via Mubit (`gpt-4o-mini`), falling back to the
 * curated netlists in `data/foundry/netlists.json` whenever offline, missing
 * a browser key, or if the model output fails validation.
 */

import netlistsData from "../../../../data/foundry/netlists.json";
import type { Netlist, Pad } from "../core/types";

export const MUBIT_BASE_URL = "https://api.mubit.ai/openai/v1";
export const MUBIT_MODEL = "gpt-4o-mini";

export interface NetlistPreset {
  id: string;
  title: string;
  brief: string;
  description: string;
  gridWidth: number;
  gridHeight: number;
  netlist: Netlist;
}

export interface SpecOpts {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  gridWidth?: number;
  gridHeight?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  /** Force offline curated resolution without hitting the network. */
  offline?: boolean;
}

export interface NetlistSpecResult {
  netlist: Netlist;
  source: "mubit" | "curated";
  presetId?: string;
  brief: string;
  model: string;
}

export class NetlistValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NetlistValidationError";
  }
}

export const NETLIST_SYSTEM_PROMPT = `You are a PCB netlist architect for SolderSight Foundry.
Given a one-line circuit brief, output ONLY a valid JSON object matching the Netlist contract on a 16x12 integer grid (0 <= x < 16, 0 <= y < 12):
{
  "pads": [
    { "id": "j1.vin", "x": 2, "y": 2, "net": "VIN" },
    { "id": "r1.1", "x": 7, "y": 3, "net": "VIN" }
  ],
  "nets": [
    ["j1.vin", "r1.1"]
  ]
}
Rules:
1. Every pad must have a unique string "id", integer coordinates "x" and "y" with distinct (x,y) cells, and a non-empty "net" name.
2. Every array in "nets" must list the pad "id"s belonging to one net (at least 2 pads per net).
3. All pad IDs referenced in "nets" must exist in "pads" and share the same pad.net value.`;

function cloneNetlist(netlist: Netlist): Netlist {
  return {
    pads: netlist.pads.map((p) => ({ ...p })),
    nets: netlist.nets.map((n) => [...n]),
  };
}

/** Parse optional markdown code fences around JSON output. */
function parseJsonPayload(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const body = fenced ? fenced[1].trim() : trimmed;
  try {
    return JSON.parse(body);
  } catch (err) {
    throw new NetlistValidationError(
      `Invalid JSON payload: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Strictly validate an arbitrary value against the frozen `Netlist` contract.
 * Accepts either `{ pads, nets }` directly or `{ netlist: { pads, nets } }`.
 */
export function validateNetlist(
  candidate: unknown,
  bounds: { maxW?: number; maxH?: number } = {},
): Netlist {
  const parsed = parseJsonPayload(candidate);
  if (!parsed || typeof parsed !== "object") {
    throw new NetlistValidationError("Netlist must be a JSON object.");
  }

  const root = parsed as Record<string, unknown>;
  const target =
    root.netlist && typeof root.netlist === "object" && !Array.isArray(root.netlist)
      ? (root.netlist as Record<string, unknown>)
      : root;

  if (!Array.isArray(target.pads) || target.pads.length < 2) {
    throw new NetlistValidationError("Netlist.pads must be an array of at least 2 pads.");
  }
  if (!Array.isArray(target.nets) || target.nets.length < 1) {
    throw new NetlistValidationError("Netlist.nets must be a non-empty array of pad-id groups.");
  }

  const maxW = bounds.maxW ?? 64;
  const maxH = bounds.maxH ?? 64;
  const padsById = new Map<string, Pad>();
  const occupiedCells = new Set<string>();
  const pads: Pad[] = [];

  for (let i = 0; i < target.pads.length; i++) {
    const item = target.pads[i];
    if (!item || typeof item !== "object") {
      throw new NetlistValidationError(`Pad at index ${i} must be an object.`);
    }
    const rawPad = item as Record<string, unknown>;
    const id = typeof rawPad.id === "string" ? rawPad.id.trim() : "";
    const net = typeof rawPad.net === "string" ? rawPad.net.trim() : "";
    const x = rawPad.x;
    const y = rawPad.y;

    if (!id) {
      throw new NetlistValidationError(`Pad at index ${i} has an empty or non-string id.`);
    }
    if (!net) {
      throw new NetlistValidationError(`Pad "${id}" has an empty or non-string net.`);
    }
    if (
      typeof x !== "number" ||
      typeof y !== "number" ||
      !Number.isInteger(x) ||
      !Number.isInteger(y) ||
      x < 0 ||
      y < 0 ||
      x >= maxW ||
      y >= maxH
    ) {
      throw new NetlistValidationError(
        `Pad "${id}" has out-of-bounds or non-integer coordinates (${String(x)}, ${String(y)}).`,
      );
    }
    if (padsById.has(id)) {
      throw new NetlistValidationError(`Duplicate pad id "${id}".`);
    }
    const cellKey = `${x},${y}`;
    if (occupiedCells.has(cellKey)) {
      throw new NetlistValidationError(`Duplicate pad coordinates (${x}, ${y}) on pad "${id}".`);
    }

    const validPad: Pad = { id, x, y, net };
    padsById.set(id, validPad);
    occupiedCells.add(cellKey);
    pads.push(validPad);
  }

  const nets: string[][] = [];
  for (let i = 0; i < target.nets.length; i++) {
    const group = target.nets[i];
    if (!Array.isArray(group) || group.length < 2) {
      throw new NetlistValidationError(
        `Net group at index ${i} must be an array of at least 2 pad ids.`,
      );
    }
    const ids: string[] = [];
    const seenInGroup = new Set<string>();
    let expectedNet: string | null = null;

    for (const rawId of group) {
      if (typeof rawId !== "string" || !rawId.trim()) {
        throw new NetlistValidationError(`Net group ${i} contains a non-string pad id.`);
      }
      const padId = rawId.trim();
      const pad = padsById.get(padId);
      if (!pad) {
        throw new NetlistValidationError(
          `Net group ${i} references unknown pad id "${padId}".`,
        );
      }
      if (seenInGroup.has(padId)) {
        throw new NetlistValidationError(
          `Net group ${i} contains duplicate pad id "${padId}".`,
        );
      }
      if (expectedNet === null) {
        expectedNet = pad.net;
      } else if (pad.net !== expectedNet) {
        throw new NetlistValidationError(
          `Net group ${i} mixes pads from different nets ("${expectedNet}" vs "${pad.net}").`,
        );
      }
      seenInGroup.add(padId);
      ids.push(padId);
    }
    nets.push(ids);
  }

  return { pads, nets };
}

export const CURATED_NETLISTS: NetlistPreset[] = netlistsData.presets.map((preset) => ({
  id: preset.id,
  title: preset.title,
  brief: preset.brief,
  description: preset.description,
  gridWidth: preset.gridWidth,
  gridHeight: preset.gridHeight,
  netlist: validateNetlist(preset.netlist, {
    maxW: preset.gridWidth,
    maxH: preset.gridHeight,
  }),
}));

export const DEFAULT_NETLIST_PRESET: NetlistPreset =
  CURATED_NETLISTS.find((p) => p.id === netlistsData.defaultPresetId) ?? CURATED_NETLISTS[0];

export const DEFAULT_NETLIST: Netlist = cloneNetlist(DEFAULT_NETLIST_PRESET.netlist);

/**
 * Match a brief or preset id against `data/foundry/netlists.json`.
 * Always returns a valid preset (defaults to `rc-power-filter`).
 */
export function matchCuratedNetlist(brief: string): NetlistPreset {
  const query = (brief || "").trim().toLowerCase();
  if (!query) return DEFAULT_NETLIST_PRESET;

  const exact = CURATED_NETLISTS.find(
    (p) => p.id.toLowerCase() === query || p.brief.toLowerCase() === query,
  );
  if (exact) return exact;

  const keywordsByPreset: Record<string, string[]> = {
    "rc-power-filter": ["rc", "filter", "3-stage", "power filter", "6 pads", "low-pass"],
    "differential-sensor-bridge": ["differential", "sensor", "bridge", "wheatstone", "amp"],
    "buck-regulator-stage": ["buck", "switching", "regulator", "kelvin", "gate", "sw"],
    "usb-esd-front-end": ["usb", "esd", "tvs", "d+", "d-", "high-speed"],
  };

  let bestPreset = DEFAULT_NETLIST_PRESET;
  let bestHits = 0;
  for (const preset of CURATED_NETLISTS) {
    const terms = keywordsByPreset[preset.id] ?? [preset.title.toLowerCase()];
    const hits = terms.filter((term) => query.includes(term)).length;
    if (hits > bestHits) {
      bestHits = hits;
      bestPreset = preset;
    }
  }
  return bestPreset;
}

function resolveEnvApiKey(): string | undefined {
  try {
    const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    if (metaEnv?.VITE_MUBIT_API_KEY) return metaEnv.VITE_MUBIT_API_KEY;
    if (metaEnv?.MUBIT_API_KEY) return metaEnv.MUBIT_API_KEY;
  } catch {
    // ignore
  }
  const proc = (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process;
  if (proc?.env) {
    return proc.env.VITE_MUBIT_API_KEY || proc.env.MUBIT_API_KEY;
  }
  return undefined;
}

/**
 * Call Mubit (`gpt-4o-mini`) to synthesize a schema-validated `Netlist` from a
 * one-line circuit brief, with automatic fallback to `data/foundry/netlists.json`.
 */
export async function generateNetlistWithMeta(
  brief: string,
  opts: SpecOpts = {},
): Promise<NetlistSpecResult> {
  const fallbackPreset = matchCuratedNetlist(brief);
  const model = opts.model ?? MUBIT_MODEL;
  const apiKey = opts.apiKey ?? resolveEnvApiKey();
  const fetchFn = opts.fetchImpl ?? (typeof fetch !== "undefined" ? fetch : undefined);

  if (opts.offline || !apiKey || !fetchFn) {
    return {
      netlist: cloneNetlist(fallbackPreset.netlist),
      source: "curated",
      presetId: fallbackPreset.id,
      brief: brief.trim() || fallbackPreset.brief,
      model,
    };
  }

  const baseUrl = (opts.baseUrl ?? MUBIT_BASE_URL).replace(/\/$/, "");
  const maxW = opts.gridWidth ?? fallbackPreset.gridWidth ?? 16;
  const maxH = opts.gridHeight ?? fallbackPreset.gridHeight ?? 12;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 12_000);

  try {
    const response = await fetchFn(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: NETLIST_SYSTEM_PROMPT },
          {
            role: "user",
            content: `Circuit brief: "${brief.trim() || fallbackPreset.brief}". Grid bounds: ${maxW}x${maxH}. Return valid Netlist JSON only.`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Mubit HTTP ${response.status}`);
    }

    const body = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = body.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("Empty Mubit response content");
    }

    const validated = validateNetlist(content, { maxW, maxH });
    return {
      netlist: validated,
      source: "mubit",
      brief: brief.trim() || fallbackPreset.brief,
      model,
    };
  } catch {
    return {
      netlist: cloneNetlist(fallbackPreset.netlist),
      source: "curated",
      presetId: fallbackPreset.id,
      brief: brief.trim() || fallbackPreset.brief,
      model,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Primary Lane 3 spec entry point: one-line brief -> validated `Netlist`.
 */
export async function generateNetlist(brief: string, opts: SpecOpts = {}): Promise<Netlist> {
  const res = await generateNetlistWithMeta(brief, opts);
  return res.netlist;
}

export const specFromBrief = generateNetlist;
export const briefToNetlist = generateNetlist;
