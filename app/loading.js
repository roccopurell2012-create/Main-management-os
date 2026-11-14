export default function Loading() {
  return (
    <main id="main-content" tabIndex={-1} aria-label="Main content">
      <p role="status" aria-live="polite">Loading your workspace…</p>
    </main>
  );
}
