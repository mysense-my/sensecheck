# SenseCheck

Internal MYSense tool. Paste one website link and get a single report: what the site is built on, whether we can take it on, what is broken, what works, and what to propose.

## User guide (account servicing)

1. Open SenseCheck and paste the client's link. Pick how many pages to check (default 20).
2. Wait about a minute. Pages are read slowly on purpose so the client's server is not loaded.
3. Read the result top to bottom: Health Score, page speed, tech stack, strengths, findings, next steps.
4. **Client PDF** is the version to share. **Internal PDF** adds the "Can we take it?" verdict, versions with confidence levels, and our package names. Do not send the internal one to clients.
5. History keeps past scans in the browser you used. Scanning the same site again shows the previous Health Score for a before-and-after.

"Not detected" and "Not measured" mean the site hides that detail. The tool does not guess.

## Admin guide (rules, Skills Matrix, packages)

Everything editable lives in `public/config.json`. Edit it on GitHub and the change deploys itself. No code changes needed.

| Key | What it controls |
|---|---|
| `skills` | The Skills Matrix. Each platform, builder or plugin is `expert`, `support` or `none`. Names must match what the Tech stack card shows. Anything not listed gives "Take with caution". |
| `packages` | The service package name shown beside each recommendation. |
| `placeholders` | Phrases treated as placeholder text (not case-sensitive). |
| `thresholds` | `imageKB` oversized-image limit, `thinWords` for near-empty pages, `domainExpiryDays` warning window. |
| `crawl` | `maxPages` default page limit, `delayMs` pause between requests, `maxImageChecks`, `maxPluginChecks` (set to 0 to stop reading plugin readme files). |

Verdict logic: any `none` item gives **Not a fit**; any `support` or unlisted item gives **Take with caution**; all `expert` gives **Can take**.

## How it is put together

- `public/` is the app (plain HTML, CSS and JS, no build step).
  - `analyze.js`: tech stack detection and PageSpeed parsing.
  - `audit.js`: page checks, issues and severities, Health Score, strengths, skills fit, next steps.
  - `app.js`: scan flow, crawl, interface, chart and both PDF layouts.
  - `config.json`: the admin-editable rules above.
- `src/worker.js` is the Cloudflare Worker. It serves `public/` and two API routes: `/api/fetch` (reads a public page) and `/api/psi` (Google PageSpeed Insights).
- `dev.py` is a local stand-in for the Worker, for machines without Node.

Only public pages are read. The tool never logs in, respects robots.txt, and stops at the page limit.

## Run locally

    PSI_KEY=your-google-key python3 dev.py 8788

Then open http://127.0.0.1:8788. Without `PSI_KEY` the speed test hits Google's shared quota and fails; everything else still works.

## Deploy (Cloudflare Workers)

1. Push this folder to a GitHub repository.
2. In Cloudflare: Workers & Pages > Create > import the repository. Deploy command: `npx wrangler deploy`.
3. Add the secret `PSI_KEY` (a Google API key with the PageSpeed Insights API enabled).
4. Put Cloudflare Access in front of the hostname so only the team can open it.

## Not built yet (from the brief)

SSL certificate issuer and expiry, known-vulnerability lookups (WPScan API), shareable report links, team-wide history per client, user roles and an admin screen. The last four need a Cloudflare database.

## Yearly upkeep

- `PHP_MIN` in `analyze.js`: the oldest PHP branch that still gets security fixes.
