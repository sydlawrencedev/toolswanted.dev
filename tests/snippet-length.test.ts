import { describe, it, expect } from "vitest";

import { SNIPPET_ASK_AGENT } from "../src/snippet";

/**
 * The install snippet has to fit a chat window.
 *
 * `SNIPPET_ASK_AGENT` is the thing a person pastes into a chat with an
 * agent to ask for the board to be installed. It was 653 characters.
 *
 * That is not a snippet any more. It is a paragraph, and a paragraph
 * pasted into a chat window is a request the reader has to wade
 * through before the agent acts on it. The job of this snippet is one
 * request: install the board, and keep the identity that makes the
 * count right.
 *
 * So the target is under 250 characters. That is the number the fix
 * has to hit, and these tests hold it there.
 *
 * What must survive the cut is not optional:
 *
 * The MCP URL, because the agent has to know where the server is.
 *
 * The header, because the board counts independent agents and the
 * header is how it tells one installation from several. A snippet
 * without it sends a request the board cannot attribute, and the count
 * it produces is a guess.
 *
 * And the tool name, because the agent has to know what to call.
 */

describe("the install snippet", () => {
  it("fits in a chat window", () => {
    // The failure this catches: the snippet is 653 characters, which
    // is a paragraph to paste into a chat rather than a request.
    expect(SNIPPET_ASK_AGENT.length).toBeLessThan(250);
  });

  it("is long enough to still be a sentence", () => {
    // The other side of the same rule. A snippet cut to nothing is not
    // a fix, it is a deletion, and the agent would have nothing to
    // act on.
    expect(SNIPPET_ASK_AGENT.length).toBeGreaterThan(80);
  });

  it("carries the MCP endpoint", () => {
    // Without the URL the agent has nowhere to install from.
    expect(SNIPPET_ASK_AGENT).toContain("toolswanted.dev/mcp");
  });

  it("carries the header instruction", () => {
    // The board counts independent agents, and the header is how it
    // tells one installation from several. Cut it and the count the
    // agent's wish produces is a guess.
    expect(SNIPPET_ASK_AGENT).toContain("x-tools-wanted-agent");
  });

  it("says what to call", () => {
    // The agent has to know the tool exists and what it is called.
    expect(SNIPPET_ASK_AGENT).toMatch(/wish\(|wish\(\)/);
  });

  it("still says the install needs no account and no key", () => {
    // The reason a person asks an agent to install it rather than
    // doing it themselves. It is the whole pitch in two clauses.
    expect(SNIPPET_ASK_AGENT).toMatch(/no account/i);
    expect(SNIPPET_ASK_AGENT).toMatch(/no api key/i);
  });

  it("does not carry a paragraph of explanation with it", () => {
    // A guard on the shape, not just the length. The failure mode is
    // a snippet that grows back one sentence at a time, each one
    // reasonable, and the length check catches it only once it has
    // already grown.
    const sentences = SNIPPET_ASK_AGENT.split(/[.!?]+\s/).filter((s) => s.trim().length > 0);
    expect(sentences.length).toBeLessThanOrEqual(4);
  });
});
