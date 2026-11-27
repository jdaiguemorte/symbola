// Lot 73b (PRE-01, HUB-14 ; spécification du lot 73, § 5.2 ; maquette 18, « Un carnet tout juste importé »)
// — le dernier import d'un carnet, pour l'en-tête (« 37 importées le 24 nov. de « carnet.xlsx » ») et la
// raison de la phrase « à classer » (« Votre fichier n'avait pas de colonne « métier » »). Lu par la porte
// d'entrée du hub et celle du module « Prestataires », dans l'organisation.
//
// Le fichier « n'avait pas de colonne métier » quand aucune des fiches créées par cet import n'a reçu de
// métier à l'import : l'étape « Types » range chaque métier reconnu, une seule fiche classée suffit à dire
// que le fichier en avait une.
import { appDatabase } from "@symbola/db/client";
import { getAppliedImport, listImports } from "@/modules/hub/service";
import { getVendorsByIds } from "@/modules/vendors/service";

export type LatestBookImport = { fileName: string; appliedAt: Date; created: number; withoutTradeColumn: boolean };

export async function latestBookImport(organizationId: string): Promise<LatestBookImport | null> {
  const db = appDatabase();
  const latest = (await listImports(db, organizationId))
    .filter((entry) => entry.entityType === "vendors" && entry.appliedAt && !entry.undoneAt)
    .sort((a, b) => b.appliedAt!.getTime() - a.appliedAt!.getTime())[0];
  if (!latest?.appliedAt) return null;
  const view = await getAppliedImport(db, organizationId, latest.id);
  const createdIds = [...new Set((view?.items ?? []).filter((item) => item.kind === "vendor" && item.action === "created" && item.undoOutcome !== "undone" && item.undoOutcome !== "missing").map((item) => item.elementId))];
  if (createdIds.length === 0) return null;
  const created = await getVendorsByIds(organizationId, createdIds);
  return { fileName: latest.fileName, appliedAt: latest.appliedAt, created: created.length, withoutTradeColumn: created.length > 0 && created.every((vendor) => vendor.typeIds.length === 0) };
}
