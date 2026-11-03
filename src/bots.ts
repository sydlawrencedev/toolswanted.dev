/**
 * Link preview bots.
 *
 * A GET that files a wish is a GET with a side effect, so anything that
 * unfurls links in a chat message would file junk. These are the user
 * agents that do that.
 *
 * The list is a DENY list of link un-furlers and crawlers, and nothing
 * else. It used to also contain HTTP client libraries, `python-requests`,
 * `axios`, `node-fetch`, `okhttp`, `apache-httpclient`, `go-http-client`
 * and `java/`, which are not un-furlers at all. They are what an agent
 * uses to call the API, and they were silently getting a 200 with no wish
 * filed, on one of the four documented ways to wire the board up.
 */

const PREVIEW_BOTS = [
  "slackbot",
  "slack-imgproxy",
  "slack-linkpreview",
  "discordbot",
  "discord-exabot",
  "twitterbot",
  "facebookexternalhit",
  "facebookcatalog",
  "telegrambot",
  "whatsapp",
  "skypeuripreview",
  "embedly",
  "quora link preview",
  "redditbot",
  "linkedinbot",
  "pinterest",
  "tumblr",
  "vkshare",
  "w3c_validator",
  "googleimageproxy",
  "nuzzel",
  "outbrain",
  "viber",
  "xing-contenttabreceiver",
  "applebot",
  "petalbot",
  "google-inspectiontool",
  "chrome-lighthouse",
  "pagespeed",
  "gtmetrix",
  "ahrefsbot",
  "semrushbot",
  "mj12bot",
  "dotbot",
  "blexbot",
  "yandex",
  "baiduspider",
  "duckduckgo-favicons-bot",
  "feedfetcher",
  "feedburner",
  "feedly",
];

export function isPreviewBot(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return PREVIEW_BOTS.some((bot) => ua.includes(bot));
}

/**
 * Robots that should never file a wish but are not link un-furlers.
 *
 * A crawler is identified by the word, not by a fixed list, because the
 * list of crawlers changes weekly and the word does not. The one
 * exception is a client library, which calls itself a bot in its user
 * agent and is not one: `python-requests` says "requests", not "bot".
 */
const NOT_A_CRAWLER = [
  "python-requests",
  "axios",
  "node-fetch",
  "go-http-client",
  "okhttp",
  "apache-httpclient",
  "java/",
  "postmanruntime",
  "insomnia",
  "httpie",
  "curl",
  "wget",
];

export function isCrawler(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  if (NOT_A_CRAWLER.some((lib) => ua.includes(lib))) return false;
  return ["bot", "crawler", "spider", "crawling"].some((token) => ua.includes(token));
}
