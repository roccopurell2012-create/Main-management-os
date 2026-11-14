export const dynamic = 'force-dynamic';
import './style.css';
import {business} from '../lib/business.mjs';
export const metadata = { title: business.name + ' | Company portal', description: 'A private company workspace', robots: { index: false, follow: false, noarchive: true }, referrer: 'same-origin' };
export default function Layout({ children }) { return <html lang="en"><body><a className="skip-link" href="#main-content">Skip to main content</a>{children}</body></html>; }
