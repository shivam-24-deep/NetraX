# Mobile Ingestion

How suspicious content gets from a phone into a real NetraX investigation —
what's actually built, what it requires, and what it honestly doesn't do yet.

## 1. What's implemented

| Capability | Status |
| --- | --- |
| Web fallback ("Send to NetraX" page: paste, drag-drop, upload) | **Real**, works over plain HTTP |
| Deterministic input classification (EMAIL/URL/MESSAGE/TRANSACTION/UNKNOWN) | **Real** — `frontend/src/lib/ingest/classify.ts` |
| Real EMAIL investigation from shared/pasted content | **Real** — reuses the existing agentic pipeline end-to-end |
| Android Web Share Target (Gmail/Chrome "Share → NetraX") | **Real**, but requires HTTPS (see §3) |
| Auto-submit on share arrival (no manual "paste then click") | **Real** |
| QR code linking phone → this machine | **Real**, auto-detects your LAN IP |
| iOS native Share Extension | **Not built** — needs Xcode/macOS, unavailable in this dev environment. See §5. |
| Real (non-mock) URL-only, message-only, transaction-only investigation | **Not built** — classified honestly, routed to "open Investigate" rather than faked |

Nothing here claims a capability that doesn't exist. If a screen says something
isn't available, it isn't — check this table before assuming otherwise.

## 2. How it works

```
Phone (Gmail/Chrome) --Share--> NetraX PWA (installed)
        |
        v  Web Share Target API, GET /send?title=&text=&url=
frontend/src/pages/send.tsx
        |  classifyInput() — deterministic, no LLM
        v
frontend/src/lib/ingest/ingest-service.ts
        |  EMAIL only:
        |    sha256Hex(content) -> findCaseByEmailHash() [idempotency]
        |    -> runEmailInvestigation() [same real pipeline Investigate uses]
        |    -> addCase()
        v
localStorage case store -> /cases/:id (case detail, PDF, evidence ZIP)
```

There is exactly one investigation pipeline and one case store in this app.
Mobile ingestion does not duplicate `runEmailInvestigation`,
`findCaseByEmailHash`, or the case model — it calls the same functions
`frontend/src/pages/investigate.tsx` already used for paste/upload.

## 3. Android setup (Web Share Target — real, requires HTTPS)

Android only offers an **installed** PWA in the Share sheet, and an installed
PWA is only installable from a browser that considers the origin **secure**.
Chrome treats `http://localhost` as secure but **not** a plain LAN IP like
`http://192.168.x.x` — so during local dev, the "Send to NetraX" *page* works
fine over your LAN IP (paste/upload/drag-drop all work), but the phone will
never be offered an "Install app" prompt, and Share Target will not register,
over plain HTTP.

**Local dev, with real Share-sheet testing (recommended path):**

```bash
# In a separate terminal, with the frontend dev server already running:
npx ngrok http 5173
```

`vite.config.ts` already allowlists `*.ngrok-free.app` / `*.ngrok.io` /
`*.ngrok.app` as dev-server hosts. Open the `https://...ngrok-free.app` URL
ngrok prints — on your phone, on that same HTTPS origin:

1. Chrome menu → **Install app** (or **Add to Home Screen**).
2. Open the installed NetraX app once (registers the service worker —
   `public/sw.js`).
3. Open Gmail (or any app), open a suspicious email, tap **Share**.
4. **NetraX** now appears in the share sheet.
5. Tap it — NetraX opens directly to a live investigation, no copy/paste.

**Local dev, without a tunnel:** open `http://<your-LAN-IP>:5173/send`
(the QR code on the Send page generates this automatically) directly in the
phone's browser and paste/upload manually. This always works, with no HTTPS
requirement, because there's no install/service-worker step involved.

**Production:** once deployed behind real HTTPS (see `docs/DEPLOYMENT.md`),
none of the tunnel steps above are needed — the deployed origin is already
secure and Share Target works the same way out of the box.

### Required manifest fields (already in `frontend/public/manifest.webmanifest`)

```json
{
  "share_target": {
    "action": "/send",
    "method": "GET",
    "params": { "title": "title", "text": "text", "url": "url" }
  }
}
```

This is a **GET** share target — it covers shared text and URLs (the primary
"share an email/link" scenario) without needing a service worker to intercept
a POST body. File-sharing via Share Target (`method: "POST"`,
`enctype: "multipart/form-data"`) is not implemented — Android's file-share
flow instead falls back to opening the file's app chooser; sharing a `.eml`
attachment specifically isn't a common share-sheet action on Android today,
and the web fallback's file-upload button (§1) already covers `.eml` upload.

### MIME types honestly supported

The manifest's `share_target` only declares `text/plain` reception (via the
`text`/`url` params) — this is standard for a GET share target and covers
pasted/shared email bodies and links. `frontend/src/lib/ingest/classify.ts`
then classifies whatever text arrives; it does not branch on MIME type from
Android for share-target arrivals (Android doesn't pass one through GET
params). The web fallback's upload button separately accepts
`.eml`, `.msg`, `.txt`, `.html`, `.json` by file extension
(`frontend/src/pages/send.tsx`).

## 4. Required permissions

None beyond what any installed PWA needs (no camera/contacts/storage
permission prompts) — Web Share Target does not require a manifest
permission grant the way a native Android app's `AndroidManifest.xml` would.

## 5. iOS

**Not implemented, and not fakeable from this environment.** A real iOS Share
Extension is a native app target built and signed in Xcode, running on
macOS — this dev environment has neither. Building one anyway (e.g. claiming
support without ever compiling/testing it) would produce exactly the kind of
fabricated capability this project's own design principles (see
`docs/LIMITATIONS.md`) explicitly reject.

What iOS gets today, honestly:

- The same web fallback page (`/send`) works in Safari — paste, upload, and
  drag-drop all function identically to Android's browser fallback.
- iOS Safari does **not** support the Web Share Target API for *receiving*
  shares (as of this writing) — so even the installed-PWA route Android gets
  isn't available on iOS. A phone-to-NetraX "Share" button inside Safari's
  share sheet is out of reach without native code.
- The QR code on the Send page works identically on iOS — scan, open Safari,
  paste/upload.

**If a real iOS Share Extension is wanted later**, the architecture would be:
a small Share Extension target (Swift, `NSExtensionActivationRule` for
`public.email-message` / `public.url` / `public.plain-text`) that reads the
`NSItemProvider`, computes SHA-256, and either (a) opens `netrax://` with the
payload for the (also not-yet-built) native/Capacitor host app to pick up, or
(b) POSTs directly to a deployed ingestion API. Neither (a) nor (b) is built.

## 6. API flow

There is no separate "mobile ingest" backend endpoint. `send.tsx` calls the
exact same client-side pipeline `investigate.tsx` does
(`frontend/src/lib/ingest/ingest-service.ts` →
`frontend/src/lib/mock/engine.ts`'s `runEmailInvestigation`, which POSTs to
`server/local-api.ts`'s `/investigate-email`). See `README.md` §6 and
`docs/AGENT_ARCHITECTURE.md` for that pipeline's real internals. The one
addition for mobile support is `GET /network-info` on `server/local-api.ts`,
which returns this machine's LAN IPv4 address (via Node's
`os.networkInterfaces()`) purely so the Send page's QR code can point a phone
at a reachable address instead of `localhost`. It returns no sensitive data.

## 7. Authentication

Unchanged from the rest of the app: Supabase Auth, bypassed locally by
`VITE_SKIP_AUTH=true` in `frontend/.env` (see `README.md` §6). `/send` sits
behind the same `<ProtectedRoute>` every other case-bearing page uses — a
real deployment would require sign-in before a share-target arrival could
create a case, exactly like any other page here.

## 8. Environment variables

No new ones. `VITE_LOCAL_API_URL` (default `/local-api`, proxied by Vite dev
server to `server/local-api.ts`) is reused for both the investigation calls
and the new `/network-info` lookup.

## 9. Local development

```bash
cd frontend && npm install
npm run dev                 # binds all interfaces (vite.config.ts: server.host = true)
node ../server/local-api.ts # in a separate terminal, from the repo root
```

Open `http://localhost:5173/send` on this machine, or scan the QR code shown
there from a phone on the same Wi-Fi (works over plain HTTP for paste/upload;
see §3 for the HTTPS tunnel needed for real Share-sheet testing).

## 10. Testing

- Unit tests: `frontend/src/lib/ingest/__tests__/classify.test.ts` (Vitest,
  10 cases covering EMAIL/URL/MESSAGE/TRANSACTION/UNKNOWN classification).
- Manual/browser verification performed during development (Playwright,
  against the real local backend, not mocked): paste → real investigation →
  real case detail page with real findings; bare URL → honest "not yet
  automated" message; zero console errors in either path.
- No automated end-to-end test drives an actual Android Share Target
  invocation — that requires a real device or emulator with Chrome and an
  installed PWA, which this environment cannot run. `classify.test.ts` and
  the ingestion-service logic it feeds are what's automated; the OS-level
  share handoff itself needs manual verification on a real phone (§3).

## 11. Production build

`npm run build` (from `frontend/`) — no mobile-specific build step. The
manifest, icons, and service worker are static files under `frontend/public/`
and ship as-is with the normal Vite build output.

## 12. Deep links

`/send?title=&text=&url=` is the only deep-link shape currently handled
(matches the Web Share Target GET params exactly, and doubles as a plain
"prefill" link for testing without a real OS share). A `netrax://` custom
scheme is **not implemented** — there is no native/Capacitor shell yet to
register it; see §5 for where that would live if built.

## 13. Security model

- No new attack surface beyond the existing investigation pipeline: shared
  content goes through the same `parseEmail`/`analyzeForensics`/etc. path as
  pasted content, with the same "never execute attachments, never fetch
  arbitrary remote URLs" guarantees documented in `docs/SECURITY.md`.
- `GET /network-info` only ever returns this machine's own LAN IP — nothing
  request-scoped, nothing secret, and it's only meaningful on `localhost`
  anyway (a real deployment's frontend never calls it, see §6).
- `/send` requires the same auth as every other case-bearing route (§7).
- Evidence integrity: every case created via `/send` gets the same SHA-256
  hash and evidence-package treatment as any other case — see
  `EvidenceIntegrityCard` and `frontend/src/lib/zip/generate-package.ts`.
