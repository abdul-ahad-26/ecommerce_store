/**
 * Distinct line icons for the home assurances strip — one per promise, so the
 * tiles scan at a glance instead of repeating the same motif.
 * All stroke `currentColor` so they inherit the gold accent.
 */

const base = {
  viewBox: "0 0 32 32",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

/** Delivery van — Cash on Delivery. */
export function CodIcon({ className = "" }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      <path d="M3 9h15v13H3z" />
      <path d="M18 13h6l4 4v5h-10" />
      <circle cx="8.5" cy="24" r="2.4" />
      <circle cx="23.5" cy="24" r="2.4" />
      <path d="M7 13.5h6" />
    </svg>
  );
}

/** Open parcel — free shipping. */
export function ShippingIcon({ className = "" }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      <path d="M16 6 5 11v11l11 5 11-5V11L16 6Z" />
      <path d="M5 11l11 5 11-5" />
      <path d="M16 16v11" />
      <path d="M10.5 8.5 21.5 13.5" />
    </svg>
  );
}

/** Circular return arrow — 7-day returns. */
export function ReturnsIcon({ className = "" }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      <path d="M9 13H5V9" />
      <path d="M5 12.5A11 11 0 1 1 6.5 21" />
    </svg>
  );
}

/** Needle & thread — crafted in Pakistan. */
export function CraftIcon({ className = "" }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      <path d="M25 7 11 21" />
      <path d="M25 7c1.5-1.5 1.5-3 0-3s-3 1.5-3 3 1.5 1.5 3 0Z" />
      <path d="M11 21c-4 4-7 5-7 7s4-1 7-4" />
      <path d="M4 28c4 0 9-2 13-6" />
    </svg>
  );
}
