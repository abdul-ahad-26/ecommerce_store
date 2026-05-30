import { apiFetch } from "@/lib/api";

/**
 * Phase 0 scaffolding home page.
 *
 * Verifies end-to-end connectivity: this Server Component calls the FastAPI
 * /health endpoint at request time and reports the result. It will be replaced
 * by the real, designed storefront homepage in Phase 2.
 */

async function getBackendStatus(): Promise<{ ok: boolean; detail: string }> {
  try {
    const data = await apiFetch<{ status: string }>("/health");
    return { ok: data.status === "ok", detail: data.status };
  } catch (err) {
    return {
      ok: false,
      detail: err instanceof Error ? err.message : "unreachable",
    };
  }
}

export default async function Home() {
  const status = await getBackendStatus();

  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <div className="w-full max-w-md rounded-xl border border-black/10 p-8 text-center dark:border-white/15">
        <h1 className="text-2xl font-semibold tracking-tight">
          Pakistani Women&apos;s Wear Store
        </h1>
        <p className="mt-2 text-sm text-black/60 dark:text-white/60">
          Phase 0 scaffolding — frontend &amp; backend wired up.
        </p>

        <div className="mt-6 flex items-center justify-center gap-2 text-sm">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${
              status.ok ? "bg-green-500" : "bg-red-500"
            }`}
            aria-hidden
          />
          <span>
            Backend API:{" "}
            <strong>{status.ok ? "connected" : "unreachable"}</strong>{" "}
            <span className="text-black/50 dark:text-white/50">
              ({status.detail})
            </span>
          </span>
        </div>
      </div>
    </main>
  );
}
