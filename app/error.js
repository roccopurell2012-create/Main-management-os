'use client';
export default function Error({ reset }) { return <main id="main-content" tabIndex={-1}><h1 role="alert">We couldn’t complete that request</h1><p>Check the form details and your connection. If the problem continues, contact your platform administrator.</p><button onClick={reset}>Try again</button><a href="/">Return home</a></main>; }
