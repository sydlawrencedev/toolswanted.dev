import { describe, it, expect } from "vitest";
import { isPreviewBot, isCrawler } from "../src/bots";

/**
 * The GET endpoint files a wish, so the user-agent check decides who gets
 * to file one. It used to treat HTTP client libraries as link un-furlers,
 * which silently blocked the most common way an agent calls an API.
 */

describe("isPreviewBot", () => {
  it("blocks a link un-furler", () => {
    expect(isPreviewBot("Slackbot-LinkExpanding 1.0")).toBe(true);
    expect(isPreviewBot("facebookexternalhit/1.1")).toBe(true);
    expect(isPreviewBot("Twitterbot/1.0")).toBe(true);
    expect(isPreviewBot("WhatsApp/2.0")).toBe(true);
  });

  it("allows an agent's http client", () => {
    // These are what an agent uses to call the API. Blocking them meant
    // one of the four documented ways to wire the board up did nothing.
    expect(isPreviewBot("python-requests/2.31.0")).toBe(false);
    expect(isPreviewBot("axios/1.6.0")).toBe(false);
    expect(isPreviewBot("node-fetch/3.3.2")).toBe(false);
    expect(isPreviewBot("Go-http-client/1.1")).toBe(false);
    expect(isPreviewBot("okhttp/4.9.3")).toBe(false);
    expect(isPreviewBot("Apache-HttpClient/4.5.13")).toBe(false);
    expect(isPreviewBot("Java/17.0.1")).toBe(false);
    expect(isPreviewBot("PostmanRuntime/7.36.0")).toBe(false);
    expect(isPreviewBot("curl/8.4.0")).toBe(false);
  });

  it("allows an agent's own user agent", () => {
    expect(isPreviewBot("claude-code/1.0")).toBe(false);
    expect(isPreviewBot("cursor/0.42")).toBe(false);
    expect(isPreviewBot("codex/1.0")).toBe(false);
  });

  it("allows a browser", () => {
    expect(
      isPreviewBot(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
      )
    ).toBe(false);
  });

  it("allows no user agent at all", () => {
    expect(isPreviewBot(null)).toBe(false);
    expect(isPreviewBot("")).toBe(false);
    expect(isPreviewBot(undefined)).toBe(false);
  });
});

describe("isCrawler", () => {
  it("catches a crawler", () => {
    expect(isCrawler("Googlebot/2.1")).toBe(true);
    expect(isCrawler("some-crawler/1.0")).toBe(true);
    expect(isCrawler("Bingbot/2.0")).toBe(true);
    expect(isCrawler("spider")).toBe(true);
  });

  it("does not mistake a client library for a crawler", () => {
    // Some client libraries put "bot" in their user agent. They are not
    // crawlers and they do file wishes.
    expect(isCrawler("python-requests/2.31.0")).toBe(false);
    expect(isCrawler("curl/8.4.0")).toBe(false);
    expect(isCrawler("node-fetch/3.3.2")).toBe(false);
    expect(isCrawler("apache-httpclient/4.5.13")).toBe(false);
  });

  it("allows an agent", () => {
    expect(isCrawler("claude-code/1.0")).toBe(false);
    expect(isCrawler(null)).toBe(false);
  });
});
