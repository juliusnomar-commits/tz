# TZ Digital Client Portal — foundation

The production app serves the original German TZ Digital website at `/`, including its static subpages and assets. The original files remain in the parent directory and `npm run build` syncs them into `public/`. A matching “Kundenportal” link on the site opens `/login`; the dashboard, intake, and visual editor stay on their portal routes. Until Supabase is configured, login shows a link to the clearly labeled synthetic Roundabout demo.

## Customer access

An agency operator creates an organization with `npm run create-client -- "Organization name"`. The command uses a cryptographic generator for a unique six-digit client ID and a 32-character random password, creates a Supabase Auth user and tenant membership, and prints the credentials once. The ID is a **login name**, not a password. The internal auth email is random and is not derived from the ID. Customers do not self-register. An agency operator must handle password resets through Supabase Admin until an agency console is built. Deliver credentials through a secure channel, not together in an unencrypted email.

The login action validates the ID, throttles attempts per ID, IP, and pair through an atomic database function, returns one generic error, and checks membership after sign-in. Supabase manages password hashing and sessions. Row Level Security restricts tenants, projects, and tasks. Do not use this with real clients until the authentication and cross-tenant checks have passed in a configured Preview environment.

## Setup

1. Create a **non-production** Supabase project for Preview.
2. Apply the SQL files in `supabase/migrations/` in filename order through the reviewed migration workflow. The second migration adds dashboard records; the third adds website intake and a private `portal-intake` Storage bucket; the fourth adds section progress and editable page copy; the fifth adds proposed colors, hero image selection, and pinned comments.
3. In Supabase Auth settings, disable public sign-up. Configure the Preview site URL and allowed redirects. Do not configure preview with production data or service keys.
4. Install dependencies with `npm install` in this directory.
5. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and a random 32+ character `PORTAL_LOGIN_HASH_SECRET` in the local shell or `.env.local`. Keep the service key out of client code and Git.
6. Run `npm run dev`; configure Vercel Preview with its own Supabase project and the same variable names.

The dashboard reads projects, milestones, tasks, review rounds, file counts, and client-visible activity through tenant-scoped Supabase policies. It supports switching between authorized projects, and clearly distinguishes client and agency work. The timeline and launch window are displayed as agency-provided estimates; the scheduling engine is not part of this dashboard slice.

Every website project has a real “Complete your website intake” task. Clients can save answers as drafts, send individual sections, then submit the full business/legal/design brief. Required answers drive a progress bar; Our Story and uploaded files are optional. The task becomes complete when the full intake is submitted. The footer-link suggestions are planning prompts, not automatically published legal text. TZ Digital must review business-specific legal pages before launch.

Clients can drop brand images and existing legal PDFs/images into the intake. Uploads use short-lived signed upload tokens, a private Storage bucket, tenant/project-scoped object paths, and authenticated download links. Images are never auto-published. Uploads are limited to JPG, PNG, WebP, or PDF under 10 MB; the brand-image area accepts images only. The API checks project membership and edit role before creating uploads or changing answers. To exercise save/submit/upload end to end, run this app with the three migrations and all four environment variables against a local or isolated Supabase project.

The visual editor at `/projects/{projectId}/content` stores proposed text, colors, hero image selection, and pinned comments for Home, About, Services, and Contact. Clients can save drafts and send pages for review; agency users can approve submitted versions. Version checks reject stale saves. The local `/demo/content` route uses a Roundabout example to exercise editing in development. The page preview is a reusable template; exact customer sites need a renderer integration during their build. The editor does not publish changes.

Agency users can download an authenticated handoff ZIP from the visual editor. It contains numbered folders for legal/footer inputs, business basics, optional story, design brief, proposed page text, colors, pinned comments, and uploaded assets, plus `manifest.json` and raw intake JSON. The ZIP is capped at 100 files and 100 MB of assets. See `docs/handoff-and-cms.md` for the folder structure and retrieval flow.

The public `/demo` routes use synthetic Roundabout example data and work in production without Supabase; when no Supabase URL is configured, the root opens the demo. Demo changes live only in browser memory. They do not persist data, upload, or exercise authentication. Configure Supabase and all four environment variables before using real customer logins. The app has no seeded clients or credentials. The supplied static site is not connected to this app yet. Agency provisioning UI and comment handling require later workflow work.
