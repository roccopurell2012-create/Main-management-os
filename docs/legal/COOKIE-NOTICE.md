# Cookie notice — implementation facts, pending operator review

Checked from source 14 November 2026. Business: Rocco Creations, unregistered, South Africa. Contacts: rocco.creations.sa@gmail.com; 082 637 9348. Contracting legal person/privacy officer: To be confirmed.

| Cookie | Purpose | Data | Duration | Control |
| --- | --- | --- | --- | --- |
| portal_session | Authenticate an individual account | Cryptographically random opaque token; server stores a keyed hash | Up to 12 hours | HTTP-only; SameSite=Lax; Secure in production; path=/; sign-out deletes server session and cookie |

No application analytics, ads, marketing, third-party fonts or optional tracking cookies are implemented. No localStorage/sessionStorage collection appears in the source. The current UI explains the essential cookie and the effect of blocking it; there is no decorative cookie banner or consent preference stored without a purpose. Inspect actual hosting/security-provider cookies in a private preview browser before launch; source inspection cannot prove what an external provider sets.

If optional tracking is proposed, first select lawful basis and assess all customer countries with the privacy professional, document recipients/purposes/lifetimes, and implement prior blocking plus separate Accept/Reject choices and reversible preferences as required. No preselected consent or bundled marketing consent is authorised. Review the conditional legal analysis and date in REVIEW.md.

## Confirmed setup scope

Initial customer country: South Africa. Support contacts: rocco.creations.sa@gmail.com and 082 637 9348. Support hours: 08:00–17:00 South African time (Africa/Johannesburg). Support days, contact monitoring responsibility, privacy officer and response-time commitments: **To be confirmed**. No support days or response-time promise is inferred. Payments are arranged separately; the website must not collect or process them. These policies remain drafts for professional review.
