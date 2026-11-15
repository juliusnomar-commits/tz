# TZ Digital Client Portal — foundation

The production app serves the original German TZ Digital website at `/`, including its static subpages and assets. The original files remain in the parent directory and `npm run build` syncs them into `public/`. A matching “Kundenportal” link on the site opens `/login`; the dashboard, intake, and visual editor stay on their portal routes. Until Supabase is configured, login shows a link to the clearly labeled synthetic Roundabout demo.

## Customer access

An agency operator creates an organization and website project with `npm run create-client -- "Organization name"`. Use `npm run create-client -- "Cato by Cato" --site cato` to connect Cato's real site profile. The command uses a cryptographic generator for a unique six-digit client ID and a 32-character random password, creates a Supabase Auth user, tenant membership, and project, then prints the credentials once. The ID is a **login name**, not a password. The internal auth email is random and is not derived from the ID. Customers do not self-register. An agency operator must handle password resets through Supabase Admin until an agency console is built. Deliver credentials through a secure channel, not together in an unencrypted email.

For TZ Digital review access, run `npm run create-agency -- PROJECT_UUID` with the project ID printed by client creation. Save its six-digit agency ID and generated password. When onboarding another client, run `npm run grant-agency -- AGENCY_ID NEW_PROJECT_UUID` to give that existing agency login access to the new tenant. The agency account can approve submitted site pages and export the project handoff.

The login action validates the ID, throttles attempts per ID, IP, and pair through an atomic database function, returns one generic error, and checks membership after sign-in. Supabase manages password hashing and sessions. Row Level Security restricts tenants, projects, and tasks. Do not use this with real clients until the authentication and cross-tenant checks have passed in a configured Preview environment.

## Setup

1. Create a **non-production** Supabase project for Preview.
2. Apply all six SQL files in `supabase/migrations/` in filename order through the reviewed migration workflow. The third migration creates the private `portal-intake` Storage bucket; the sixth adds project site profiles and real-site page drafts.
3. In Supabase Auth settings, disable public sign-up. Configure the Preview site URL and allowed redirects. Do not configure preview with production data or service keys.
4. Install dependencies with `npm install` in this directory.
5. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (or legacy `SUPABASE_SERVICE_ROLE_KEY`), and a random 32+ character `PORTAL_LOGIN_HASH_SECRET` in the local shell or `.env.local`. Keep the secret key out of client code and Git.
6. Run `npm run dev`; configure Vercel Preview with its own Supabase project and the same variable names.

The dashboard reads projects, milestones, tasks, review rounds, file counts, and client-visible activity through tenant-scoped Supabase policies. It supports switching between authorized projects, and clearly distinguishes client and agency work. The timeline and launch window are displayed as agency-provided estimates; the scheduling engine is not part of this dashboard slice.

Every website project has a real “Complete your website intake” task. Clients can save answers as drafts, send individual sections, then submit the full business/legal/design brief. Required answers drive a progress bar; Our Story and uploaded files are optional. The task becomes complete when the full intake is submitted. The footer-link suggestions are planning prompts, not automatically published legal text. TZ Digital must review business-specific legal pages before launch.

Clients can drop brand images and existing legal PDFs/images into the intake. Uploads use short-lived signed upload tokens, a private Storage bucket, tenant/project-scoped object paths, and authenticated download links. Images are never auto-published. Uploads are limited to JPG, PNG, WebP, or PDF under 10 MB; the brand-image area accepts images only. The API checks project membership and edit role before creating uploads or changing answers. To exercise save/submit/upload end to end, run this app with the three migrations and all four environment variables against a local or isolated Supabase project.

The visual editor at `/projects/{projectId}/content` stores proposed text, colors, image selection, and pinned comments. Clients can save drafts and send pages for review; agency users can approve submitted versions. Version checks reject stale saves. Generic website projects use a reusable template. Projects with `site_key = 'cato'` use a bundled snapshot of Cato's six real pages, with direct text/image selection and desktop/mobile previews. The snapshot is sourced from `juliusnomar-commits/cato` and its Dutch copy and image map. The site profile in `lib/site-profiles.ts` is the adapter pattern for future clients. Approved changes are exported for TZ Digital to apply to the source site; approval does not publish automatically.

Agency users can download an authenticated handoff ZIP from the visual editor. It contains numbered folders for legal/footer inputs, business basics, optional story, design brief, proposed page text, colors, pinned comments, and uploaded assets, plus `manifest.json` and raw intake JSON. The ZIP is capped at 100 files and 100 MB of assets. See `docs/handoff-and-cms.md` for the folder structure and retrieval flow.

The public `/demo` routes use synthetic Roundabout example data. `/demo/cato` previews the connected Cato editor and saves its trial changes only in browser session storage. The public sample ID `620314` and password `CatoPreview26!` lead there; they are intentionally not a customer account. Demo mode does not upload or exercise authentication. Configure Supabase and all four environment variables, run the migrations, and create the Cato client before issuing real login details. No real Cato credentials exist until that command succeeds. Agency provisioning UI remains a future improvement.
