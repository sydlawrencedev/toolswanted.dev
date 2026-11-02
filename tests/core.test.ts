import { describe, it, expect } from "vitest";
import { encodeVector, decodeVector, cosine } from "../src/vector";
import { slugify, titleFromNeed } from "../src/slug";
import { isUsefulServer } from "../src/wish";
import { normaliseClient, isoWeekId, weekStart, relativeTime } from "../src/types";

describe("vector encoding", () => {
  it("round trips", () => {
    const values = [0.5, -0.25, 0.125, 0];
    const decoded = decodeVector(encodeVector(values))!;
    expect(decoded.length).toBe(4);
    values.forEach((v, i) => expect(decoded[i]).toBeCloseTo(v, 5));
  });

  it("decodes the legacy json format", () => {
    const decoded = decodeVector("[0.5,0.25]")!;
    expect(decoded[0]).toBeCloseTo(0.5, 5);
    expect(decoded[1]).toBeCloseTo(0.25, 5);
  });

  it("returns null for junk", () => {
    expect(decodeVector(null)).toBeNull();
    expect(decodeVector("")).toBeNull();
    expect(decodeVector("not base64 !!!")).toBeNull();
  });

  it("computes cosine similarity", () => {
    const a = Float32Array.from([1, 0, 0]);
    const b = Float32Array.from([1, 0, 0]);
    const c = Float32Array.from([0, 1, 0]);
    expect(cosine(a, b)).toBeCloseTo(1, 5);
    expect(cosine(a, c)).toBeCloseTo(0, 5);
  });
});

describe("slugify", () => {
  it("makes a url friendly slug", () => {
    expect(slugify("Read UK council planning PDFs as structured data")).toBe(
      "read-uk-council-planning-pdfs-as-structured-data"
    );
  });

  it("drops punctuation and stops words", () => {
    expect(slugify("A tool to read PDFs!")).toBe("tool-read-pdfs");
  });

  it("never returns an empty slug", () => {
    expect(slugify("")).toBe("wish");
    expect(slugify("!!!")).toBe("wish");
  });

  it("truncates long titles", () => {
    const slug = slugify("a".repeat(200));
    expect(slug.length).toBeLessThanOrEqual(64);
  });
});

describe("titleFromNeed", () => {
  it("strips the preamble", () => {
    expect(titleFromNeed("I need a tool to read PDFs")).toBe("read PDFs");
    expect(titleFromNeed("We want a server that converts invoices")).toBe("converts invoices");
  });

  it("leaves a plain need alone", () => {
    expect(titleFromNeed("Read council planning PDFs")).toBe("Read council planning PDFs");
  });

  it("caps the length", () => {
    expect(titleFromNeed("word ".repeat(100)).length).toBeLessThanOrEqual(111);
  });
});

describe("isUsefulServer", () => {
  it("rejects test servers", () => {
    expect(isUsefulServer("ai.smithery/my_test_mcp", "my_test_mcp", "A test server for demos")).toBe(
      false
    );
    expect(isUsefulServer("com/example/demo", "demo", "A demonstration server")).toBe(false);
  });

  it("rejects servers with no description", () => {
    expect(isUsefulServer("io.example/thing", "io.example/thing", "")).toBe(false);
    expect(isUsefulServer("io.example/thing", "io.example/thing", "short")).toBe(false);
  });

  it("accepts a real server", () => {
    expect(
      isUsefulServer(
        "ai.subpay/invoice-reader",
        "Subpay Invoice Reader",
        "Extract structured line items and totals from invoice documents."
      )
    ).toBe(true);
  });
});

describe("client normalisation", () => {
  it("maps known clients", () => {
    expect(normaliseClient("Claude Code")).toBe("claude-code");
    expect(normaliseClient("cursor/1.2.3")).toBe("cursor");
    expect(normaliseClient("Codex")).toBe("codex");
    expect(normaliseClient("something else")).toBe("other");
    expect(normaliseClient(null)).toBe("other");
  });
});

describe("week helpers", () => {
  it("produces an iso week id", () => {
    expect(isoWeekId(new Date("2026-11-02T00:00:00Z"))).toBe("2026-W45");
  });

  it("starts the week on monday", () => {
    const monday = weekStart(new Date("2026-11-05T13:00:00Z"));
    expect(monday.toISOString().slice(0, 10)).toBe("2026-11-02");
    expect(monday.getUTCDay()).toBe(1);
  });
});

describe("relativeTime", () => {
  it("describes recent times", () => {
    const now = Date.parse("2026-11-02T12:00:00Z");
    expect(relativeTime("2026-11-02T11:59:30Z", now)).toBe("just now");
    expect(relativeTime("2026-11-02T11:30:00Z", now)).toBe("30m ago");
    expect(relativeTime("2026-11-01T12:00:00Z", now)).toBe("1d ago");
  });
});
