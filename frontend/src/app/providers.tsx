"use client";

/**
 * Global client-side providers. Currently sets up TanStack Query for
 * client-side data fetching/caching (cart, account, admin lists).
 *
 * Kept as a Client Component and rendered inside the Server Component layout,
 * wrapping only {children} so the static shell stays server-rendered.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { AuthProvider } from "@/components/auth-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  // One QueryClient per browser session; useState ensures it isn't recreated
  // on every render.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 min — avoid refetch storms
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
