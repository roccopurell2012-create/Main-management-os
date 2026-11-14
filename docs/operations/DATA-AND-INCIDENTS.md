# Data requests, retention and incident runbook

Internal draft. Owner must name Privacy officer: To be confirmed, On-call incident owner: To be confirmed, Verified outside-portal contact: To be confirmed, Backup owner: To be confirmed and review against legal/REVIEW.md. Support is not an emergency hotline and its availability depends on module access.

## Data-subject request

1. Receive through Privacy request support or the verified external channel; record a minimal request reference and receipt date. Do not request identity documents by default.
2. Establish identity/authority proportionately through an already trusted channel. Do not accept knowledge of a company URL, ticket ID or email address as sufficient proof.
3. Scope the request: the platform may act as responsible party for account/support data and operator for company-submitted records. Confirm the relevant company authority and contractual responsibilities.
4. Locate users, memberships, company records, messages/files, notifications, audits and provider logs/backups. Restrict searches to authorised scope. Minimise copies and do not export other people's/private support records by default.
5. Have the privacy officer determine access/correction/objection/restriction/deletion duties and applicable response times/exceptions. Track due date according to reviewed law, not an invented blanket SLA.
6. Prepare a redacted result in private storage; review with authorised personnel; deliver through authenticated/expiring private access after identity verification. Never add a public export URL or email attachment by default.
7. Corrections/erasure need reviewed scope, legal-hold and backup handling. This project has no automatic erasure/export facility. Prepare an exact transaction and affected-record counts in staging and obtain explicit approval before destructive production execution.
8. Record outcome and minimal audit metadata; explain limits and complaint options. Do not copy identity documents, passwords or complete exports into audit events.

## Retention decision worksheet

Owner/privacy professional must approve purpose, lawful basis, retention, legal holds, deletion method and backup treatment for accounts, memberships, branding, tickets/messages/files, notifications, audit history, request/security logs and backups. No business-record purge is enabled. Archive retains data and is reversible. Replacing a logo currently retains the old file for the platform administrator; approve a purge/retention rule before long-term use.

`npm run maintenance` removes only expired authentication operational state. Schedule it daily in a trusted job with a restricted credential; there is no public cron endpoint or webhook. Rate-limit identities are HMAC pseudonyms, not anonymous data. Rotation of SESSION_SECRET invalidates existing sessions and rate keys; rotation requires separate owner approval.

## Incident response

Preserve minimal evidence privately, restrict incident access, identify affected companies and time window, and contact the designated officer. Do not dump tokens, ticket bodies or personal data to console, public issues or chat. Contain affected access through the smallest reversible control; record the decision. Do not rotate credentials, destroy records or disable production broadly without approved authority unless the agreed incident plan already authorises it.

Assess unauthorised access/acquisition with the officer and counsel. Follow the POPIA s 22 process cited in legal/REVIEW.md for notification decisions, timing, recipients and permitted delay. Use the Regulator's current official submission process; verify it at incident time. Communicate known facts and update as evidence develops. Follow up with scoped remediation, recovery testing and lessons learned.
