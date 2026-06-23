#!/usr/bin/env node
// Fetches the latest Substack posts and writes them into writing/index.html
// between the <!-- SUBSTACK:START --> and <!-- SUBSTACK:END --> markers.
// No dependencies — uses Node's built-in fetch (Node 18+).

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const FEED_URL = "https://meelod.substack.com/feed";
const MAX_POSTS = 5;
const __dirname = dirname(fileURLToPath(import.meta.url));
const PAGE = join(__dirname, "..", "writing", "index.html");

const START = "<!-- SUBSTACK:START -->";
const END = "<!-- SUBSTACK:END -->";

const stripCdata = (s) => s.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim();

function pick(block, tag) {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  return m ? stripCdata(m[1]) : "";
}

// Decode the handful of entities Substack emits in titles/descriptions,
// then re-escape for safe HTML insertion.
function decode(s) {
  return s
    .replace(/&#8217;/g, "’").replace(/&#8216;/g, "‘")
    .replace(/&#8220;/g, "“").replace(/&#8221;/g, "”")
    .replace(/&#8230;/g, "…").replace(/&#8212;/g, "—")
    .replace(/&#8211;/g, "–").replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
}

function escape(s) {
  return s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const clean = (s) => escape(decode(s));

function formatDate(pubDate) {
  const d = new Date(pubDate);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric", timeZone: "UTC",
  });
}

async function main() {
  const res = await fetch(FEED_URL, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      "Accept": "application/rss+xml, application/xml, text/xml, */*",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  if (!res.ok) throw new Error(`Feed fetch failed: HTTP ${res.status}`);
  const xml = await res.text();

  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
    .map((m) => m[1])
    .slice(0, MAX_POSTS)
    .map((block) => ({
      title: pick(block, "title"),
      link: pick(block, "link"),
      description: pick(block, "description"),
      date: formatDate(pick(block, "pubDate")),
    }))
    .filter((it) => it.title && it.link);

  if (items.length === 0) throw new Error("No items parsed from feed — aborting to avoid wiping the list.");

  const lis = items.map((it) => {
    const meta = [it.description && clean(it.description), it.date]
      .filter(Boolean)
      .join(" · ");
    return [
      "        <li>",
      `          <h2><a href="${clean(it.link)}">${clean(it.title)}</a></h2>`,
      meta ? `          <p>${meta}</p>` : "",
      "        </li>",
    ].filter(Boolean).join("\n");
  }).join("\n");

  const list = `      <ul class="favorites">\n${lis}\n      </ul>`;

  const html = await readFile(PAGE, "utf8");
  const startIdx = html.indexOf(START);
  const endIdx = html.indexOf(END);
  if (startIdx === -1 || endIdx === -1) throw new Error("Markers not found in writing/index.html");

  const before = html.slice(0, startIdx + START.length);
  const after = html.slice(endIdx);
  const updated = `${before}\n${list}\n      ${after}`;

  if (updated === html) {
    console.log("No changes.");
    return;
  }
  await writeFile(PAGE, updated);
  console.log(`Wrote ${items.length} post(s) to writing/index.html`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
