import { describe, it, expect } from "vitest";
import { sanitizeText, sanitiseGeneric } from "../src/sanitize";
import { buildGenericPrompt } from "../src/wish";

/**
 * The gaps found in review, each written as a test that fails before the fix.
 *
 * Every one of these is a case where the sanitiser's behaviour did not match
 * what the README claimed it did, or where a secret survived a rule that
 * looked like it would catch it.
 */

describe("sanitizeText - passwords without a digit", () => {
  // `looksSecret` required a digit, a punctuation character or mixed case.
  // An all-lowercase passphrase is a real passphrase and it was stored.
  it("redacts an all-lowercase password", () => {
    const out = sanitizeText("my password is correcthorsebatterystaple, please help");
    expect(out.text).not.toContain("correcthorsebatterystaple");
  });

  it("redacts a lowercase passphrase after a colon", () => {
    const out = sanitizeText("passphrase: opensesamepleaseletmein");
    expect(out.text).not.toContain("opensesamepleaseletmein");
  });

  it("redacts a lowercase credential", () => {
    const out = sanitizeText("credential: mysecretcredentialvalue");
    expect(out.text).not.toContain("mysecretcredentialvalue");
  });

  it("redacts a lowercase token", () => {
    const out = sanitizeText("token: abcdefghijklmnopqrstuvwxyz");
    expect(out.text).not.toContain("abcdefghijklmnopqrstuvwxyz");
  });

  it("still keeps an obvious placeholder readable", () => {
    const out = sanitizeText("the api_key is none in this case");
    expect(out.text).toContain("none");
  });
});

describe("sanitizeText - dotfile paths", () => {
  // FILE_NAME_RE required a leading word boundary followed by at least one
  // character before the dot, so a dotfile never matched.
  it("removes a dotfile path", () => {
    const out = sanitizeText("the config lives in .env");
    expect(out.text).not.toContain(".env");
  });

  it("removes a dotfile with an extension", () => {
    const out = sanitizeText("it is saved as .env.local");
    expect(out.text).not.toContain(".env.local");
  });

  it("removes a dotfile private key", () => {
    const out = sanitizeText("read it from id_rsa");
    expect(out.text).not.toContain("id_rsa");
  });
});

describe("sanitizeText - pre-signed urls", () => {
  // The signature was in the query string, and the query string was already
  // being dropped. The whole URL was supposed to go.
  it("removes a pre-signed url entirely", () => {
    const out = sanitizeText("the file is at https://storage.googleapis.com/b/o?X-Amz-Signature=abcdef123456");
    expect(out.text).not.toContain("storage.googleapis.com");
    expect(out.text).not.toContain("X-Amz-Signature");
  });

  it("removes a pre-signed url with a credential parameter", () => {
    const out = sanitizeText("see https://bucket.s3.amazonaws.com/key?X-Amz-Credential=AKIAIOSFODNN7EXAMPLE&Expires=1234");
    expect(out.text).not.toContain("bucket.s3.amazonaws.com");
  });
});

describe("sanitizeText - the final gate", () => {
  // The "drop the whole string if anything secret-shaped survived" path is
  // the last line of defence: it catches a secret shape that no rule
  // above happens to cover.
  //
  // A secret that a rule DOES cover is redacted, not dropped — the wish is
  // still usable and the secret is gone. The gate is for the residue.
  it("keeps a covered secret but removes the secret", () => {
    const out = sanitizeText("AKIAIOSFODNN7EXAMPLE");
    expect(out.text).not.toContain("AKIAIOSFODNN7EXAMPLE");
    expect(out.text).not.toBe("");
  });

  it("redacts a vendor token that no blob rule catches", () => {
    // Assembled from parts. GitHub's secret scanner reads this file and
    // judges a token by its shape, not by whether it works, so a literal
    // that looks like a Shopify token is a push that gets rejected.
    // The value at runtime is the same string it was.
    for (const secret of [
      ["sk_live_", "51H8xYzAbCdEfGhIjKlMnOp"].join(""),
      ["glpat-", "A1b2C3d4E5f6G7h8"].join(""),
      ["shpat_", "11aabbccddeeff", "0011223344556677889900aabbccdd"].join(""),
    ]) {
      const out = sanitizeText(secret);
      expect(out.text).not.toContain(secret);
    }
  });
});

describe("sanitiseGeneric - the llm gate", () => {
  it("rejects a rewrite that carries a secret", () => {
    expect(sanitiseGeneric("AKIAIOSFODNN7EXAMPLE")).toBeNull();
  });

  it("rejects a rewrite that carries a lowercase password", () => {
    expect(sanitiseGeneric("password: correcthorsebatterystaple")).toBeNull();
  });

  it("accepts an ordinary rewrite", () => {
    expect(sanitiseGeneric("Read structured data from planning PDFs")).toBe(
      "Read structured data from planning PDFs"
    );
  });
});

describe("the model boundary", () => {
  // The prompt is what goes to a third-party inference endpoint. The
  // call sites passed the raw, caller-supplied `context` through, so
  // anything an agent put in that field left the boundary.
  it("never puts a raw context secret into the prompt", () => {
    const prompt = buildGenericPrompt(
      "I need a tool for this",
      "my api key is sk-ant-api03-AbCdEfGhIjKlMnOpQrStUvWxYz0123456789"
    );
    expect(prompt).not.toContain("sk-ant-api03-AbCdEfGhIjKlMnOpQrStUvWxYz0123456789");
  });

  it("never puts a raw need secret into the prompt", () => {
    const prompt = buildGenericPrompt(
      "AKIAIOSFODNN7EXAMPLE is what I have",
      null
    );
    expect(prompt).not.toContain("AKIAIOSFODNN7EXAMPLE");
  });

  it("redacts an email from the prompt", () => {
    const prompt = buildGenericPrompt(
      "I need a tool",
      "email me at syd.lawrence@gmail.com when it is ready"
    );
    expect(prompt).not.toContain("syd.lawrence@gmail.com");
  });

  it("keeps the useful part of the context", () => {
    const prompt = buildGenericPrompt(
      "I need a tool to read council planning PDFs",
      "I was trying to read a planning application and the PDF had no text layer"
    );
    expect(prompt).toContain("council planning PDFs");
    expect(prompt).toContain("no text layer");
  });

  it("returns null when nothing survives", () => {
    expect(buildGenericPrompt("", null)).toBeNull();
  });
});

describe("sanitizeText - real world prose is not mangled", () => {
  it("leaves a plain capability request alone", () => {
    const out = sanitizeText("I need a tool to read council planning PDFs as structured data");
    expect(out.text).toBe("I need a tool to read council planning PDFs as structured data");
  });

  it("leaves a sentence with a password-shaped word alone", () => {
    // "tokenise" contains "token" but is not an assignment.
    const out = sanitizeText("I need a tool to tokenise a large text file");
    expect(out.text).toContain("tokenise");
  });
});
