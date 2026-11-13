# Intake, CMS, and AI handoff

## Flow

1. A client opens the website intake from their project dashboard.
2. Required answers count toward the progress bar. The legal/footer, business, and design sections can be submitted separately. Our Story and files are optional; if the client chooses to include Our Story, its main text becomes required.
3. The client can save drafts at any time and submit the full intake once required answers are complete. The dashboard task closes only on full submission. Changing a submitted answer returns the intake to draft until it is submitted again.
4. The visual content studio shows editable Home, About, Services, and Contact page drafts. Clients click text or images, try colors, and place numbered comment pins. They submit each page for review; an agency member can approve the submitted version. Version checks prevent silent overwrites.
5. An agency member downloads one private ZIP and provides its contents to their chosen AI or production workflow. No portal action sends data to an AI provider.

## ZIP layout

```text
tz-digital-<project-id>/
  README.md
  manifest.json
  intake-answers.json
  01-legal-footer/
    answers.md
    footer-links.md
  02-business/
    answers.md
  03-story/
    answers.md
  04-design/
    brief.md
  05-content/
    home.md + home.json
    about.md + about.json
    services.md + services.json
    contact.md + contact.json
  06-assets/
    brand/
    legal/
```

Only saved CMS pages and uploaded assets appear. Each page JSON includes text fields, proposed colors, selected hero image ID, pinned comments, status, and version. The Markdown page presents the same information for a human or AI reader. Every exported asset keeps a stable ID prefix to avoid name collisions. The manifest records intake and page statuses so an AI user can distinguish drafts from submitted or approved content. The archive is generated on demand from tenant-scoped database rows and private Storage objects; it is not written to a public directory.

## Boundaries

- The export is available only to agency roles and has a 100 MB asset limit.
- Legal/footer suggestions are based on client inputs and need final review for the actual business and site features.
- The Roundabout demo is a local, editable reconstruction using a crop of the reference screenshot. It is not connected to the live Roundabout website. Its changes live in browser memory only.
- The customer editor is a reusable page preview template. Connecting each customer's exact website renderer remains a separate integration step. Submitted text, image, palette, and pin changes do not automatically publish to a customer site.
- A configured Supabase project with migrations 001–005 is required to test persistence, uploads, approval, and export end to end.
