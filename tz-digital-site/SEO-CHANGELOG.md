# SEO / GBP Changelog — branch `seo-gbp-de`

Scope: maximize organic SEO and Google Business Profile (GBP) support for **tz-digital.de**
(the Essen/German-market site). Everything below was done autonomously; "Open questions" at
the bottom lists what needs a human decision.

Before touching anything, per your instructions, I verified this was the correct repo:
`pwd` → `.../AJ Digital/tz-digital DE`, `git remote -v` → `TZ-Digital-DE.git`, and the site's
own content confirmed it (`<html lang="de">`, title mentioning "Essen", canonical
`https://tz-digital.de/`). I also reviewed `master` before starting — it already had prior SEO
work (Google Search Console verification, service-area schema, orphan-page fixes, mobile
portfolio-swipe support, the NFC/Shopify landing pages) — and built on top of that rather than
assuming a blank slate.

This is the sibling of the tz-digital-nl work done on the `seo-gbp-nl` branch of the NL repo —
several findings here mirror what was found there, since both sites share the same underlying
templates and, as it turns out, the same legal business entity (see §2).

---

## 1. Site structure at the start

Monolingual German site, 5 real content pages + 2 legal pages, no build tooling
(no `package.json` — pure static HTML/CSS/JS):

- `index.html` (homepage)
- `ki-agentur-essen.html`, `nfc-bewertungstags-essen.html`, `shopify-store-essen.html`,
  `website-friseursalon-essen.html` (service landing pages)
- `impressum.html`, `datenschutz.html` (noindex legal pages)

## 2. NAP data confirmed (same entity as the NL sibling)

`impressum.html`/`datenschutz.html` document the real, legally filed business address:

```
TZ Digital — Inhaber: Albert Zapke
Am Ruhrstein 56, 45133 Essen, Deutschland
E-Mail: albertjnr.zapke@t-online.de
Telefon: +49 1517 2507603
Rechtsform: Einzelunternehmen
```

Unlike the NL site (where this same address is ~250km from that site's actual Maastricht
target market — flagged there as an open question), **here it's completely natural**: Essen is
this site's own home market. I used it directly as the `PostalAddress` in the homepage schema
with no caveats needed.

## 3. Meta tags

- `index.html` title was 67 chars → trimmed to 58 ("TZ Digital | Website-Design & SEO für
  Unternehmen in Essen")
- `website-friseursalon-essen.html` title was 63 chars → trimmed to 60
- Every other title/description was already within the 50–60/140–160 char targets — verified
  with a scripted length check before and after
- No duplicate titles/descriptions found

## 4. Headings

All 7 pages already had exactly one `<h1>` with logical heading nesting. No changes needed.

## 5. Structured data (JSON-LD)

- **Homepage**: added a full `PostalAddress` (the real Essen NAP above) to the
  `ProfessionalService` schema, and gave it a stable `@id`
  (`https://tz-digital.de/#business`).
- **All 4 service subpages**: added `BreadcrumbList` JSON-LD (none existed before —
  two-level, Home → Service, matching this site's flatter structure vs. the NL site's
  three-level salon-niche pages).
- **All 4 service subpages**: changed `Service.provider` from an inline duplicate
  `ProfessionalService` object to a single `"@id": "https://tz-digital.de/#business"`
  reference, avoiding 5 near-duplicate business entities across the site.
- Did **not** add `logo`, `sameAs`, `priceRange`, or `openingHours` — none exist anywhere in
  the repo. See Open Questions.
- Did **not** add `Review`/`AggregateRating` schema — no testimonials or reviews exist
  anywhere on the site to mark up honestly, and fabricating them would violate Google's
  structured-data guidelines and risk a manual action. `GBP-CONTENT-DE.md` includes
  review-response templates for once real GBP reviews start coming in.
- Verified every JSON-LD block on every page parses as valid JSON (scripted check, 0 errors,
  before and after).

## 6. hreflang — closed the loop left open by the NL branch

The NL site's `seo-gbp-nl` branch already added `hreflang="de"` on both its homepages
pointing here, but this site had nothing pointing back (only self-referencing `hreflang="de"`
+ `x-default`). Added:

```html
<link rel="alternate" hreflang="nl" href="https://tz-digital.nl/nl/">
```

to `index.html` only — same reasoning as the NL side: this site and tz-digital.nl serve
genuinely different markets with different service pages, so pairing every subpage 1:1 would
be semantically wrong. The homepage is the one place both sites truly represent "the same
business." `x-default` was left self-referencing (`https://tz-digital.de/`) rather than
copied from the NL site's choice (`https://tz-digital.nl/`) — see Open Questions #4 for why
that's a judgment call worth flagging rather than just mirroring silently.

## 7. Images

- Added explicit `width`/`height` to the 6 meaningful homepage images (3 portfolio
  screenshots, 3 team photos) — same asset files as the NL site, same real intrinsic pixel
  dimensions, extracted from the JPEG headers rather than guessed. As on the NL site, the CSS
  already hard-sizes both image types, so this doesn't fix a real layout-shift bug, just
  matches spec.
- Alt text was already descriptive and in German — no changes needed.
- `loading="lazy"` was already present on every image.
- Same follow-up opportunity as flagged on the NL site: `portfolio-roundabout.jpg` (328KB) is
  larger than ideal for its rendered size. No image-processing tooling available in this
  environment (no ImageMagick, no PIL) — didn't attempt conversion rather than risk
  corrupting the shared asset. Since this file is identical to the one in the NL repo,
  optimizing it once and syncing to both repos would cover both sites.

## 8. Sitemap & robots.txt

- `robots.txt` was already correct (`Allow: /`, correct `Sitemap:` reference) — no changes.
- `sitemap.xml` already correctly excluded the two noindex legal pages and listed all 5 real
  pages — better shape than the NL site was in before its own fix. Only refreshed `lastmod`
  dates to 2026-08-02 on entries actually touched.

## 9. Canonical tags

All 5 indexable pages already had correct, self-referencing canonicals. Added canonical tags
to `impressum.html`/`datenschutz.html` too (still `noindex`, just best practice/harmless).

## 10. Internal linking — bigger gap here than on the NL site

None of the 4 service subpages linked to any other subpage at all — each was only reachable
from the homepage services list and the sitemap, with zero contextual cross-links (the NL site
at least had a partial mesh before I touched it). Added a "Verwandte Leistung" section to all
4 pages:

- `website-friseursalon-essen.html` → `nfc-bewertungstags-essen.html` (the salon page's own
  copy already mentions "Optional: NFC-Bewertungstag für den Tresen" — linking there was a
  natural fit already implied by the existing content)
- `nfc-bewertungstags-essen.html` → `ki-agentur-essen.html`
- `shopify-store-essen.html` → `ki-agentur-essen.html`
- `ki-agentur-essen.html` → `nfc-bewertungstags-essen.html`

Ran a scripted crawl of every internal `href`/`src` against the filesystem: zero broken links,
before and after.

## 11. Core Web Vitals

Same baseline strengths as the NL site: self-hosted `.woff2` fonts with
`font-display: swap`, scripts at the end of `<body>`, lazy-loaded images with CSS-fixed box
sizes, and mobile portfolio-swipe already implemented properly (scroll-snap, touch-action,
dot navigation synced to scroll). Added:

- `<link rel="preconnect">` for `cdnjs.cloudflare.com` (Three.js, homepage only) and
  `cdn.jsdelivr.net` (GSAP/Lenis, all pages)
- Explicit image dimensions (§7)

**Observation at the time this was originally written**: this site had no Google
Analytics/`gtag.js` at all, while the NL site does (`G-J4BN0QL2QE`). **Update (§16a,
2026-08-02)**: GA4 scaffolding was added to all 7 pages with a placeholder Measurement ID —
still not sending any real data until a real ID is supplied (Open Question A).

## 12. Mobile usability — same bug as the NL site, same fix

Found the identical issue already documented on the NL branch: `.nav__links { display: none; }`
below 640px with zero replacement navigation — visitors on phones lost the entire primary nav
(Arbeiten/Leistungen/Preise/Über uns/Kontakt). Ported the exact fix built for the NL site:

- New animated hamburger `.nav__toggle` button on all 7 pages
- New CSS: mobile dropdown panel triggered by a `.nav--open` class, using this site's own
  `--nav--scrolled` background tone (`rgba(16, 14, 10, ...)`, warmer/darker than the NL site's
  `rgba(10, 11, 15, ...)`) for visual consistency with the rest of the page
- New JS in both `js/main.js` and `js/subpage.js`: click toggles the class + `aria-expanded`,
  closes automatically on link click
- Applied the lesson learned on the NL branch immediately: explicitly reset
  `background`/`border` on the toggle button from the start (the NL branch had to catch and
  fix a default-white-button bug after the fact; this time it was right on the first pass,
  confirmed in-browser)
- `impressum.html`/`datenschutz.html` loaded **no JavaScript at all** (not even Lenis) — added
  the same `<script>` includes every other page uses, otherwise the new button would have been
  dead on those two pages
- **Verified in an actual browser**: started a local static server, loaded the homepage,
  injected the real `@media (max-width: 640px)` ruleset at runtime (the available
  window-resize tooling doesn't actually shrink the real viewport in this environment), and
  confirmed the full open → dropdown-renders → tap-a-link → menu-closes-and-scrolls flow works
  end-to-end
- Tap targets (buttons via `.btn` padding) and viewport meta tag were already correct — no
  changes needed

## 13. 404s / broken links

Scripted crawl of every internal link and asset reference across all 7 pages. Zero broken
links, before and after this branch's changes.

## 14. GBP on-site support

- **NAP/LocalBusiness schema**: see §2 and §5 — real Essen address now in the homepage
  schema, referenced by all 4 subpages.
- **Google Map embed**: none existed. Added a Google Maps iframe **pinned at the actual
  business address** (Am Ruhrstein 56, 45133 Essen) near the contact section on the homepage
  — appropriate here since, unlike the NL site, there's no address-mismatch question to work
  around.
- **Review/AggregateRating schema**: not added — no reviews/testimonials anywhere in the site
  content. See §5.
- **Multi-location/service-area pages**: the site serves one location (Essen) with a broader
  `areaServed: "Ruhrgebiet"` region in schema, but has no dedicated landing pages for other
  Ruhrgebiet cities (Bochum, Oberhausen, Duisburg, etc.). Flagged as a strategic next-phase
  idea below, not built unprompted.

## 15. Content gaps (strategic recommendations, not built)

- **No blog/resources/FAQ hub.** Same finding as the NL site — each service page has its own
  `FAQPage` schema, but there's no central FAQ/blog for topical authority or long-tail
  queries.
- **No secondary-city landing pages** for the wider Ruhrgebiet region named in `areaServed`
  (Bochum, Oberhausen, Duisburg, Mülheim, etc.) if those markets matter commercially.
- **No social profile links anywhere in the repo.** Confirmed via a full search of both repos
  (§16c) — if TZ Digital has or creates Instagram/LinkedIn accounts, adding `sameAs` and
  footer links would help citation consistency.
- **Analytics scaffolded but inactive** (see §16a) — needs a real GA4 property ID (Open
  Question A) before there's any traffic data to measure future SEO work against.

---

## 16. Follow-up round (2026-08-02) — GA4, logo, social profiles, hreflang x-default

Requested as a targeted follow-up on this same branch (not merged yet, so continued here
rather than opening a new one). Verified before starting: `git branch --show-current` →
`seo-gbp-de`, `master` unchanged at `c1c09c8`.

### 16a. Google Analytics (GA4) — scaffolded with a placeholder ID, done

Checked the NL sibling repo (`tz-digital.nl`) for its GA4 implementation: it uses the standard
`gtag.js` snippet wired to Measurement ID `G-J4BN0QL2QE`, placed as the very first thing in
`<head>` (before `<meta charset>`), identically on all 16 of its pages including the noindex
legal pages.

Per your explicit instruction, I did **not** reuse `G-J4BN0QL2QE` or invent a new ID for this
site. Added the identical scaffold to all 7 DE pages with a placeholder:

```html
<!-- Google tag (gtag.js) — PLACEHOLDER Measurement ID.
     G-XXXXXXXXXX must be replaced with a real GA4 property ID before this tracks
     anything. See "Open questions" in SEO-CHANGELOG.md. -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

`G-XXXXXXXXXX` is not a valid Measurement ID, so this currently sends no data anywhere — it's
purely scaffolding, waiting on a real ID.

**Caught a knock-on compliance issue while doing this**: `datenschutz.html` §6 currently
states *"Diese Website verwendet keine Cookies zu Analyse-, Marketing- oder
Tracking-Zwecken"* (this site uses no analytics/marketing/tracking cookies). That statement
would become false the moment a real GA4 ID goes live. I added a bracketed `[TBD — ...]` note
to that section — matching the exact convention the site's own Impressum already uses for its
pending VAT number — flagging that this section needs a real rewrite (purpose, legal basis,
IP handling, opt-out) once you decide on the real GA4 configuration (e.g. whether to use
Consent Mode, IP anonymization, a cookie banner). I did not write that legal text myself since
I don't know which configuration you'll choose and GDPR disclosure accuracy matters — see Open
Question A below.

### 16b. Logo — confirmed none exists, not invented

Searched both repos for any logo asset: filename search (`*logo*`) across the working tree in
both repos, `git log --all --diff-filter=A --name-only` across every branch in both repos
(catches anything ever added and later deleted), and grepped for `favicon` and any CSS
`background-image`/`<img>` logo references. Result: **no logo file exists anywhere**, in
either repo, currently or historically. `.nav__logo`/`.footer__logo` are CSS classes styling
the plain text "TZ Digital" wordmark, not references to an image file. No favicon is declared
in any page's `<head>` either.

Did not add a `logo` property to the `Organization`/`ProfessionalService` schema, since there's
nothing real to point it at. See Open Question B.

### 16c. Social media profiles — confirmed none documented, not invented

Searched both repos for `instagram.com`, `facebook.com`, `twitter.com`/`x.com`,
`linkedin.com`, `tiktok.com`, `youtube.com` — across tracked files in the working tree and via
`git log --all -p` (full history, every branch, both repos). Zero matches. Also checked the
untracked `.md` planning/handoff documents that live in both repo roots (gitignored, but real
files on disk) — the only relevant hit is a line in
`TZ-Digital-SEO-Foundations-Cursor-Prompt.md` (NL repo) explicitly saying to link
Instagram/LinkedIn/GBP "once those exist," which confirms they didn't exist as of that writing
either. I did not treat GBP's own dashboard prompts to add social links as evidence accounts
exist — per your instruction, that's a nudge to create profiles, not proof of them.

Did not add `sameAs` to schema or any footer links, since there are no real URLs to add. See
Open Question C.

### 16d. hreflang x-default — already correct on this site; NL side needs the mirroring change

Checked `index.html`'s hreflang block (unchanged since the earlier commit in this branch):

```html
<link rel="alternate" hreflang="de" href="https://tz-digital.de/">
<link rel="alternate" hreflang="nl" href="https://tz-digital.nl/nl/">
<link rel="alternate" hreflang="x-default" href="https://tz-digital.de/">
```

`x-default` already self-references `https://tz-digital.de/` — this was a deliberate choice I
made earlier (see the original Open Question #4, now resolved below) rather than copying the
NL site's choice, and it turns out to already match what you've now confirmed as the intended
answer (DE is the verified legal/business home market). **No code change was needed here.**

The 4 service subpages' own `x-default` values each self-reference their own subpage URL
(e.g. `ki-agentur-essen.html`'s x-default points at itself) — that's correct and doesn't need
to change, since x-default is scoped per hreflang cluster and none of these subpages has an
NL-side equivalent page paired with it; only the homepage cluster (DE ↔ NL's two homepages) is
a real 3-page hreflang group with a consistency question.

**What actually needs to change is on the NL side, not here**: `tz-digital.nl`'s two
homepages (`index.html` and `nl/index.html`) currently self-reference their own `x-default`
(`https://tz-digital.nl/`), which is now inconsistent with this site's
`https://tz-digital.de/`. Per your instruction I did **not** edit the NL repo from this
session. The NL repo's `seo-gbp-nl` branch needs this specific change:

```html
<!-- on both https://tz-digital.nl/ and https://tz-digital.nl/nl/ -->
<link rel="alternate" hreflang="x-default" href="https://tz-digital.de/">
```

---

## Open questions (need a human decision — did not guess)

**A. ~~Real GA4 Measurement ID needed.~~ Resolved 2026-08-02** — see §17 below. The real ID
`G-J4BN0QL2QE` is now live on all 7 pages, and `datenschutz.html` §6 discloses it accurately.
One residual sub-question carried into §17: whether a cookie-consent banner is additionally
required under German TTDSG — noted there, not decided here.

**B. ~~Logo needed.~~ Resolved 2026-08-02** — see §19 below. A real logo file was provided
and is now live in `assets/logo.jpg`, referenced from `Organization.logo` and used as the
site favicon. Not yet applied to the NL repo — that's a separate session/branch.

**C. ~~Social media URLs needed.~~ Partially resolved 2026-08-02** — see §19 below. A real
Instagram URL (`https://www.instagram.com/t_z_digital`) was provided and is now live in
`sameAs` schema and the footer nav on all 7 pages. No LinkedIn/Facebook/etc. URL has been
provided — if those exist, the same wiring pattern applies. Not yet applied to the NL repo.

**D. NL repo needs its `x-default` updated to match** — see §16d. This is a one-line change
per NL homepage (2 files) on the `seo-gbp-nl` branch; I didn't make it from this session since
you asked me not to edit the NL repo here.

1. **Opening hours not documented anywhere.** GBP requires these for most categories; as a
   service business without walk-in customers, "by appointment" vs. fixed hours is a business
   choice.
2. **VAT/tax ID still pending** — `impressum.html` itself says *"[TBD —
   Umsatzsteuer-Identifikationsnummer... sobald vom Finanzamt bestätigt]"*. Same shared-entity
   note as flagged on the NL side: not a website issue, but relevant to GBP verification,
   which can ask for business registration documents.
3. **GBP listing structure relative to the NL site.** Since both sites are legally the same
   business at the same address, marketing to different markets — this side is the
   straightforward one (the address *is* this site's real market), but you may want a single
   coordinated view of both GBP listings (one facing Essen/Ruhrgebiet, one facing Maastricht
   as a service-area business) rather than deciding them independently. See
   `GBP-CONTENT-NL.md`/`SEO-CHANGELOG.md` on the NL repo's `seo-gbp-nl` branch for the fuller
   discussion of that side's constraints.

## Build / lint / test

Static HTML/CSS/JS site, no `package.json`, no build step. "Testing" for this branch:

- Scripted JSON-LD validity check across all 7 pages (0 errors)
- Scripted internal-link/asset-reference crawl across all 7 pages (0 broken links)
- XML well-formedness check on `sitemap.xml`
- Loaded the homepage in an actual browser and manually verified the new mobile nav menu
  (open, dropdown renders, link-click closes + scrolls) — confirmed working correctly on the
  first pass this time, applying the lesson from the NL branch's white-button bug

---

## 17. Follow-up (2026-08-02) — real GA4 ID went live: `G-J4BN0QL2QE`

Replaced the placeholder `G-XXXXXXXXXX` from §16a with the real Measurement ID,
`G-J4BN0QL2QE`, everywhere it appeared: the `<script src>` URL and the `gtag('config', ...)`
call on all 7 pages (14 replacements total, verified with a scripted count — zero remaining
`G-XXXXXXXXXX`/`PLACEHOLDER` references anywhere afterward). Also replaced the
`<!-- PLACEHOLDER Measurement ID... -->` warning comment on each page with the plain
`<!-- Google tag (gtag.js) -->` comment the NL site uses, since the placeholder warning no
longer applied.

Worth noting for context (established while fixing the NL sibling site in a separate branch):
`G-J4BN0QL2QE` is this site's own real, correct GA4 property — it was actually the ID
mistakenly hardcoded onto tz-digital.nl instead of a property of its own. That's now fixed on
the NL side too (separate branch, separate session). This site (tz-digital.de) is the ID's
correct home.

**`datenschutz.html` §6 rewritten**: replaced the `[TBD — ...]` placeholder note from §16a
with an actual, accurate GA4 disclosure — purpose, provider (Google Ireland Limited), data
categories, legal basis (Art. 6 Abs. 1 lit. f DSGVO), and an opt-out link — following the same
purpose/legal-basis/provider template the page already uses for Vercel hosting and the CDN
script libraries (§2/§5). Identical language to what was written for the NL sibling's
`datenschutz.html` in its own GA4 fix, since both pages describe the same underlying tracking
setup for the same legal entity.

Kept one qualifying sentence rather than asserting full compliance: *"Ob für die Nutzung von
Google Analytics zusätzlich eine Einwilligung (Cookie-Banner) erforderlich ist, wird gesondert
geprüft."* Whether a cookie-consent banner is additionally required under German TTDSG
(separately from the GDPR legal-basis question) is a live legal question for small sites using
GA4 — not something to resolve unilaterally by writing confident-sounding prose. Flagging this
explicitly rather than quietly asserting compliance either way. Did not touch the unrelated
`[TBD — Umsatzsteuer-Identifikationsnummer...]` placeholder in `impressum.html` — that's the
genuinely still-pending VAT number, a separate matter.

Committed as a single commit on `seo-gbp-de` (branch not merged/pushed).

---

## 18. Follow-up (2026-08-02) — self-contained cookie consent banner (Consent Mode v2)

§17's disclosure explicitly flagged that whether a cookie-consent banner is required under
German TTDSG was still an open question and that GA4 fired unconditionally on every visit
with no consent mechanism in place. Built and shipped that mechanism.

**New: `js/consent.js`.** No external consent-management service. Pushes a Consent Mode v2
"default" (all denied) state to the dataLayer as its first action, before `gtag.js` can ever
load — and `gtag.js` is now *only* ever injected by this file, never statically in any page's
HTML, so there is no code path where analytics loads before a choice is made. Builds the
banner UI entirely in JS (one source of truth for the German copy instead of duplicating
markup across 7 pages), persists the choice in `localStorage` (not a cookie — this site sets
none of its own), and gates the homepage's Google Maps iframe the same way (its real `src` is
only set once "Statistik" consent is granted).

**Banner UX**: three equal-weight actions — "Alle akzeptieren" / "Nur notwendige" / "Kategorien
wählen" (reveals a Notwendig/Statistik checkbox panel + save button). All three share one
neutral button style (`.consent-banner__btn`), deliberately not using the site's `--accent` CTA
treatment anywhere in the banner, so no option is visually favored over another. A
"Cookie-Einstellungen" button was added to the footer nav on all 7 pages (styled to match the
surrounding links) that reopens the banner with the visitor's current choice reflected.

**Wired into all 7 pages**: removed the unconditional `<script async src=".../gtag/js...">`
block from every page's `<head>` (previously present in the initial GA4 scaffolding from §16a/
§17 — it now only exists dynamically, injected by `consent.js` after consent). Added
`<script src="js/consent.js">` and the footer settings button to all 7 pages. Gated the
homepage's Maps iframe: removed its static `src`, added `data-src` + `data-consent-embed="maps"`
plus a placeholder message ("Diese Karte wird von Google bereitgestellt und lädt erst, nachdem
Sie der Kategorie „Statistik" zugestimmt haben.") with its own link back into the banner.

**`datenschutz.html` §6 rewritten again** — now describes the actual mechanism instead of
flagging it as pending: GA4 and Maps don't load until consent, Consent Mode v2's default/update
pattern, how to change the choice via the footer link, and that the choice is stored in
`localStorage` rather than a cookie. Legal basis updated from Art. 6 Abs. 1 lit. f DSGVO
(legitimate interest, which was already contestable without a consent mechanism — see §17) to
Art. 6 Abs. 1 lit. a DSGVO i. V. m. § 25 Abs. 1 TTDSG (consent), which is now accurate given a
real opt-in mechanism exists.

**Verified in an actual browser**, not just by reading the code — this was the highest-stakes
verification in this whole engagement, since a bug here means either analytics silently doesn't
fire (business impact) or fires before consent (compliance failure). Loaded the homepage on a
local server and, via network-request inspection plus direct DOM/localStorage checks:
- Confirmed **zero requests** to `googletagmanager.com` or `google.com/maps` on first visit,
  before any choice is made
- Clicked "Kategorien wählen" → toggled Statistik on → "Auswahl speichern": confirmed a real
  `google-analytics.com/g/collect` request fired only after that click, the Maps iframe got a
  real `src` and rendered visibly, and the choice persisted in `localStorage`
- Cleared consent and clicked "Nur notwendige": confirmed zero Google requests fired, and the
  choice persisted
- Reloaded after each choice: confirmed the banner does not reappear and the stored choice is
  respected (no banner DOM is even built on repeat visits — it's created lazily, only on first
  visit or when reopened)
- Rebuilt/reopened the banner via the footer "Cookie-Einstellungen" button and confirmed it
  correctly pre-reflects the visitor's current stored choice in the Statistik checkbox
- Repeated the first-visit no-request check on a subpage (`ki-agentur-essen.html`, which has no
  Maps embed, only GA4 to gate) to confirm the gating isn't homepage-specific

Committed as 2 commits on `seo-gbp-de`: the consent mechanism itself (`js/consent.js` + CSS),
then wiring it into all 7 pages + gating Maps + the privacy-policy rewrite together (bundled
since, split apart, an intermediate commit would have left the site's actual behavior and its
privacy-policy disclosure briefly out of sync with each other). Branch not merged/pushed.

---

## 19. Follow-up (2026-08-02) — real logo added, wired into schema + favicon; Instagram linked

Both Open Questions B and C from §16/§17 were resolved with real assets supplied directly:

**Logo.** Saved as `assets/logo.jpg` (1254×1254px JPG, matches the existing `assets/`
convention — no other logo-format asset existed to match, and no image-processing tooling is
available in this environment to convert it, so it's used as-is). Wired into two places:
- `Organization.logo` in the homepage's `ProfessionalService` JSON-LD schema, as the absolute
  URL `https://tz-digital.de/assets/logo.jpg` (schema.org's `logo` property expects an
  absolute, independently-crawlable URL, not a relative path)
- Site favicon: `<link rel="icon" type="image/jpeg" href="assets/logo.jpg">` added to all 7
  pages' `<head>` — no favicon existed before (confirmed in `COMPLIANCE-AUDIT.md`). Using the
  JPG directly via `type="image/jpeg"` is valid and works in all modern browsers; there's no
  `.ico` conversion tooling available in this environment, and a modern `rel="icon"` link
  doesn't require one.

**Instagram.** `https://www.instagram.com/t_z_digital` added to:
- `Organization.sameAs` in the same schema block (array, ready for LinkedIn/Facebook/etc. to
  be appended later if those get provided)
- The footer nav on all 7 pages, as a real `<a>` link (`target="_blank" rel="noopener"`,
  matching the pattern already used for the external portfolio links), right after the
  "Cookie-Einstellungen" button

Both additions only needed to happen once, on the homepage's schema block — every subpage's
`Service.provider` already references `{"@id": "https://tz-digital.de/#business"}` rather than
duplicating the entity, so `logo`/`sameAs` apply site-wide automatically (see §5/§16a's entity
consolidation work).

**Verified**: JSON-LD still parses as valid JSON on all 7 pages after the schema edit;
`assets/logo.jpg` returns 200 from a local server; loaded the homepage in an actual browser
and visually confirmed the "Instagram" footer link renders correctly styled alongside the
other footer nav items.

**Not yet done**: the same logo file and Instagram link have not been applied to the
tz-digital.nl (NL) repo — that's a separate repo/branch (`seo-gbp-nl`), out of scope for a
session working in this DE repo. Also, no LinkedIn/Facebook/TikTok/etc. URL has been supplied
— `sameAs` is left as a single-entry array ready to extend if/when those exist.

Committed as a single commit on `seo-gbp-de`. Branch not merged/pushed.
