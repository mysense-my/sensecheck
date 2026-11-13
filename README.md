# SenseCheck

Internal MYSense tool. Paste one website link and get a single report: what the site is built on, whether we can take it on, what is broken, what works, and what to propose.

## User guide (account servicing)

1. Open SenseCheck and paste the client's link. Pick how many pages to check (default 20).
2. Wait about a minute. Pages are read slowly on purpose so the client's server is not loaded.
3. Read the result top to bottom: Health Score, page speed (mobile and desktop side by side), design, tech stack, strengths, findings, next steps.
   The **Design** verdict comes from rules that catch a dated or broken look (old layout code, sliders, low contrast, no call to action and so on). It cannot judge taste, so have a designer look before pitching a redesign.
4. **Client PDF** is the version to share. **Internal PDF** adds the "Can we take it?" verdict, versions with confidence levels, and our package names. Do not send the internal one to clients.
5. **History** lists your own past scans. Once personal logins are live they are saved under your email, so you see the same list on any computer, and nobody else sees yours. Use **Remove** to delete one. Scanning the same site again shows the previous Health Score for a before-and-after.
6. Admins get a **Show: Everyone's scans** switch on the History page, with a "Scanned by" column.

"Not detected" and "Not measured" mean the site hides that detail. The tool does not guess.

**When a site cannot be read.** The result opens with a notice naming the exact cause, for example Cloudflare bot protection, a Wordfence or Sucuri block, an expired SSL certificate, a suspended hosting account or a domain that does not resolve, with what to do next. Speed scores still appear, because Google runs that test itself.

**How the tech stack is found.** The homepage code is read first, then every other page in the scan, then the list of files Google's test saw load, then DNS records, robots.txt and the usual login addresses. The Tech stack card lists what was checked under "How we checked". If the platform still cannot be identified, the card says why.

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

## Personal logins (built, not live yet)

Each colleague signs in with their own work email through Cloudflare Access, and their scans are saved under that email in a Cloudflare D1 database. The code is in place and switches on by itself when the settings below exist. Until then the passcode in the next section applies.

| Setting on the Worker | What it is |
|---|---|
| var `ACCESS_TEAM` | Your Zero Trust team name (the part before `.cloudflareaccess.com`). |
| var `ACCESS_AUD` | The Application Audience (AUD) tag of the Access application. |
| var `ADMIN_EMAILS` | Comma-separated emails that can see and remove everyone's scans. |
| D1 binding `DB` | The database that holds saved scans (`schema.sql` creates the table). |

Who can sign in is decided by the Access policy in Cloudflare, not by this code. Allow your company email domain. Never allow a public mail domain such as gmail.com.

### Go-live checklist

1. Sign up for **Zero Trust Free** in Cloudflare (needs a team name, may ask for a card on file).
2. Worker `sensecheck` > **Access**: turn on Access for the production address, with a policy allowing emails ending in your company domain. Copy the AUD tag.
3. Create a D1 database named `sensecheck`, run `schema.sql` in its console, and add it to `wrangler.jsonc` as `"d1_databases": [{ "binding": "DB", "database_name": "sensecheck", "database_id": "<id>" }]`.
4. Add the vars `ACCESS_TEAM`, `ACCESS_AUD` and `ADMIN_EMAILS` to the Worker.
5. Merge the `logins-dashboards` branch into `main` and push. Cloudflare deploys it.
6. Sign in, run a scan, check it appears under History on a second browser, and remove it.
7. Once that works, delete the `PASSCODE` secret. It is only the fallback.

## Passcode (who can open the tool until logins are live)

The whole tool sits behind one shared team passcode, stored as the secret `PASSCODE` on the Worker.

- **Set or change it:** Cloudflare > Workers & Pages > `sensecheck` > Settings > Variables and Secrets > add or edit the secret `PASSCODE`, then deploy. Use at least 12 characters.
- **Until it is set, the site is locked for everyone.** That is deliberate.
- A browser stays unlocked for 30 days. Changing the passcode signs everyone out. Visiting `/logout` locks one browser.
- The passcode is shared, so change it when someone leaves the team. For per-person logins, move to Cloudflare Access (needs a Zero Trust plan).

## How it is put together

- `public/` is the app (plain HTML, CSS and JS, no build step).
  - `analyze.js`: tech stack detection and PageSpeed parsing.
  - `audit.js`: page checks, issues and severities, Health Score, strengths, skills fit, next steps.
  - `app.js`: scan flow, crawl, interface, chart and both PDF layouts.
  - `config.json`: the admin-editable rules above.
- `src/worker.js` is the Cloudflare Worker. It serves `public/` and two API routes: `/api/fetch` (reads a public page) and `/api/psi` (Google PageSpeed Insights).
- `schema.sql` creates the saved-scans table.
- `dev.py` is a local stand-in for the Worker, for machines without Node.

Only public pages are read. The tool never logs in, respects robots.txt, and stops at the page limit.

## Run locally

    PSI_KEY=your-google-key python3 dev.py 8788

Then open http://127.0.0.1:8788. The local stand-in has no passcode and no real login: a "Local preview, signed in as" switch in the sidebar lets you pretend to be one of three colleagues (one is admin), and scans are kept in `.local/scans.json`. That switch does not exist on the real Worker. Without `PSI_KEY` the speed test hits Google's shared quota and fails; everything else still works.

## Deploy (Cloudflare Workers)

1. Push this folder to a GitHub repository.
2. In Cloudflare: Workers & Pages > Create > import the repository. Deploy command: `npx wrangler deploy`.
3. Add two secrets: `PASSCODE` (the team passcode) and `PSI_KEY` (a Google API key with the PageSpeed Insights API enabled).

## Not built yet (from the brief)

SSL certificate issuer and expiry, known-vulnerability lookups (WPScan API), shareable report links, a side-by-side compare of two scans, and an admin screen for editing the rules in the browser.

## Yearly upkeep

- `PHP_MIN` in `analyze.js`: the oldest PHP branch that still gets security fixes.
