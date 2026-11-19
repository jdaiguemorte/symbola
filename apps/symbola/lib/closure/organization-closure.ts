// Lot 35c (RGP-11 ; décision D8 de Julien du 18/11/2026 : tout est effacé au 30e jour ; ADR 0100) —
// effacement d'un espace fermé, à sa date de suppression. Les modules ne se connaissent que par leur
// service.ts (ADR 0011) : l'orchestration vit ici.
// 1. Les clés des fichiers de l'organisation sont relevées (lignes qui en portent, et préfixes du
//    stockage qui lui sont propres).
// 2. Une seule transaction : chaque module efface ses lignes par sa porte (la base refuse avant la
//    date de suppression), le hub en dernier (journal, organisation, comptes sans autre adhésion).
// 3. La trace est mise à jour (sans donnée personnelle), puis les fichiers sont effacés, puis les
//    comptes chez le fournisseur d'identité. Un fichier qui résiste est repris au passage suivant.
import { SYSTEM_ACTOR, withActor } from "@symbola/db/actor";
import { appDatabase } from "@symbola/db/client";
import { withOrganization } from "@symbola/db/with-organization";
import { createStorageClient, deletePrivateObject, listPrivateObjectKeys } from "@symbola/files";
import { eraseAppointmentsData } from "@/modules/appointments/service";
import { eraseBudgetData } from "@/modules/budget/service";
import { eraseEventsData } from "@/modules/events/service";
import { eraseGuestsData } from "@/modules/guests/service";
import { eraseHubData, getOrganizationClosure, recordClosureFilesErased, recordOrganizationErasure } from "@/modules/hub/service";
import { eraseQuotesData } from "@/modules/quotes/service";
import { eraseVendorsData } from "@/modules/vendors/service";
import { collectOrganizationData } from "@/lib/export/organization-export";

// Préfixes du stockage propres à une organisation (envois, imports, exports, reprises, exports RGPD).
export function organizationStoragePrefixes(organizationId: string): string[] {
  return [`${organizationId}/`, `imports/${organizationId}/`, `organization-exports/${organizationId}/`, `organization-imports/${organizationId}/`, `privacy-exports/${organizationId}/`];
}

// Efface un compte chez le fournisseur d'identité (tests : un faux).
export type IdentityEraser = (subject: string) => Promise<void>;

export class OrganizationNotDueError extends Error {}

export type OrganizationErasure = { rows: number; files: number; identities: number };

async function organizationFileKeys(organizationId: string): Promise<string[]> {
  const storage = createStorageClient();
  const referenced = (await collectOrganizationData(organizationId)).flatMap((module) => module.files.map((file) => file.storageKey));
  const prefixed = (await Promise.all(organizationStoragePrefixes(organizationId).map((prefix) => listPrivateObjectKeys(storage, prefix)))).flat();
  return [...new Set([...referenced, ...prefixed])];
}

async function eraseFiles(keys: readonly string[]): Promise<number> {
  const storage = createStorageClient();
  let erased = 0;
  for (const key of keys) {
    await deletePrivateObject(storage, key);
    erased += 1;
  }
  return erased;
}

export async function eraseClosedOrganization(input: { organizationId: string; now?: Date; eraseIdentity?: IdentityEraser; replay?: boolean }): Promise<OrganizationErasure> {
  const now = input.now ?? new Date();
  const db = appDatabase();
  const closure = await getOrganizationClosure(db, input.organizationId);
  if (!closure || now < closure.deletionDueAt) throw new OrganizationNotDueError();
  const keys = await organizationFileKeys(input.organizationId);
  const { rows, subjects } = await withActor(SYSTEM_ACTOR, () =>
    withOrganization(db, input.organizationId, async (tx) => {
      let erased = 0;
      // Les modules d'abord (dans l'ordre inverse de l'export), le hub en dernier.
      for (const eraseModule of [eraseAppointmentsData, eraseGuestsData, eraseVendorsData, eraseQuotesData, eraseBudgetData, eraseEventsData]) erased += await eraseModule(tx, input.organizationId);
      const hub = await eraseHubData(tx, input.organizationId);
      return { rows: erased + hub.rows, subjects: hub.identitySubjects };
    }),
  );
  await recordOrganizationErasure(db, { organizationId: input.organizationId, rows, now, ...(input.replay ? { replay: true } : {}) });
  const files = await eraseFiles(keys);
  await recordClosureFilesErased(db, { organizationId: input.organizationId, files, now });
  let identities = 0;
  for (const subject of subjects) {
    try {
      await input.eraseIdentity?.(subject);
      identities += 1;
    } catch (error) {
      // Le compte n'existe plus chez Symbola ; l'Exploitation le reprend à la main (runbook).
      console.error("effacement d'un compte chez le fournisseur d'identité échoué", { organizationId: input.organizationId, error: error instanceof Error ? error.name : "inconnue" });
    }
  }
  return { rows, files, identities };
}

// Fichiers d'un espace déjà effacé (passage interrompu) : les préfixes qui lui sont propres.
export async function eraseRemainingFiles(organizationId: string, now: Date = new Date()): Promise<number> {
  const storage = createStorageClient();
  const keys = (await Promise.all(organizationStoragePrefixes(organizationId).map((prefix) => listPrivateObjectKeys(storage, prefix)))).flat();
  const files = await eraseFiles(keys);
  await recordClosureFilesErased(appDatabase(), { organizationId, files, now });
  return files;
}
