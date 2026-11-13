# TZ Digital Client Portal — foundation

The public site remains in the parent directory. This isolated Next.js app is intended for a protected Preview deployment and, later, a dedicated portal host. It uses the German site's real Inter font, black surfaces, and violet accent. No public navigation link has been added.

## Customer access

An agency operator creates an organization with `npm run create-client -- "Organization name"`. The command uses a cryptographic generator for a unique six-digit client ID and a 32-character random password, creates a Supabase Auth user and tenant membership, and prints the credentials once. The ID is a **login name**, not a password. The internal auth email is random and is not derived from the ID. Customers do not self-register. An agency operator must handle password resets through Supabase Admin until an agency console is built. Deliver credentials through a secure channel, not together in an unencrypted email.

The login action validates the ID, throttles attempts per ID, IP, and pair through an atomic database function, returns one generic error, and checks membership after sign-in. Supabase manages password hashing and sessions. Row Level Security restricts tenants, projects, and tasks. Do not use this with real clients until the authentication and cross-tenant checks have passed in a configured Preview environment.

## Setup

1. Create a **non-production** Supabase project for Preview.
2. Apply the SQL files in `supabase/migrations/` in filename order through the reviewed migration workflow. The second migration adds dashboard milestones, activity, review summaries, and file metadata.
3. In Supabase Auth settings, disable public sign-up. Configure the Preview site URL and allowed redirects. Do not configure preview with production data or service keys.
4. Install dependencies with `npm install` in this directory.
5. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and a random 32+ character `PORTAL_LOGIN_HASH_SECRET` in the local shell or `.env.local`. Keep the service key out of client code and Git.
6. Run `npm run dev`; configure Vercel Preview with its own Supabase project and the same variable names.

The dashboard reads projects, milestones, tasks, review rounds, file counts, and client-visible activity through tenant-scoped Supabase policies. It supports switching between authorized projects, and clearly distinguishes client and agency work. The timeline and launch window are displayed as agency-provided estimates; the scheduling engine is not part of this dashboard slice.

For visual review, run `npm run dev` and open `/demo`. That route uses synthetic data and returns 404 in production builds. It does not exercise authentication or Supabase. The app has no seeded clients or credentials. The supplied static site is not connected to this app yet. Agency provisioning UI, uploads, comment handling, and CMS actions require later workflow work and a configured Preview backend.
