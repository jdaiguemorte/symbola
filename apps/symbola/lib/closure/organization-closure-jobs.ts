// Lot 35c (RGP-11 ; D8 ; ADR 0100) — traitement horaire des espaces fermés : préavis sept jours avant
// la suppression, puis suppression à la date (minuit à Paris), fichiers et comptes chez le
// fournisseur d'identité compris. Rejeu après une restauration de sauvegarde : un espace dont la
// trace dit qu'il a été supprimé, et qui existe de nouveau, est effacé encore (runbook de
// restauration). Journaux : identifiants seulement (SEC-20).
import { appDatabase } from "@symbola/db/client";
import { listClosedOrganizations, listOrganizationClosureTraces, listOrganizationsIncludingClosed, sendClosureNotice } from "@/modules/hub/service";
import { identity } from "@/lib/identity";
import { eraseClosedOrganization, eraseRemainingFiles, type IdentityEraser } from "./organization-closure";

const INTERVAL_MS = 60 * 60 * 1000;

function providerEraser(): IdentityEraser {
  return (subject) => identity().management.deleteUser(subject);
}

export type ClosurePass = { notices: number; erased: number; files: number };

export async function runOrganizationClosuresOnce(input: { now?: Date; eraseIdentity?: IdentityEraser; organizationIds?: string[] } = {}): Promise<ClosurePass> {
  const now = input.now ?? new Date();
  const db = appDatabase();
  const eraseIdentity = input.eraseIdentity ?? providerEraser();
  const pass: ClosurePass = { notices: 0, erased: 0, files: 0 };
  const closed = (await listClosedOrganizations(db)).filter((row) => !input.organizationIds || input.organizationIds.includes(row.organizationId));
  for (const row of closed) {
    try {
      if (now >= row.deletionDueAt) {
        await eraseClosedOrganization({ organizationId: row.organizationId, now, eraseIdentity });
        pass.erased += 1;
      } else if (await sendClosureNotice(db, { organizationId: row.organizationId, now })) {
        pass.notices += 1;
      }
    } catch (error) {
      console.error("fermeture d'un espace : passage échoué", { organizationId: row.organizationId, error: error instanceof Error ? error.name : "inconnue" });
    }
  }
  // Fichiers d'un effacement interrompu après la base.
  for (const trace of await listOrganizationClosureTraces(db)) {
    if (!trace.erasedAt || trace.filesErasedAt || (input.organizationIds && !input.organizationIds.includes(trace.organizationId))) continue;
    pass.files += await eraseRemainingFiles(trace.organizationId, now);
  }
  return pass;
}

export type ErasureReplay = { replayed: string[] };

// Après une restauration : chaque espace que la trace (celle de la base restaurée, et celle
// exportée avant la restauration) dit supprimé, et qui existe de nouveau, est fermé de nouveau à ses
// dates d'origine (par le script d'exploitation, rôle d'administration), puis effacé encore.
export async function replayOrganizationErasures(input: {
  traces: readonly { organizationId: string; closedAt: Date; deletionDueAt: Date; erasedAt: Date | null }[];
  restoreClosure: (trace: { organizationId: string; closedAt: Date; deletionDueAt: Date }) => Promise<void>;
  now?: Date;
  eraseIdentity?: IdentityEraser;
}): Promise<ErasureReplay> {
  const now = input.now ?? new Date();
  const db = appDatabase();
  const present = new Set((await listOrganizationsIncludingClosed(db)).map((organization) => organization.id));
  const replayed: string[] = [];
  for (const trace of input.traces) {
    if (!trace.erasedAt || !present.has(trace.organizationId) || replayed.includes(trace.organizationId)) continue;
    await input.restoreClosure(trace);
    await eraseClosedOrganization({ organizationId: trace.organizationId, now, eraseIdentity: input.eraseIdentity ?? providerEraser(), replay: true });
    replayed.push(trace.organizationId);
  }
  return { replayed };
}

export function scheduleOrganizationClosures(): void {
  let running = false;
  const run = () => {
    if (running) return;
    running = true;
    runOrganizationClosuresOnce()
      .catch((error: unknown) => {
        console.error("fermetures d'espaces : passage échoué", error instanceof Error ? error.message : error);
      })
      .finally(() => {
        running = false;
      });
  };
  run();
  setInterval(run, INTERVAL_MS).unref();
}
