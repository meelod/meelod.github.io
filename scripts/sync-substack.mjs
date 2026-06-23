#!/usr/bin/env node
// Fetches the latest Substack posts and writes them into writing/index.html
// between the <!-- SUBSTACK:START --> and <!-- SUBSTACK:END --> markers.
// No dependencies — uses Node's built-in fetch (Node 18+).
//
// Substack sits behind Cloudflare and returns 403 to datacenter IPs (e.g.
// GitHub Actions runners), so we try the feed directly first and fall back
// to the rss2json proxy, which fetches from its own (non-blocked) servers.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const FEED_URL = "https://meelod.substack.com/feed";
const PROXY_URL = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(FEED_URL)}`;
const MAX_POSTS = 5;
const MAX_DESC = 140;
const __dirname = dirname(fileURLToPath(import.meta.url));
const PAGE = join(__dirname, "..", "writing", "index.html");

const START = "<!-- SUBSTACK:START -->";
const END = "<!-- SUBSTACK:END -->";

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  "Accept": "application/rss+xml, application/xml, text/xml, */*",
  "Accept-Language": "en-US,en;q=0.9",
};

const stripCdata = (s) => s.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim();
const stripTags = (s) => s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

function decode(s) {
  return s
    .replace(/&#8217;/g, "’").replace(/&#8216;/g, "‘")
    .replace(/&#8220;/g, "“").replace(/&#8221;/g, "”")
    .replace(/&#8230;/g, "…").replace(/&#8212;/g, "—")
    .replace(/&#8211;/g, "–").replace(/&#x27;/g, "’")
    .replace(/&#39;/g, "’").replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, '"');
}

function escape(s) {
  return s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const clean = (s) => escape(decode(stripTags(s)));

function truncate(s) {
  if (s.length <= MAX_DESC) return s;
  return s.slice(0, MAX_DESC).replace(/\s+\S*$/, "") + "…";
}

function formatDate(pubDate) {
  // rss2json returns "YYYY-MM-DD HH:MM:SS" (UTC); RSS returns RFC-822.
  const iso = /^\d{4}-\d{2}-\d{2} /.test(pubDate) ? pubDate.replace(" ", "T") + "Z" : pubDate;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric", timeZone: "UTC",
  });
}

// Substack reuses the publication avatar as the enclosure when a post has no
// cover image. Pull the underlying source-image id so we can tell a real
// per-post cover apart from the avatar and only show genuine covers.
function imageId(url) {
  if (!url) return "";
  const m = url.match(/images%2F([0-9a-f-]+)/i) || url.match(/images\/([0-9a-f-]+)/i);
  return m ? m[1] : "";
}

function coverImage(itemUrl, channelUrl) {
  const id = imageId(itemUrl);
  if (!id || id === imageId(channelUrl)) return ""; // missing or just the avatar
  return itemUrl;
}

function parseXml(xml) {
  const pick = (block, tag) => {
    const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
    return m ? stripCdata(m[1]) : "";
  };
  const chanImg = (xml.match(/<image>([\s\S]*?)<\/image>/) || [, ""])[1].match(/<url>([\s\S]*?)<\/url>/);
  const channelUrl = chanImg ? stripCdata(chanImg[1]) : "";
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => {
    const enc = m[1].match(/<enclosure[^>]*url="([^"]*)"/);
    return {
      title: pick(m[1], "title"),
      link: pick(m[1], "link"),
      description: pick(m[1], "description"),
      date: formatDate(pick(m[1], "pubDate")),
      image: coverImage(enc ? enc[1] : "", channelUrl),
    };
  });
}

function parseJson(json) {
  if (json.status !== "ok" || !Array.isArray(json.items)) return [];
  const channelUrl = (json.feed && json.feed.image) || "";
  return json.items.map((it) => {
    const itemUrl = it.thumbnail || (it.enclosure && it.enclosure.link) || "";
    return {
      title: it.title || "",
      link: it.link || "",
      description: it.description || "",
      date: formatDate(it.pubDate || ""),
      image: coverImage(itemUrl, channelUrl),
    };
  });
}

async function fetchItems() {
  // 1) Try the feed directly (works locally and anywhere not IP-blocked).
  try {
    const res = await fetch(FEED_URL, { headers: BROWSER_HEADERS });
    if (res.ok) {
      const items = parseXml(await res.text());
      if (items.length) {
        console.log("Fetched feed directly.");
        return items;
      }
    } else {
      console.log(`Direct fetch returned HTTP ${res.status}; trying proxy.`);
    }
  } catch (err) {
    console.log(`Direct fetch failed (${err.message}); trying proxy.`);
  }

  // 2) Fall back to the rss2json proxy.
  const res = await fetch(PROXY_URL);
  if (!res.ok) throw new Error(`Proxy fetch failed: HTTP ${res.status}`);
  const items = parseJson(await res.json());
  if (!items.length) throw new Error("Proxy returned no items.");
  console.log("Fetched feed via rss2json proxy.");
  return items;
}

async function main() {
  const items = (await fetchItems())
    .filter((it) => it.title && it.link)
    .slice(0, MAX_POSTS);

  if (items.length === 0) throw new Error("No items parsed — aborting to avoid wiping the list.");

  const lis = items.map((it) => {
    const desc = it.description ? truncate(clean(it.description)) : "";
    const meta = [desc, it.date].filter(Boolean).join(" · ");
    const text = [
      `          <h2><a href="${clean(it.link)}">${clean(it.title)}</a></h2>`,
      meta ? `          <p>${meta}</p>` : "",
    ].filter(Boolean).join("\n");
    if (it.image) {
      return [
        `        <li class="has-thumb">`,
        `          <a class="thumb" href="${clean(it.link)}" aria-hidden="true" tabindex="-1"><img src="${clean(it.image)}" alt="" loading="lazy"></a>`,
        `          <div class="post-text">`,
        text,
        `          </div>`,
        "        </li>",
      ].join("\n");
    }
    return [
      "        <li>",
      text,
      "        </li>",
    ].join("\n");
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
