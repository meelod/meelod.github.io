import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const base = "https://meelodwaheed.com";
const collections = JSON.parse(await readFile(`${root}curations/collections.json`, "utf8"));
const version = async (path) => createHash("sha256").update(await readFile(root + path)).digest("hex").slice(0, 12);
const cssVersion = await version("assets/css/style.css");
const jsVersion = await version("assets/js/gallery.js");
const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const json = (value) => JSON.stringify(value, null, 2).replace(/</g, "\\u003c");

function page({ title, description, path, data, content, viewer = false }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escape(title)}</title>
  <meta name="description" content="${escape(description)}">
  <link rel="canonical" href="${base}${path}">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escape(title)}">
  <meta property="og:description" content="${escape(description)}">
  <meta property="og:url" content="${base}${path}">
  <meta property="og:site_name" content="Meelod Waheed">
  <meta property="og:locale" content="en_US">
  <meta property="og:image" content="${base}/og.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="Meelod Waheed — Forward deployed engineer">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escape(title)}">
  <meta name="twitter:description" content="${escape(description)}">
  <meta name="twitter:image" content="${base}/og.png">
  <meta name="twitter:image:alt" content="Meelod Waheed — Forward deployed engineer">
  <link rel="stylesheet" href="/assets/css/style.css?v=${cssVersion}">
  <script type="application/ld+json">${json(data)}</script>
${viewer ? `  <script src="/assets/js/gallery.js?v=${jsVersion}" defer></script>` : ""}
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <div class="wrap">
    <header>
      <a class="name" href="/">Meelod Waheed</a>
      <nav aria-label="Primary">
        <a href="/projects/">Projects</a>
        <a class="active" href="/curations/" aria-current="page">Curations</a>
        <a href="/features/">Features</a>
      </nav>
    </header>
    <main id="main">
${content}
    </main>
  </div>
${viewer ? `  <dialog class="photo-viewer" aria-labelledby="viewer-title">
    <div class="viewer-header">
      <p class="viewer-title" id="viewer-title"></p>
      <button type="button" data-close aria-label="Close image viewer">Close ×</button>
    </div>
    <img class="viewer-image" alt="">
    <p class="viewer-caption"></p>
    <div class="viewer-controls">
      <button type="button" data-previous aria-label="Previous image">← Previous</button>
      <p class="viewer-position" aria-live="polite"></p>
      <button type="button" data-next aria-label="Next image">Next →</button>
    </div>
  </dialog>` : ""}
</body>
</html>
`;
}

const cards = collections.map((collection, index) => {
  const cover = collection.items.find((item) => item.id === collection.cover) ?? collection.items[0];
  return `        <li>
          <a href="/curations/${collection.slug}/">
            <img src="${cover.thumb}" alt="${escape(cover.alt)}" width="480" height="${Math.round(cover.height * 480 / cover.width)}" loading="${index < 3 ? "eager" : "lazy"}" decoding="async">
            <h2 class="tile-title">${escape(collection.title)}</h2>
            <p class="tile-meta">${collection.items.length} ${collection.unit}</p>
          </a>
        </li>`;
}).join("\n");

await writeFile(`${root}curations/index.html`, page({
  title: "Curations — Meelod Waheed",
  description: "Art by Meelod Waheed, plus collections of art pieces, architecture, interiors, and landscapes with location captions.",
  path: "/curations/",
  data: {
    "@context": "https://schema.org", "@type": "CollectionPage", name: "Curations — Meelod Waheed", url: `${base}/curations/`,
    isPartOf: { "@id": `${base}/#website` }, about: { "@id": `${base}/#person` },
    mainEntity: { "@type": "ItemList", itemListElement: collections.map((collection, index) => ({ "@type": "ListItem", position: index + 1, name: collection.title, url: `${base}/curations/${collection.slug}/` })) },
  },
  content: `      <h1 class="page-title">Curations</h1>
      <p class="intro">Art I've made and things I've seen.</p>
      <ul class="image-grid">
${cards}
      </ul>`,
}));

for (const collection of collections) {
  const figures = collection.items.map((item) => `        <li>
          <figure>
            <a href="${item.src}" data-gallery data-title="${escape(item.title)}" aria-label="View ${escape(item.title)}">
              <img src="${item.thumb}" alt="${escape(item.alt)}" width="480" height="${Math.round(item.height * 480 / item.width)}" loading="lazy" decoding="async">
            </a>
            <figcaption>${escape(item.caption)}${item.note ? ` <span class="photo-note">${escape(item.note)}</span>` : ""}</figcaption>
          </figure>
        </li>`).join("\n");
  const path = `/curations/${collection.slug}/`;
  const data = {
    "@context": "https://schema.org", "@type": "ImageGallery", name: `${collection.title} — Meelod Waheed`, url: base + path,
    description: collection.description, isPartOf: { "@id": `${base}/#website` }, about: { "@id": `${base}/#person` },
    associatedMedia: collection.items.map((item) => ({
      "@type": "ImageObject", name: item.title, contentUrl: base + item.src, thumbnailUrl: base + item.thumb,
      description: item.alt, caption: [item.caption, item.note].filter(Boolean).join(" "), width: item.width, height: item.height, creator: { "@id": `${base}/#person` },
      ...(item.place ? { contentLocation: { "@type": "Place", name: item.place } } : {}),
    })),
  };
  await mkdir(`${root}curations/${collection.slug}`, { recursive: true });
  await writeFile(`${root}curations/${collection.slug}/index.html`, page({
    title: `${collection.title} — Meelod Waheed`, description: collection.description, path, data, viewer: true,
    content: `      <p class="back-link"><a href="/curations/">← Curations</a></p>
      <h1 class="page-title">${escape(collection.title)}</h1>
      <p class="intro">${escape(collection.description)}</p>
      <ul class="image-grid">
${figures}
      </ul>`,
  }));
}

for (const path of ["index.html", "projects/index.html", "features/index.html", "writing/index.html", "404.html"]) {
  const content = await readFile(root + path, "utf8");
  await writeFile(root + path, content.replace(/href="\/assets\/css\/style\.css(?:\?v=[^"]*)?"/g, `href="/assets/css/style.css?v=${cssVersion}"`));
}

const routes = ["/", "/projects/", "/features/", "/curations/", ...collections.map((collection) => `/curations/${collection.slug}/`)];
await writeFile(`${root}sitemap.xml`, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes.map((path) => `  <url><loc>${base}${path}</loc></url>`).join("\n")}\n</urlset>\n`);
console.log(`Built ${collections.length} collections with ${collections.reduce((sum, collection) => sum + collection.items.length, 0)} images.`);
