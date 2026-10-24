import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CorrectionForm } from "./CorrectionForm";
import type { Classification } from "../types";

const original: Classification = {
  defect_type: "open",
  severity: "major",
  disposition: "scrap",
  confidence: 0.6,
  reason: "Looks broken.",
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("CorrectionForm", () => {
  it("posts the corrected labels to /corrections and confirms", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<CorrectionForm boardId="00041000" original={original} />);
    fireEvent.change(screen.getByLabelText("Defect type"), { target: { value: "spur" } });
    fireEvent.click(screen.getByRole("button", { name: "Save correction" }));

    await waitFor(() => expect(screen.getByText(/Saved to Mubit memory/)).toBeInTheDocument());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/corrections");
    const body = JSON.parse(init.body as string);
    expect(body.board_id).toBe("00041000");
    expect(body.corrected.defect_type).toBe("spur");
    expect(body.original.defect_type).toBe("open");
    vi.unstubAllGlobals();
  });

  it("shows an error when the save fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 502 })));
    render(<CorrectionForm boardId="x" original={original} />);
    fireEvent.click(screen.getByRole("button", { name: "Save correction" }));
    await waitFor(() => expect(screen.getByText(/Could not save/)).toBeInTheDocument());
    vi.unstubAllGlobals();
  });
});
