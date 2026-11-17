# SenseCheck

Internal MYSense tool. Paste one website link and get a single report: what the site is built on, whether we can take it on, what is broken, what works, and what to propose.

## User guide (account servicing)

1. Open SenseCheck and paste the client's link. It checks the homepage and the main pages around it.
2. Wait while it works. A progress bar shows how many pages there are and roughly how long is left, and a "What we know so far" box fills in early results (what the site is built with, the speed scores, the first things noticed on the homepage). Pages are read slowly on purpose so the client's server is not loaded, and the tab has to stay open.
   **Which pages get checked.** Blog posts are left out, because they all share one layout. A section with more than 20 pages (for example a long list of services) gets a sample of 3, and so do pages the homepage does not link to. The result says exactly what was left out and why, under "Which pages we checked, and why". At 200 pages it pauses and asks whether to keep going.
3. Read the result top to bottom: Health Score, what's behind the scores, page speed (mobile and desktop side by side), design, tech stack, strengths, findings, next steps. The wording is deliberately plain and friendly so it can be read out to a client.
   The **Dark mode** switch at the top right changes the look for you only. PDFs always print light.
   The **Design** section groups its advice by area (first impression, fonts and colours, photos, layout, trust, phones). Each item says what we saw, why it matters and what we would do. "Ideas worth pitching" lists things the site does not have yet (video, FAQ, map and so on); these never affect the score. The verdict comes from rules that catch a dated or broken look. Rules cannot judge taste, so have a designer look before pitching a redesign, or use the AI design opinion if it is switched on (see below).
   **How to make it faster** sits under the speed charts when the phone score is below 90. It lists up to five jobs, most useful first, picked from where the weight and the waiting actually go on that page, with what we would do and roughly how much time each could save.
   **Copy summary** gives a short message for WhatsApp or email, in English or Bahasa Malaysia, that you can edit before copying.
   **Compare with a competitor** runs the same check on a competitor's link and puts the two side by side. The comparison is added to both reports.
4. **Client report** is the version to share. **Internal report** adds the "Can we take it?" verdict, versions with confidence levels, our package names and the price guide. Do not send the internal one to clients. Both ask for an optional client name and your name for the cover. The client report can be made in English or Bahasa Malaysia.
   Each report comes in three file types, picked in the same box: **PDF** (opens the print window, choose "Save as PDF"), **PowerPoint** (a slide deck that opens in PowerPoint, Keynote or Google Slides, where every piece can be edited) and **Web page** (one file that opens in any browser, phones included). Your last choice is remembered.
   If Google's speed test fails or only half-loads a site (the styling or pictures don't arrive), SenseCheck tries once more and keeps the better result. If it is still half-loaded, a notice at the top says so, the picture is left out of the client report, and the report carries a short note that the speed scores may be lower than the real ones. Scan again a few minutes later.
   On a phone the menu stays at the top of the screen while you scroll, so you can jump between sections without going back up.
   The mascot in the corner of a report gives the short version of the section you are reading and has a button to the next one. **Hide me** tucks it away; tap the part that still shows to bring it back.
5. **History** lists your own past scans. Once personal logins are live they are saved under your email, so you see the same list on any computer, and nobody else sees yours. Scans are removed automatically after 24 hours. Use **Remove** to delete one sooner. A small copy of the website's screenshots is saved with each scan, so the real site still shows when you reopen it. Scanning the same site again shows the previous Health Score for a before-and-after.
6. Admins get a **Show: Everyone's scans** switch on the History page, with a "Scanned by" column.

"Not detected" and "Not measured" mean the site hides that detail. The tool does not guess.

**When a site cannot be read.** The result opens with a notice naming the exact cause, for example Cloudflare bot protection, a Wordfence or Sucuri block, an expired SSL certificate, a suspended hosting account or a domain that does not resolve, with what to do next. Speed scores still appear, because Google runs that test itself.

**How the tech stack is found.** The homepage code is read first, then every other page in the scan, then the list of files Google's test saw load, then DNS records, robots.txt and the usual login addresses. The Tech stack card lists what was checked under "How we checked". If the platform still cannot be identified, the card says why.

**The intro.** A short SenseCheck intro plays the first time the tool is opened in a browser session. Click anywhere or press any key to skip it. It does not play again until the browser is closed and reopened, and it is skipped for people whose device is set to reduce motion. Add `?intro` to the address to see it again.

## Admin guide (rules, Skills Matrix, packages)

Everything editable lives in `public/config.json`. Edit it on GitHub and the change deploys itself. No code changes needed.

| Key | What it controls |
|---|---|
| `skills` | The Skills Matrix. Each platform, builder or plugin is `expert`, `support` or `none`. Names must match what the Tech stack card shows. Anything not listed gives "Take with caution". |
| `packages` | The service package name shown beside each recommendation. |
| `prices` | An indicative starting price per package, for example `"revamp": "from RM 6,000"`. Shown beside the package name on screen and in the internal PDF only, never in the client PDF. Leave a price empty to show nothing. |
| `historyHours` | How long a scan stays in History before it is removed automatically (default 24). Once personal logins are live, also set the Worker var `HISTORY_HOURS` to the same number. |
| `placeholders` | Phrases treated as placeholder text (not case-sensitive). |
| `thresholds` | `imageKB` oversized-image limit, `thinWords` for near-empty pages, `domainExpiryDays` warning window. |
| `crawl` | `maxPages` safety limit where a scan pauses and asks before going on (default 200), `sectionLimit` how many pages a section may have before it is only sampled (default 20), `sectionSample` how many pages of a big section are checked (default 3), `delayMs` pause between requests, `maxImageChecks`, `maxPluginChecks` (set to 0 to stop reading plugin readme files). |

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

## AI design opinion (optional, off until a key is added)

The rule-based design checks cannot judge taste. With a Claude API key, a button appears in the Design section: "Ask AI about the design". It sends the screenshots Google took (desktop first screen and the phone page) to Claude and shows a short designer-style opinion, with a line to open the conversation with the client. It only runs when someone presses the button, and each press costs roughly 30 sen (about 6 US cents). The opinion is saved with the scan and printed in the internal PDF only.

To switch it on: create an API key at console.anthropic.com (this is billed separately from a Claude chat subscription), then in Cloudflare open Workers & Pages, sensecheck, Settings, Variables and Secrets, and add a **Secret** named `ANTHROPIC_API_KEY`. Remove the secret to switch it off again. Optional variable `AI_MODEL` picks another Claude model (default `claude-opus-5-5`; `claude-sonnet-5-5` costs about half). If a safety filter declines a request, the API is allowed to pass it to another Claude model instead of failing.

## Where the extra facts come from

- **Known security holes**: the public WPVulnerability database (wpvulnerability.net, free, no key), looked up for WordPress, Elementor and each plugin whose version could be read and is behind. The same hole is often listed by several sources, so only distinct CVE numbers are counted and the wording is "at least N".
- **Security certificate expiry**: public certificate logs through certspotter.com (free, no key). It flags a certificate that is unusually close to its end date.
- **Elementor starter colours**: the site's own Elementor kit file is read to see whether the site-wide colours were ever changed.
- **Bahasa Malaysia wording** lives in `public/bm.js`. When a line in `audit.js` or `analyze.js` is reworded, update its twin there. A line with no Malay twin simply stays in English.

## Look, logo and mascot

- The look (warm light surfaces, light sidebar, black pill buttons, one dark score card, pastel tiles) is the block at the end of `public/app.css` headed "Look, round two". Colours are the variables at the top of that block, with a matching set for dark mode.
- The sidebar is the block headed "Sidebar, round three" at the end of `public/app.css`: a purple menu attached to the left wall with curved joins (the small `::before` / `::after` pieces draw the curves), sticky so it follows the page, and it marks the section in view (`spy()` in `app.js`). The account piece at the bottom has the same curve and does not move.
- The mascot cutouts are made by `_design/cutout2.py` from the sheet in `_design/raw/` (both stay on this computer, not in the repository): `python3 _design/cutout2.py <sheet> <out folder> 3 3 wave,point,inspect,underline,thumbs,clipboard,run,shrug,coffee 600 webp`.
- The logo is the mascot's face in a round purple badge: `public/img/logo.png` (256 px) and `public/img/logo-64.png` (the browser tab icon, the report header and the slide footer). To change it, replace those two files; nothing is drawn inline any more. Five other marks from the same sheet are kept in `_design/logo2/`.
- The mascot is a little inspector in a purple cap with a tick badge, drawn in the 1930s rubber-hose cartoon style in the MYSense colours. The poses are `public/img/mascot/*.webp`: wave, point, inspect, underline, thumbs, clipboard, run, shrug, coffee. `mascot(pose, size)` in `app.js` places one. He stands the same height in every pose, so sizes go by height (`--tall` in "Round six" of `app.css`). In dark mode a thin light edge keeps his dark outline visible. The marker line in the underline pose is measured, and the numbers sit beside `.short-head` in "Round six": change the picture and they must be measured again.
- The login screen may only show `mysense-light.png`, `mysense-dark.png`, `logo.png`, `logo-64.png` and `mascot/wave.webp` without a passcode. Everything else stays locked.
- "Round four" at the end of `public/app.css` holds the later additions: the file-type picker, the tech icons, the menu that stays at the top on phones, the float-in of the cards (`rise` keyframes, started by `floatIn()` in `app.js`; skipped for people who ask their device for less motion) and the mascot's reactions (the corner helper is `drawBuddy()` / `buddyLine()` in `app.js`).

- "Round five" in `public/app.css` together with `public/motion.js` is the iPhone-style motion: one set of spring curves (`--spring`, `--spring-snappy`, `--spring-bouncy`, `--spring-pop`, worked out by `_design/tools/springs.py`), controls that shrink a little when pressed, dialogs that open as sheets (from the bottom edge on phones, where they can be dragged down and the page behind steps back), a menu highlight and selector thumbs that slide, a title bar that turns to frosted glass once the page scrolls, a message pill at the top, a dark mode switch, a health score that counts up and chart bars that grow. The app works the same with `motion.js` taken out, and all of it switches off for people who ask their device for less motion.

## How it is put together

- `public/` is the app (plain HTML, CSS and JS, no build step).
  - `analyze.js`: tech stack detection and PageSpeed parsing.
  - `audit.js`: page checks, issues and severities, Health Score, strengths, skills fit, next steps.
  - `app.js`: scan flow, crawl, interface, charts, the competitor comparison, the copy summary, the report layout (PDF and web page) and the corner helper.
  - `motion.js`: the iPhone-style movement (springs, sheets, sliding highlights). Only adds movement; nothing depends on it.
  - `slides.js`: the report as a PowerPoint deck. It is only loaded when someone picks PowerPoint, together with `vendor/pptxgen.bundle.js` (PptxGenJS 4.0.1, MIT licence, unchanged from the npm package).
  - `techicons.js`: the brand icons shown in the tech stack. The shapes are from Simple Icons 16.30.0 (CC0). To add one, copy its path into `ICONS` and add a line to `RULES`. Names without an icon get a tile with their first letter.
  - `bm.js`: Bahasa Malaysia wording for the client report and the copy summary.
  - `config.json`: the admin-editable rules above.
- `src/worker.js` is the Cloudflare Worker. It serves `public/` and the API routes: `/api/fetch` (reads a public page), `/api/psi` (Google PageSpeed Insights) and `/api/design-review` (the optional AI design opinion).
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

Shareable report links and an admin screen for editing the rules in the browser.

## Yearly upkeep

- `PHP_MIN` in `analyze.js`: the oldest PHP branch that still gets security fixes.
