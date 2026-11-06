/**
 * Render the Open Graph images.
 *
 * Why this runs outside the Worker: the free Workers plan gives 10ms of CPU
 * per request and rasterising a 1200x630 PNG takes far longer than that. So
 * we render locally and push the finished PNGs into KV through the Worker.
 *
 *   npm run og:sync
 */

import { readFile } from "node:fs/promises";
import { Resvg } from "@resvg/resvg-js";
import satori from "satori";
import { createElement as h } from "react";
import { requireAdminToken } from "./admin-token.mjs";
import { OG_COPY_VERSION } from "../src/og-version.mjs";

const SITE = process.env.SITE_URL ?? "https://toolswanted.dev";
const WORKER = process.env.WORKER_URL ?? SITE;

const PAPER = "#f3eee1";
const PAPER_2 = "#fffdf7";
const INK = "#151210";
const INK_SOFT = "#6b635a";
const RED = "#d32a1c";

interface Cluster {
  slug: string;
  title: string;
  agents: number;
  wishes: number;
  clients?: Array<{ client: string; count: number }>;
}

async function fonts() {
  const [display, body, bodyBold] = await Promise.all([
    readFile("assets/fonts/ArchivoBlack-Regular.ttf"),
    readFile("assets/fonts/Lato-Regular.ttf"),
    readFile("assets/fonts/Lato-Bold.ttf"),
  ]);
  return [
    { name: "Archivo Black", data: display, weight: 400 as const, style: "normal" as const },
    { name: "Lato", data: body, weight: 400 as const, style: "normal" as const },
    { name: "Lato", data: bodyBold, weight: 700 as const, style: "normal" as const },
  ];
}

/** Split a title into lines that fit the poster. */
function wrap(title: string, maxChars: number, maxLines: number): string[] {
  const words = title.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
      if (lines.length === maxLines) break;
    } else {
      current = candidate;
    }
  }
  if (lines.length < maxLines && current) lines.push(current);
  if (lines.length === maxLines) {
    const last = lines[maxLines - 1]!;
    if (last.length > maxChars) lines[maxLines - 1] = `${last.slice(0, maxChars - 1).trimEnd()}…`;
  }
  return lines;
}

async function renderPoster(cluster: Cluster | null, fontData: Awaited<ReturnType<typeof fonts>>) {
  const isDefault = !cluster;
  const title = isDefault ? "What agents got stuck on" : cluster!.title;
  const count = isDefault ? 0 : cluster!.agents;
  const lines = wrap(title, 24, 4);
  const slug = isDefault ? "" : cluster!.slug;

  const element = h(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: PAPER,
        fontFamily: "Lato",
        position: "relative",
      },
    },
    // Header bar
    h(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: INK,
          color: PAPER,
          padding: "18px 34px",
          fontSize: 22,
          letterSpacing: 3,
          fontFamily: "Archivo Black",
        },
      },
      // The bar said "TOOLS WANTED" on the left and "WANTED" in red on
      // the right, so the word appeared twice in one bar. The right-hand
      // item now carries the domain, which is information rather than
      // another copy of the name.
      h("div", { style: { display: "flex" } }, "TOOLS WANTED"),
      h("div", { style: { display: "flex", color: RED } }, "TOOLSWANTED.DEV")
    ),
    // Body
    h(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "34px 34px 20px",
          flexGrow: 1,
          gap: 30,
        },
      },
      h(
        "div",
        { style: { display: "flex", flexDirection: "column", maxWidth: 720 } },
        ...lines.map((line) =>
          h(
            "div",
            {
              style: {
                fontFamily: "Archivo Black",
                fontSize: line.length > 20 ? 56 : 66,
                lineHeight: 1.05,
                letterSpacing: -1,
                color: INK,
                display: "flex",
              },
            },
            line
          )
        )
      ),
      h(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            border: `5px solid ${INK}`,
            background: PAPER_2,
            padding: "26px 34px 22px",
            minWidth: 240,
          },
        },
        h(
          "div",
          {
            style: {
              fontFamily: "Archivo Black",
              fontSize: 88,
              color: RED,
              lineHeight: 1.15,
              display: "flex",
              letterSpacing: -3,
            },
          },
          // The default card used to show a red middle dot where the
          // count goes. On a cream panel a red horizontal bar reads as
          // a redaction rather than as a count of nothing. It now says
          // what it is, in the same face, at a size that fits.
          isDefault ? "0" : String(count)
        ),
        h(
          "div",
          {
            style: {
              fontFamily: "Archivo Black",
              fontSize: 20,
              color: INK,
              letterSpacing: 2,
              display: "flex",
              marginTop: 6,
            },
          },
          isDefault ? "NOT YET" : count === 1 ? "AGENT" : "AGENTS"
        )
      )
    ),
    // Footer
    h(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderTop: `5px solid ${INK}`,
          padding: "16px 34px",
          fontSize: 20,
          color: INK_SOFT,
        },
      },
      h(
        "div",
        { style: { display: "flex", color: INK, fontFamily: "Archivo Black", fontSize: 22 } },
        slug ? `toolswanted.dev/w/${slug}` : "toolswanted.dev"
      ),
      h(
        "div",
        { style: { display: "flex", letterSpacing: 1 } },
        isDefault ? "a public board of the capabilities agents got stuck on" : "wished for by AI agents"
      )
    )
  );

  const svg = await satori(element as never, {
    width: 1200,
    height: 630,
    fonts: fontData,
  });
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 1200 } });
  return resvg.render().asPng();
}

async function main() {
  // The token first, and a preflight against the admin API before
  // anything is rendered.
  //
  // Rasterising a 1200x630 PNG for every published cluster takes a
  // while, and the upload happens at the end. Without the preflight, a
  // wrong token means paying the whole render cost and then finding
  // out, which is the slowest way to learn that a token is wrong.
  const ADMIN_TOKEN = await requireAdminToken();

  const preflight = await fetch(`${WORKER}/admin/og`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-admin-token": ADMIN_TOKEN,
    },
    body: JSON.stringify({ images: [], copyVersion: OG_COPY_VERSION }),
  });
  if (preflight.status === 401 || preflight.status === 403) {
    console.error(
      `The admin token was rejected (${preflight.status}).\n` +
        `Check ADMIN_TOKEN, or the token in /tmp/admin_token.`
    );
    process.exit(1);
  }
  if (preflight.status === 409) {
    console.error(
      `The deployed Worker expects a different poster version than this script\n` +
        `renders. Deploy the current code first, then run this again.\n` +
        `${await preflight.text()}`
    );
    process.exit(1);
  }

  const fontData = await fonts();

  // Pull the published clusters straight from the deployed API.
  const res = await fetch(`${WORKER}/api/top?limit=100`);
  if (!res.ok) {
    console.error(`Could not reach ${WORKER}/api/top (${res.status}). Deploy first?`);
    process.exit(1);
  }
  const json = (await res.json()) as { wishes: Cluster[] };
  const clusters = json.wishes ?? [];

  const images: Array<{ slug: string; png: string }> = [];

  const defaultPng = await renderPoster(null, fontData);
  images.push({ slug: "default", png: Buffer.from(defaultPng).toString("base64") });

  for (const cluster of clusters) {
    const png = await renderPoster(cluster, fontData);
    images.push({ slug: cluster.slug, png: Buffer.from(png).toString("base64") });
    process.stdout.write(".");
  }
  process.stdout.write("\n");

  console.log(`Uploading ${images.length} images to ${WORKER}/admin/og ...`);
  const upload = await fetch(`${WORKER}/admin/og`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-admin-token": ADMIN_TOKEN,
    },
    body: JSON.stringify({ images, copyVersion: OG_COPY_VERSION }),
  });
  if (!upload.ok) {
    console.error(`Upload failed: ${upload.status} ${await upload.text()}`);
    process.exit(1);
  }
  console.log(await upload.text());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

export {};
