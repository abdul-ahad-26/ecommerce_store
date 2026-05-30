/** Boteh (paisley) motif — a small textile-rooted decorative mark. */
export function Motif({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden
      className={className}
      role="presentation"
    >
      <path
        d="M32 4c14 0 24 9 24 22 0 16-14 24-26 24-9 0-16-6-16-14 0-7 5-12 12-12 5 0 9 3 9 8 0 4-3 6-6 6-2 0-4-1-4-3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M32 12c9 0 16 6 16 15"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.6"
      />
      <circle cx="30" cy="28" r="2" fill="currentColor" />
    </svg>
  );
}
