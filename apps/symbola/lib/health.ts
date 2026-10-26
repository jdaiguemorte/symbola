// Page de santé (SOC-11) : état de l'app et de chaque dépendance du socle,
// plus la version déployée. Lue par Uptime Kuma, donc publique : elle ne
// renvoie que « ok » / « fail » par dépendance, jamais le message d'erreur
// (qui peut contenir un hôte, une adresse ou un identifiant).
export type HealthCheck = () => Promise<void>;

export interface HealthReport {
  status: "ok" | "degraded";
  version: string;
  checks: Record<string, "ok" | "fail">;
}

const DEFAULT_TIMEOUT_MS = 2_000;

function withTimeout(check: HealthCheck, timeoutMs: number): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("délai dépassé")), timeoutMs);
  });
  return Promise.race([check(), timeout]).finally(() => clearTimeout(timer));
}

export async function runHealthChecks(
  checks: Record<string, HealthCheck>,
  options: { version: string; timeoutMs?: number },
): Promise<HealthReport> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const names = Object.keys(checks);
  // Toutes les vérifications en parallèle : une dépendance lente ne retarde
  // pas les autres au-delà du délai.
  const results = await Promise.allSettled(names.map((name) => withTimeout(checks[name]!, timeoutMs)));

  const entries = names.map((name, index) => [name, results[index]!.status === "fulfilled" ? "ok" : "fail"] as const);
  return {
    status: entries.every(([, result]) => result === "ok") ? "ok" : "degraded",
    version: options.version,
    checks: Object.fromEntries(entries),
  };
}

export function httpStatusFor(report: HealthReport): 200 | 503 {
  return report.status === "ok" ? 200 : 503;
}
