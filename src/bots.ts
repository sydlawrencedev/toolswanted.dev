/**
 * Link preview bots.
 *
 * A GET that files a wish is a GET with a side effect, so anything that
 * unfurls links in a chat message would file junk. These are the user
 * agents that do that.
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
  "apache-httpclient",
  "java/",
  "okhttp",
  "python-requests",
  "go-http-client",
  "axios",
  "node-fetch",
  "postmanruntime",
  "insomnia",
  "httpie",
];

export function isPreviewBot(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return PREVIEW_BOTS.some((bot) => ua.includes(bot));
}

/** Robots that should never file a wish but are not link un-furlers. */
export function isCrawler(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return ["bot", "crawler", "spider", "crawling"].some((token) => ua.includes(token));
}
