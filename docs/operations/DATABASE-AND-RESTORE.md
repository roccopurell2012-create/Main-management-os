# Database, deployment and non-production restore gate

No commands here were run against production. No database is configured. Use a dedicated database; do not apply role changes to a shared unrelated database.

## Least privilege

Use a separate schema-owner/migration credential for `npm run migrate`, then a provider-provisioned runtime login with no superuser, role creation, database creation or schema ownership. Do not use the migration credential in Vercel. Review `runtime-grants.sql` as a DBA; it grants only the tables/actions currently needed and is not automatically executed. Do not expose SQL or database keys to company browsers. Application checks enforce tenancy; no RLS-backed claim is made. If introducing direct SQL/client access, design and verify RLS first. Production code requests certificate-verified TLS; do not disable certificate verification to get a connection working.

Run migrations 001 and 002 in a disposable database first. The migrator now maintains a migration ledger and uses a transaction-scoped advisory lock. On existing installations without a ledger, 001 is idempotent; inspect that the actual schema matches before recording it as applied. Back up before applying additive production migrations. No destructive business-data migration is included.

## Backup and restore verification — not yet performed

1. Select provider/region, encryption, administrators, backup/PITR schedule, retention, RPO/RTO and recovery owner. Store credentials in provider secret storage or protected PostgreSQL service/pass files; never use connection URLs in command arguments or committed scripts.
2. Back up both schema and data; attachments live in bytea and are included. Restrict download locations and access logs; encrypt backup artifacts. A provider dashboard recovery test is acceptable if it creates an isolated private instance.
3. For CLI operations, configure a trusted PostgreSQL service named `portal_backup` with credentials outside the repository and permissions 0600. Use `PGSERVICE=portal_backup pg_dump --format=custom --file /secure/private/path/portal.dump`. This is an illustrative local path, not an executed backup.
4. Provision an empty isolated staging target with a different credential/service named `portal_restore_test`. Use `PGSERVICE=portal_restore_test pg_restore --no-owner --no-privileges --dbname=service=portal_restore_test /secure/private/path/portal.dump`. Verify the target identity before executing; never target the production service. Restrict restore-instance network access. Do not use real customer backups for the synthetic application test suite.
5. Verify schema/version, FK consistency, representative synthetic tenant records/files, restricted-role permissions, login and private-note authorization. Recovery of a production backup needs separately authorised trained personnel and private handling, outside these synthetic tests.
6. Ensure restored expired sessions and erased-record requests are reconciled before any restored environment is exposed. Record observed restore time and success/fail without printing customer records. Destroy a restore instance only under the approved retention plan.

## Vercel launch gate

Supply a project/team identity and separate preview/production databases. Set only DATABASE_URL and SESSION_SECRET in server-side environment stores; OWNER_EMAIL/PASSWORD are CLI-only. Verify deployment protection on previews, HTTPS redirects, headers/CSP, production error masking, and no private HTML in CDN caches. Do not paste secrets into logs/screenshots. Use a production build, not `next dev`. Browser source maps are disabled. Schedule authentication-state maintenance and configure edge rate controls without weakening application authorization. Test actual Chrome/Safari keyboard, forms, file transfers and cookie flow before promotion.

No preview or production deploy is authorised by completion of this document. Critical verification remains blocked until dependencies/database are available.
