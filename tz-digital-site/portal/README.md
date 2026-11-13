# TZ Digital Client Portal — foundation

The public site remains in the parent directory. This isolated Next.js app is intended for a protected Preview deployment and, later, a dedicated portal host. It uses the German site's real Inter font, black surfaces, and violet accent. No public navigation link has been added.

## Customer access

An agency operator creates an organization with `npm run create-client -- "Organization name"`. The command uses a cryptographic generator for a unique six-digit client ID and a 32-character random password, creates a Supabase Auth user and tenant membership, and prints the credentials once. The ID is a **login name**, not a password. The internal auth email is random and is not derived from the ID. Customers do not self-register. An agency operator must handle password resets through Supabase Admin until an agency console is built. Deliver credentials through a secure channel, not together in an unencrypted email.

The login action validates the ID, throttles attempts per ID, IP, and pair through an atomic database function, returns one generic error, and checks membership after sign-in. Supabase manages password hashing and sessions. Row Level Security restricts tenants, projects, and tasks. Do not use this with real clients until the authentication and cross-tenant checks have passed in a configured Preview environment.

## Setup

1. Create a **non-production** Supabase project for Preview.
2. Apply the SQL files in `supabase/migrations/` in filename order through the reviewed migration workflow. The second migration adds dashboard records; the third adds website intake and a private `portal-intake` Storage bucket.
3. In Supabase Auth settings, disable public sign-up. Configure the Preview site URL and allowed redirects. Do not configure preview with production data or service keys.
4. Install dependencies with `npm install` in this directory.
5. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and a random 32+ character `PORTAL_LOGIN_HASH_SECRET` in the local shell or `.env.local`. Keep the service key out of client code and Git.
6. Run `npm run dev`; configure Vercel Preview with its own Supabase project and the same variable names.

The dashboard reads projects, milestones, tasks, review rounds, file counts, and client-visible activity through tenant-scoped Supabase policies. It supports switching between authorized projects, and clearly distinguishes client and agency work. The timeline and launch window are displayed as agency-provided estimates; the scheduling engine is not part of this dashboard slice.

Every website project has a real “Complete your website intake” task. Clients can save answers as drafts, then submit business information, legal/footer inputs, an optional Our Story section, and a design brief. The task becomes complete when the intake is submitted. The footer-link suggestions are planning prompts, not automatically published legal text. TZ Digital must review business-specific legal pages before launch.

Clients can drop brand images and existing legal PDFs/images into the intake. Uploads use short-lived signed upload tokens, a private Storage bucket, tenant/project-scoped object paths, and authenticated download links. Images are never auto-published. Uploads are limited to JPG, PNG, WebP, or PDF under 10 MB; the brand-image area accepts images only. The API checks project membership and edit role before creating uploads or changing answers. To exercise save/submit/upload end to end, run this app with the three migrations and all four environment variables against a local or isolated Supabase project.

For visual review, run `npm run dev` and open `/demo`, then follow the intake task to `/demo/intake`. Those routes use synthetic data and return 404 in production builds. They do not save, upload, or exercise authentication. The app has no seeded clients or credentials. The supplied static site is not connected to this app yet. Agency provisioning UI, comment handling, and CMS actions require later workflow work.
