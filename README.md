# Holiday Wish Book

Kid-friendly browser for Amazon’s 2026 Holiday Kids Gift Book. Kids pick toys; parents export a gift list to Excel or CSV.

**Stack:** Vite 6 + vanilla JavaScript (ES modules) + CSS. Client-side only. Catalog JSON in `public/`. Excel/CSV export via the `xlsx` package. Picks stored in `localStorage`.

## Local

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually `http://127.0.0.1:5173`).

## Build & free hosting (GitHub Pages)

```bash
npm install
npm run build
```

Upload the `dist/` folder, or enable GitHub Pages from Actions / the `dist` output. For project pages (repo not at domain root), set Vite `base` in `vite.config.js` to `'/your-repo-name/'` before building.

Catalog: `public/catalog.json` (581 toys parsed from the Toy Book PDF). Prices are not printed in the book — export leaves price as “Check Amazon.”
