# Rocco Creations business portal

**Current status:** see [SETUP-STATUS.md](docs/SETUP-STATUS.md). Not deployed. Earlier setup/payment assumptions are superseded by the latest owner instructions.

A separate Next.js App Router / React application, preserving the unrelated `../anpr-vercel` project. PostgreSQL stores all records, opaque sessions and small protected attachments. All business data is rendered on the server. There are no public company pages and no sample customers or invented metrics.

## Local setup

Requires Node 22.15+ and PostgreSQL 15+. Install dependencies with `npm ci` once a lockfile is present (`npm install` for the initial checkout). Copy `.env.example` to `.env.local`, populate DATABASE_URL and a random SESSION_SECRET of at least 32 characters. Use a dedicated PostgreSQL database and TLS for remote connections. Run `npm run migrate`. Set OWNER_EMAIL and a unique OWNER_PASSWORD (14+ characters) temporarily in `.env.local`; run `npm run owner` once. Remove the bootstrap password afterward. Run `npm run dev` and visit http://localhost:3000. Sign in, add a company, then add individual company memberships. Never share the owner credentials with companies.

`npm run owner` creates an additional platform support administrator when used with another unique email. It refuses duplicate emails. Protect access to this command and the database. Existing accounts are not silently promoted. Initial passwords must be handed over privately. Self-service password recovery and email invitations are not implemented. The platform owner can revoke a company membership immediately. Users can change their password on the account page; password changes invalidate all their existing sessions.

## Configuration and Vercel

Required accounts: Vercel and a PostgreSQL provider (for example a managed PostgreSQL service). Configure DATABASE_URL and SESSION_SECRET separately in Vercel production and preview environments. For Supabase Postgres, download the project CA certificate from Database Settings → SSL Configuration and set its full PEM contents as the server-only SUPABASE_CA_CERT variable in Vercel Production. The app requires this CA and verifies the certificate; do not set rejectUnauthorized to false. Do not expose secrets as NEXT_PUBLIC variables. Apply migrations against the correct database before deployment, create the owner through a trusted local terminal, import this directory as the Vercel project root, use the Next.js framework preset and `npm run build`. No custom vercel.json is needed. Preview deployments must use a separate database. Do not put OWNER_PASSWORD in Vercel runtime environment variables.

No authentication provider account is required for this initial password/session implementation. Sessions expire after 12 hours; cookies are HTTP-only, SameSite=Lax, and Secure in production. Login attempts are limited per keyed email/source and globally in the database; raw emails/IPs are not stored in new throttle rows. Run the new migrations before starting. Use Vercel rate limiting for additional IP-based protection before broad public onboarding. Next.js Server Actions enforce same-origin mutation requests. Owner bootstrap is CLI-only. Company access is denied for suspended and archived companies; platform administrators can inspect retained data.

Attachments are restricted to PNG, JPEG and PDF signatures, 2 MB per file, stored as bytea in PostgreSQL and downloaded through an authenticated route. Logos accept only JPEG/PNG. No public file URLs or remote logo fetching. Signature checks are not malware scanning: add a scanning/quarantine service before accepting high-risk public uploads. For higher volume, migrate attachments to a private object storage bucket with short-lived authorized download links. Set database storage budgets and backup/restore retention with your provider. Database backups must include attachments.

Do not deploy until database/auth configuration exists and the integration acceptance checks below pass. No deployment has been performed by this source checkout.

## Implemented core

- Platform company search and status filters; create/edit branding, link, timezone, contact and welcome message; suspend, archive and recover. Protected logo upload and owner preview.
- Module catalogue with 50 entries. Six operational pages: company overview, support tickets, notifications, team and permissions, company settings (view; edits by platform owner), help and support. Another 43 entries are Coming soon and may be selected without activating their routes; website payments are Disabled. Support enabled by default. Disabling company overview also blocks the /c/slug alias. Per-module allowed roles and JSON settings stored per company; settings are reserved for module-specific extensions and do not currently change page behavior.
- Individual accounts, memberships and six roles. Owners and managers can manage membership through the team module, with owner-role changes limited to owners and enrolment of existing outside accounts limited to platform admins; platform admins can also remove access. Read-only members cannot mutate support records. Server checks guard every company page and mutation, including disabled module URLs. Company users cannot create platform administrators.
- Tickets: category, priority, subject, body, attachments, conversation, replies, resolve/reopen, administrator assignment and status/priority changes; company/status/priority/category/date/search filters; private administrator notes excluded from company queries, downloads and notifications.
- In-app new-ticket/reply notifications and unread indicator; explicit mark-as-read; audit trail for administration and support actions. Notifications refresh on navigation rather than real-time push. Lists currently show the newest 100 results, audit 30; pagination is a later improvement.
- Operational empty/loading/error states and responsive layout. No hard delete is exposed; archive preserves company records.

## Data and access design

`migrations/001_core.sql` defines users, sessions, login attempts, companies, memberships, modules, tickets, messages, files, notifications, audit events and a future business_records envelope. Tenant references use foreign keys; composite keys enforce ticket-message-file company consistency. Roles are checked in `lib/auth.mjs`; all company lookups and actions require authenticated membership or explicit platform admin authority. Query parameters are bound, never interpolated SQL text. Database credentials are server-only. This implementation uses application authorization, not PostgreSQL row-level security; do not expose the database directly to a browser or grant SQL access to company users. Private notes are filtered at the server before serialization and before attachment download authorization. All multi-record mutations use transactions.

## Stages after the core

1. Verify deployed core against separate companies and roles; configure backups and operational monitoring. Add email invitations/recovery, MFA, more granular permission capabilities, pagination and file scanning.
2. Implement customer records, leads, scheduling, work orders, projects, milestones, visits, diaries and daily reports with dedicated schemas and tenant-scoped operations.
3. Add timesheets, leave, staff schedules, subcontractors, suppliers, inventory, equipment, fleet and safety/checklist workflows. Agree on company-specific compliance forms before building them.
4. Add estimates, purchase orders, invoices, costing, expenses, budgets and reports. Agree invoice/accounting record rules; no website payment connection is permitted. No payment credentials, subscription integration or processing exists now.
5. Add sign-off, inspections, warranties, reviews, document templates and drawings. Define retention and legal requirements with the owner; legal wording and compliance remain for separate review.

## Verification

Run `npm test` for password/session, permissions, catalogue and upload boundaries. Run `npm run build` to compile production. These checks do not establish tenant isolation on their own.

Before production, apply the migration to a disposable PostgreSQL database and test with two companies and users in each role: direct cross-company URLs and file downloads must fail; disabling support must block ticket list, detail and mutations; suspended/archived workspaces must deny members; read-only users must not reply or change status; private notes/files must never appear for companies; membership removal must invalidate access on the next request. Verify new ticket/reply notifications and assignment, archive/recovery, replace logo, slug uniqueness, uploads at/over 2 MB, login throttling, password changes, and mobile keyboard/navigation. No provider connections or legally compliant status are claimed.

## Current checkout validation status

On 14 November 2026, the initial five dependency-free unit tests passed (the review expands this to 24 focused tests; see docs/REVIEW.md). Node syntax checks passed for actions, authentication, configuration, and the file handler. Dependency installation failed because this environment cannot resolve registry.npmjs.org. Therefore no lockfile could be generated and `npm run build` failed with `next: command not found`. Production compilation, browser checks, migrations, and live tenant-isolation tests remain unverified. Run dependency installation, commit the generated lockfile, and complete the acceptance checks above before deployment. No working hosted URL is available yet.

## 14 November 2026 review changes

See [the review and launch gate](docs/REVIEW.md), [legal research and missing business facts](docs/legal/REVIEW.md), and [operations runbooks](docs/operations/DATABASE-AND-RESTORE.md). New installations and upgrades must run `npm run migrate` to apply the additive `002_review.sql` migration. `npm run maintenance` removes expired authentication state only and needs a trusted daily schedule/maintenance role. New password hashes use asynchronous versioned scrypt; legacy hashes upgrade on successful login. Source-level CSP, noindex, TLS, throttles and form changes are not claimed live until production build and browser/database checks pass. The earlier Next.js 16.4.6 pin is rejected by the configured registry; a published, security-reviewed dependency set must be resolved before installation/build. Do not silently downgrade just to pass checks. Policy drafts contain required placeholders and have not been published.

## Business details and remaining setup

The owner supplies Rocco Creations as the business name, currently unregistered, South Africa; contact email rocco.creations.sa@gmail.com and phone 082 637 9348. Intended customers are construction companies, electrical contractors, and similar businesses. No legal entity type, registration/VAT number, address or history is inferred. Public details are centralised in `lib/business.mjs`. Unknown facts use **To be confirmed**. See [the owner checklist](docs/OWNER-CHECKLIST.md) and [provider findings](docs/operations/PROVIDERS-AND-ASSETS.md). Website payments are excluded; payments are arranged separately. No checkout or payment-provider integration may be added. Never send credentials in chat.

## Current setup and release preparation

Support: 08:00–17:00 South African time; days and monitoring responsibility To be confirmed. Initial customer country: South Africa. No website payments, checkout or payment-provider integration is authorised; payments are arranged separately. Invoice records remain Coming soon and may never process payments under this scope. Earlier payment-provider planning notes are superseded.

The 50-entry catalogue now distinguishes **selection** from **availability**. Every non-payment module has a stored company selection switch; selecting Coming soon modules only shows labelled, non-clickable tiles. Their routes remain blocked. Six core modules are implemented; other trade/business workflows remain Coming soon. Payments are Disabled and cannot be selected. Existing module rows are preserved; the admin can save selections for previously absent catalogue entries.

After dependencies, a private database and migrations are ready, run `npm run owner`, then `npm run workspace` with OWNER_EMAIL identifying the already-created platform administrator (no bootstrap password is needed for workspace preparation). Alternatively use the protected administrator action **Prepare initial workspace: To be added**. It creates one suspended workspace with placeholder name **To be added**, technical slug `initial-workspace`, temporary colours and no customer/staff data. It selects six core modules and a documented provisional construction/electrical preset. Repeating it does not overwrite an existing workspace. Rename it, review selections and assign real users privately before activation. No workspace has been created in a database by the current unconfigured checkout.

See [setup status](docs/SETUP-STATUS.md), [recommendations needing approval](docs/operations/PROPOSED-SETTINGS.md), and the updated [owner checklist](docs/OWNER-CHECKLIST.md). No deployment is permitted until the release blockers pass.
