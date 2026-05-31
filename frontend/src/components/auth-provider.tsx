"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/store/auth";

/** Triggers a one-time silent session restore (refresh) on first mount. */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const init = useAuth((s) => s.init);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void init();
  }, [init]);

  return <>{children}</>;
}
