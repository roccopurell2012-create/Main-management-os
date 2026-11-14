# Rocco Creations setup and Vercel launch gate

Updated 14 November 2026. **Not deployed. No database workspace has been created.** This document supersedes earlier setup assumptions about support hours, initial customer countries, planned module switches and future website payment activation.

## Confirmed scope

Rocco Creations is **unregistered**; email rocco.creations.sa@gmail.com; phone 082 637 9348. Initial customers are in South Africa: construction companies, electrical contractors, and similar businesses. Support hours are **08:00–17:00 South African time**, using Africa/Johannesburg. Support days, who monitors contacts, privacy officer, escalation arrangements and response-time commitments are **To be confirmed**. No days or service-response promise has been invented.

Contracting legal person, registration/VAT details, physical/service address and business history are not supplied. No legal entity type or incorporated status is asserted. Required unknown fields remain **To be confirmed**. Policies remain drafts requiring professional review; they are not a compliance guarantee.

No image/logo assets were found in this project. Text branding and the existing green/orange interface palette are temporary and replaceable, not claimed official Rocco Creations logos/colours. Company branding and logos remain separate from platform branding.

**Website payments are excluded**, not merely awaiting credentials. No checkout, collection or payment-provider integration may be added. Payments are arranged separately. Invoice records may be implemented only without processing payments; the invoice module is currently Coming soon.

## Providers and actual evidence

| Area | Actual evidence | Remaining fact |
| --- | --- | --- |
| Hosting | Next.js app prepared for Vercel; no local .vercel project link, Git repository or deployment URL. Connected account has two similarly named projects; returned metadata does not associate either with this checkout | Actual portal target/team, deployment regions, logs and storage locations: **To be confirmed**. Do not attach to an unrelated project by name alone. |
| Database | Postgres.js and PostgreSQL migrations; DATABASE_URL absent in inspected process; no real .env file | Provider/project, primary/replica/backup locations and runtime permissions: **To be confirmed** |
| Files | Private files/brands stored in `files.data bytea` in PostgreSQL; no external object-store integration | Same database/backup locations: **To be confirmed** |
| Backup | No backup provider or running backup/restore job configured; runbook only | Provider, schedule, encrypted storage, retention and verified restore: **To be confirmed** |
| Authentication | Application-managed Node scrypt and opaque sessions in PostgreSQL; no external identity-provider integration. SESSION_SECRET absent | Auth-record storage follows database region; trusted initial administrator and operational setup: **To be confirmed** |
| Email | Owner-supplied Gmail contact; no SMTP/transactional SDK/send action. In-app notifications only | Who monitors Gmail, mailbox data-location commitments and any future automated-delivery provider: **To be confirmed** |

See [provider evidence and safe dashboard instructions](operations/PROVIDERS-AND-ASSETS.md). Check each provider's project overview, region, replicas/backups and logs; do not infer location from South African customers or the mailbox domain. Set credentials privately in deployment/provider stores, never chat.

## Initial workspace and module selection

The protected **Prepare initial workspace: To be added** admin action and `npm run workspace` share a transaction-based, administrator-checked preparation function. The command needs OWNER_EMAIL to identify the already-created platform administrator. It creates one workspace named **To be added**, technical link `/c/initial-workspace`, status **suspended**, timezone Africa/Johannesburg, temporary colours and no customer/staff accounts, memberships, tickets or business records. A repeated call preserves existing workspace records. The link is not publicly accessible; members are blocked while suspended. Supply the actual company name, review selections and assign authorised memberships before activation.

There are **50 catalogue entries**: 6 implemented core modules, 43 Coming soon modules and 1 Disabled website-payment module. All **49 non-payment entries have company selection switches**. Selection and availability are separate: a selected unfinished module displays a non-clickable **Coming soon** tile, and the server denies direct routes. A selection is a stored preference, not an implementation or integration claim. Reserved JSON settings are labelled as such.

The initial preset selects **35 modules**: six implemented core pages (overview, support tickets, notifications, team/permissions, company settings and help/support), plus the following **29 provisional trade selections**:

- Job scheduling; site visits; customer records; leads/enquiries; estimates/quotes; work orders; job/project tracking; milestones.
- Site diaries; daily work reports; timesheets; staff directory/schedules; subcontractor and supplier directories.
- Purchase orders; materials/inventory; equipment/tool register; equipment maintenance.
- Health/safety; risk assessments; incident/near-miss reports; toolbox talks; permits/compliance documents.
- Job photos/files; plans/drawings; forms/checklists; customer sign-off; quality inspections.

No specific trade selection was supplied, so this preset is a practical **recommendation for owner review**, not a claim that the owner individually selected these entries. Other non-payment modules remain switchable. No selected trade workflow is presented as working before implementation.

## Proposed operating settings

[Proposed retention, account closure, backup and file-scanning settings](operations/PROPOSED-SETTINGS.md) are recommendations only, not active jobs, statutory retention claims or customer promises. Owner/privacy-professional approval is **To be confirmed**. No business-data deletion, external file scan or backup has run. Existing expiry maintenance only handles operational authentication state and must be scheduled privately.

## Exact deployment blockers

1. **Dependency availability:** the earlier pin `next@16.4.6` is rejected by this configured registry (`ETARGET`, corroborated by an explicit `E404` metadata lookup). Cached/latest metadata reports 16.4.2, which is not a verified replacement for the intended security patch. Do not downgrade blindly or claim previous release-page research establishes registry availability. Resolve an available, security-reviewed framework/dependency set, install it and generate a lockfile. Registry connectivity/metadata has also been intermittent. No packages were installed.
2. **Production build:** `next build` cannot run without dependencies. No compiled production app or browser preview exists.
3. **Database and sessions:** provision separate private test/production databases and configure DATABASE_URL and a strong SESSION_SECRET through the secret store. Apply migrations with a separate trusted migration credential; review runtime grants/TLS. No configured database or session secret exists here.
4. **Owner and workspace creation:** run trusted owner bootstrap, then the protected workspace preparation. Do not invent customer/staff accounts or reuse the public support email as an administrator identity without explicit setup.
5. **Integration/access verification:** synthetic guard/download tests pass, but PostgreSQL migrations/constraints, actual role/tenant/module actions, full support conversations/notifications/files and cookie/logout flows need end-to-end verification. Never use customer data for this.
6. **Files and recovery:** choose/implement scanning/quarantine or exclude uploads from the launch scope, schedule authentication maintenance, verify private backup/access/regions and perform an isolated restore. These safeguards are not assumed from a runbook.
7. **Browser and production checks:** verify Chrome/Safari, mobile/desktop, keyboard/screen reader, actual CSP/hydration/HTTPS, cache/noindex, error masking, origin protection and measured performance. Source checks are not substitutes.
8. **Project and policy decisions:** identify the correct Vercel project/team/domain and deployment protection; complete required business/privacy/provider/retention facts and professionally review the drafts before final publication. No production DNS/payment action or launch has occurred.

## Configuration sequence once blockers can be resolved

Use this directory as the Next.js project root; keep the current server-side controls. Resolve/install reviewed dependencies and lock them; run tests, secret/dependency checks and a production build. Configure a disposable database and strong secret privately, run `npm run migrate`, then trusted `npm run owner` and `npm run workspace`. Remove the bootstrap password after owner creation. Verify with synthetic identities, then separately configure production secrets and the least-privilege runtime role. Run protected-preview and restore checks before any production release. No CI auto-deploy or public environment is created by this preparation.

See [the owner checklist](OWNER-CHECKLIST.md) for decisions; missing infrastructure/testing is project work, not a request to invent business details or paste secrets.

## Checks run for this setup change

31 focused tests passed, including placeholder workspace preparation/idempotence/administrator authority, all 49 non-payment selections, permanently blocked payments and blocked Coming soon routes. The database/auth contexts in these tests are synthetic service doubles. JS/JSX parse checks passed across 32 source/config/script files; non-JSX Node syntax checks passed; source-secret heuristic reported zero candidates. Install failed with ETARGET for the pinned Next version; explicit metadata lookup returned E404. Production build failed (`next: command not found`); offline npm audit failed (ENOLOCK). Actual database, browser, provider backup/restore, performance and deployment checks remain unverified.
