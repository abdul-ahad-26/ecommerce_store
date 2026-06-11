"use client";

import { usePathname } from "next/navigation";

/**
 * Chooses page chrome by route. The /admin area is a back-office and should not
 * wear the customer storefront's announcement bar, shop nav, cart or marketing
 * footer — it has its own header in app/admin/layout.tsx. Everywhere else gets
 * the full storefront chrome.
 *
 * `header` and `footer` are passed in as elements (rendered by the server
 * layout) so they keep their server-component nature; this client wrapper only
 * decides whether to show them.
 */
export function SiteChrome({
  header,
  footer,
  children,
}: {
  header: React.ReactNode;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin") ?? false;

  if (isAdmin) {
    return <main className="flex-1">{children}</main>;
  }

  return (
    <>
      {header}
      <main className="flex-1">{children}</main>
      {footer}
    </>
  );
}
