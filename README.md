Link to my personal website: https://meelodwaheed.com

Styling conventions:

- Use the shared `.entries` list for projects, features, and future text collections.
- Keep entry titles and descriptions at the inherited body size, with regular-weight titles and gray descriptions.
- Keep spacing and separators in the shared stylesheet; avoid page-specific list variants.
- Preserve the existing serif font, gray palette, and responsive text sizes.
- Use the shared gallery and inherited gray text for photography captions; name the venue or city without publishing GPS coordinates.

Photographs are exported without EXIF metadata. City names were checked locally against [GeoNames](https://www.geonames.org/) data; source exports and location metadata stay outside this repository.

Curations uses one shared image-tile style for collection covers and photos. Edit `curations/collections.json`, then run `node scripts/build-curations.mjs` to rebuild the collection pages and sitemap. Each collection has its own URL, and photos open in a keyboard-accessible viewer. Keep thumbnails at 480px, larger viewer images at 960px, and load larger images only when opened.
