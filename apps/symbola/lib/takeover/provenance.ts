// Lot 71f (R7, décision I9 ; spécification du lot 71, § 5.6 ; maquette 09, « Informations ») — « D'où
// viennent ces valeurs ? » : à côté de chaque valeur reprise, le fichier dont elle vient (les noms de
// champs du journal, `hub.import_items.fields`, sans aucune valeur) ; « vous, à la reprise » pour ce qui a
// été saisi sur la page de reprise ; rien sur une valeur modifiée depuis à la main. Lu par les services :
// le journal chez le hub, la valeur actuelle chez les évènements.
import type { TakeoverView } from "@symbola/contracts";
import { unchangedImportedEventFields } from "@/modules/events/service";
import { listElementProvenance } from "@/modules/hub/service";

// Les lignes de « Informations » qu'une valeur reprise peut remplir.
export const PROVENANCE_ROWS = ["clients", "places", "notes", "guests", "style"] as const;
export type ProvenanceRow = (typeof PROVENANCE_ROWS)[number];

export type ProvenanceSource = { kind: "file"; fileName: string } | { kind: "you" };

// Les champs écrits par un import d'évènement, et la ligne d'« Informations » qu'ils remplissent.
const FIELD_ROWS: Record<string, ProvenanceRow> = {
  clients: "clients",
  venueName: "places",
  venueCity: "places",
  places: "places",
  notes: "notes",
  guestsEstimated: "guests",
  style: "style",
};

export function provenanceRowOf(field: string): ProvenanceRow | null {
  return FIELD_ROWS[field] ?? null;
}

// Les sources de chaque ligne, du dernier import qui l'a écrite (une valeur réécrite par un second
// fichier porte le nom du second).
export function provenanceRows(entries: readonly { fileName: string; fields: readonly string[] }[], typedByHand: boolean): Partial<Record<ProvenanceRow, ProvenanceSource>> {
  const rows: Partial<Record<ProvenanceRow, ProvenanceSource>> = {};
  // Le mariage saisi sur la page de reprise : ses noms (les mariés) viennent de la planner.
  if (typedByHand) rows.clients = { kind: "you" };
  for (const entry of entries) {
    for (const field of entry.fields) {
      const row = provenanceRowOf(field);
      if (row) rows[row] = { kind: "file", fileName: entry.fileName };
    }
  }
  return rows;
}

export async function loadEventProvenance(organizationId: string, eventId: string, takeover: Pick<TakeoverView, "steps">): Promise<Partial<Record<ProvenanceRow, ProvenanceSource>>> {
  const entries = await listElementProvenance(organizationId, { module: "events", kind: "event", elementId: eventId });
  const kept = [];
  for (const entry of entries) kept.push({ fileName: entry.fileName, fields: await unchangedImportedEventFields(organizationId, eventId, entry.fields, entry.written) });
  const eventStep = takeover.steps.find((step) => step.kind === "event");
  const typedByHand = eventStep?.state === "done" && eventStep.importId === null;
  return provenanceRows(kept, typedByHand);
}
