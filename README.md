# UNBOXD — Cloud Product Tracker (Cloudflare Pages + KV/R2 Free Tier)

## Architecture Highlights
1. **Local-First Speed (IndexedDB)**: Every product photo, quick-snap price, or edit saves locally in `<5ms` via `IndexedDB` (lifting the old 5MB `localStorage` limit so you can store hundreds of compressed photos on your phone).
2. **Instant Camera + Price Mode (`⚡ Snap + Price`)**: Opens the rear phone camera immediately, shows only a large **Price (₹)** input box, and saves in 1 tap (or *Save & Snap Next* for rapid sourcing).
3. **Extended Edit via Pen Icon (`✎`)**: Every product card has a dedicated pen icon button that opens the full form (Cost, Profit/Margin calculator, Category, MOQ, Supplier, Supplier Phone, Stock, Status, Notes) and supports PC paste (`Ctrl+V`) or gallery uploads.
4. **Non-Blocking Async Background Sync**: Changes queue locally and sync asynchronously in the background (`requestIdleCallback` + `online` listener) to `/api/sync`.

## Deploy to Cloudflare Pages (Free Hosting, No External DB)
1. **Create a Free KV Namespace**:
   - In your Cloudflare Dashboard, go to **Storage & Databases → KV** and click **Create a namespace** named `UNBOXD_STORE`.
2. **Deploy the Site**:
   - Go to **Workers & Pages → Create → Pages** and upload this folder (or push to GitHub/GitLab and connect the repo, or run `npx wrangler pages deploy .`).
3. **Bind Storage to the Static Site**:
   - Inside your Cloudflare Pages project, go to **Settings → Functions → KV namespace bindings**.
   - Add binding: Variable name = `UNBOXD_STORE`, and select your KV namespace.
   - *(Optional)* Alternatively, bind a free R2 Bucket as `UNBOXD_BUCKET`.
   - *(Optional)* Add an environment variable `SYNC_SECRET` if you want passkey protection across your PC and phone.
