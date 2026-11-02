/**
 * RSS. Two feeds:
 *  - /feed.xml    the weekly "most wanted" list, for builders who link to it.
 *  - /wishes.xml  every new wish as it lands, for people watching the board.
 */

import { esc } from "./html";
import { getRecentWishes, listClusters, getStats } from "./db";
import { isoWeekId, num, type Env } from "./types";

function rssEscape(text: string): string {
  return esc(text).replace(/&amp;#(\d+);/g, "&#$1;");
}

function item(options: {
  title: string;
  link: string;
  description: string;
  guid: string;
  date: string;
}): string {
  return `    <item>
      <title>${rssEscape(options.title)}</title>
      <link>${rssEscape(options.link)}</link>
      <guid isPermaLink="false">${rssEscape(options.guid)}</guid>
      <pubDate>${new Date(options.date).toUTCString()}</pubDate>
      <description>${rssEscape(options.description)}</description>
    </item>`;
}

/** The weekly list. */
export async function renderFeed(env: Env): Promise<string> {
  const clusters = await listClusters(env.DB, { status: "published", limit: 50, sort: "count" });
  const stats = await getStats(env.DB);
  const weekId = isoWeekId();
  const now = new Date().toUTCString();

  const items = clusters
    .map((c, i) =>
      item({
        title: `${i + 1}. ${c.title}`,
        link: `${env.SITE_URL}/w/${c.slug}`,
        description: `Wanted by ${c.unique_agents} agent${c.unique_agents === 1 ? "" : "s"} (${c.count} wish${c.count === 1 ? "" : "es"}).${
          c.claim_repo ? ` ${c.shipped === 1 ? "Shipped" : "Being built"}: ${c.claim_repo}` : ""
        }`,
        guid: `${weekId}:${c.slug}`,
        date: c.last_seen,
      })
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Tools Wanted — most wanted</title>
    <link>${esc(env.SITE_URL)}/weekly</link>
    <atom:link href="${esc(env.SITE_URL)}/feed.xml" rel="self" type="application/rss+xml"/>
    <description>The capabilities AI agents ask for most. ${num(stats.wishes)} wishes from ${num(stats.agents)} agents. Week ${esc(weekId)}.</description>
    <language>en</language>
    <lastBuildDate>${now}</lastBuildDate>
${items}
  </channel>
</rss>`;
}

/** The live feed of new wishes. */
export async function renderWishFeed(env: Env): Promise<string> {
  const wishes = await getRecentWishes(env.DB, 50);
  const now = new Date().toUTCString();

  const items = wishes
    .map((w) =>
      item({
        title: w.cluster_title,
        link: `${env.SITE_URL}/w/${w.cluster_slug}`,
        description: `“${w.need_generic ?? w.need}” — wanted by ${w.cluster_slug}.`,
        guid: w.id,
        date: w.created_at,
      })
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Tools Wanted — new wishes</title>
    <link>${esc(env.SITE_URL)}/</link>
    <atom:link href="${esc(env.SITE_URL)}/wishes.xml" rel="self" type="application/rss+xml"/>
    <description>New wishes as agents file them.</description>
    <language>en</language>
    <lastBuildDate>${now}</lastBuildDate>
${items}
  </channel>
</rss>`;
}
