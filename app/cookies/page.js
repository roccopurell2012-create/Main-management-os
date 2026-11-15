import Link from 'next/link';
export const dynamic='force-dynamic';
export default function Cookies(){return <main id="main-content" tabIndex={-1} className="setup">
  <p className="eyebrow">COOKIE NOTICE · DRAFT FOR REVIEW</p><h1>Cookies used by the company portal</h1>
  <div className="notice">This notice describes the current application configuration. Have the responsible business and service providers review it before launch.</div>
  <section className="panel"><h2>Essential sign-in cookie</h2><p>The portal sets an HTTP-only, Secure in production, SameSite=Lax cookie named <code>portal_session</code>. It contains a random session token and is required to keep a user signed in. Its matching database value is a keyed hash. The cookie expires after 12 hours by default. If the user selects “Remember me”, it expires after 30 days. Signing out revokes the session and removes the cookie.</p><h2>No optional tracking cookies</h2><p>The current app does not load analytics, advertising pixels or marketing cookies. Since there are no optional cookies to accept or reject, it does not display an opt-in cookie banner. If optional tracking is added later, review consent requirements and implement a choice before enabling it.</p><h2>Browser controls</h2><p>You can clear or block cookies in your browser settings. Sign-in and other authenticated pages will not work without the essential session cookie.</p></section>
  <p><Link href="/privacy">Privacy Notice</Link> · <Link href="/terms">Terms of Use</Link> · <Link href="/">Return to portal</Link></p>
</main>}
