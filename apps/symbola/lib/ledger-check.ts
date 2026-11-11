// Lot 23b (FAC-14, ADR 0061) — contrôle quotidien de la chaîne des pièces de
// chaque organisation (quotes.verify_ledger). Une anomalie va au journal de
// l'organisation et, si LEDGER_CHECK_PUSH_URL est réglée, la sonde Uptime Kuma
// passe à « down » (alerte ntfy). C'est une sonde à part : /health répond 503
// dès qu'un contrôle échoue, et une anomalie de la chaîne ne met pas l'app en
// panne. Journal technique sans donnée personnelle : des identifiants.
import { recordAudit } from "@symbola/db/audit";
import { appDatabase } from "@symbola/db/client";
import { parseEnv } from "@symbola/env";
import { listOrganizations } from "@/modules/hub/service";
import { verifyLedger } from "@/modules/quotes/service";

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

export type LedgerCheckResult = { organizations: number; withAnomalies: string[] };

// URL Push de Kuma, sans sa partie « ?… » (statut et message sont ajoutés ici).
export function pushUrl(base: string, status: "up" | "down", message: string): string {
  const url = new URL(base.split("?")[0]!);
  url.searchParams.set("status", status);
  url.searchParams.set("msg", message);
  url.searchParams.set("ping", "");
  return url.toString();
}

export async function checkAllLedgers(
  options: { organizationIds?: string[]; push?: (url: string) => Promise<unknown>; pushBase?: string } = {},
): Promise<LedgerCheckResult> {
  const db = appDatabase();
  const organizationIds = options.organizationIds ?? (await listOrganizations(db)).map((organization) => organization.id);
  const withAnomalies: string[] = [];
  for (const organizationId of organizationIds) {
    const result = await verifyLedger(organizationId);
    if (result.ok) continue;
    withAnomalies.push(organizationId);
    console.error(`chaîne des pièces : ${result.anomalies.length} anomalie(s) (organisation ${organizationId})`);
    await recordAudit(db, {
      organizationId,
      action: "quotes.ledger.anomaly_detected",
      details: { count: result.anomalies.length, first: result.anomalies[0]!.anomaly, sequence: result.anomalies[0]!.sequence },
      actor: { kind: "system", id: null },
    });
  }
  const base = options.pushBase ?? parseEnv(process.env).LEDGER_CHECK_PUSH_URL;
  if (base) {
    const push = options.push ?? ((url: string) => fetch(url));
    const message = withAnomalies.length === 0 ? "OK" : `anomalie dans ${withAnomalies.length} organisation(s)`;
    await push(pushUrl(base, withAnomalies.length === 0 ? "up" : "down", message));
  }
  return { organizations: organizationIds.length, withAnomalies };
}

// Lancé une fois au démarrage du serveur (instrumentation.ts), puis chaque jour.
export function scheduleLedgerCheck(): void {
  const run = () => {
    checkAllLedgers().catch((error: unknown) => {
      console.error("contrôle de la chaîne des pièces échoué", error instanceof Error ? error.message : error);
    });
  };
  run();
  setInterval(run, CHECK_INTERVAL_MS).unref();
}
