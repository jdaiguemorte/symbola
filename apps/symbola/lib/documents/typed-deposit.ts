// Lot 63c (DOC-01, BUD-04 ; maquette M8) — déposer une pièce au bon endroit. La zone de dépôt des
// documents demande ce qu'elle est (devis d'un prestataire, facture d'un prestataire, contrat,
// autre) et, pour une pièce d'un prestataire, lequel :
// - avec le module Budget et un prestataire de l'évènement, la pièce se rattache à sa ligne du budget
//   (pièce de ligne, avec sa nature : budget_line_attachments) ; la ligne est créée si le poste n'en
//   a pas encore ;
// - sinon, elle va dans le dossier de son type (créé s'il manque, nom tiré du fichier de données),
//   ou, pour « autre », dans le dossier choisi ou « Divers ».
// Chaque module garde ses pièces (ARC-01) : l'app passe par leurs service.ts.
import { addBudgetLine, attachBudgetLineQuote, listBudgetLines, updateBudgetLineDetails } from "@/modules/budget/service";
import { attachEventDocument, ensureTypedDocumentFolder, EventNotFoundError, listEventVendorSlots, listVendorCandidates } from "@/modules/events/service";
import { isBudgetModuleEnabled } from "@/app/budget/module-access";

export const DEPOSIT_KINDS = ["vendor_quotes", "vendor_invoices", "contracts", "other"] as const;
export type DepositKind = (typeof DEPOSIT_KINDS)[number];

const BUDGET_KIND = { vendor_quotes: "quote", vendor_invoices: "invoice", contracts: "contract" } as const;

export function depositKindOf(value: string): DepositKind {
  return (DEPOSIT_KINDS as readonly string[]).includes(value) ? (value as DepositKind) : "other";
}

export type DepositResult = { destination: "budget_line"; lineId: string; lineLabel: string } | { destination: "folder"; folderId: string | null };

export async function depositTypedDocument(input: {
  organizationId: string;
  userId: string;
  eventId: string;
  locale: "fr" | "en";
  kind: DepositKind;
  candidateId: string | null;
  folderId: string | null;
  label: string;
  content: Uint8Array;
}): Promise<DepositResult> {
  const { organizationId, eventId } = input;
  if (input.kind !== "other" && input.candidateId && (await isBudgetModuleEnabled(organizationId))) {
    // Le prestataire doit être de cet évènement (un identifiant d'ailleurs est refusé, sans le dire).
    const candidate = (await listVendorCandidates(organizationId, eventId)).find((entry) => entry.id === input.candidateId);
    if (!candidate) throw new EventNotFoundError();
    let lines = (await listBudgetLines(organizationId, eventId)).lines;
    let line = lines.find((entry) => entry.vendorCandidateId === candidate.id) ?? lines.find((entry) => entry.eventVendorSlotId === candidate.vendorSlotId);
    if (!line) {
      const slot = (await listEventVendorSlots(organizationId, eventId)).find((entry) => entry.id === candidate.vendorSlotId);
      if (!slot) throw new EventNotFoundError();
      lines = (await addBudgetLine({ organizationId, eventId, eventVendorSlotId: slot.id, label: slot.label, vendorCandidateId: candidate.id })).lines;
      line = lines.find((entry) => entry.vendorCandidateId === candidate.id);
      if (!line) throw new EventNotFoundError();
    }
    // La ligne du poste sans prestataire prend celui de la pièce : son nom s'affiche sur la ligne.
    if (line.vendorCandidateId === null) await updateBudgetLineDetails({ organizationId, eventId, lineId: line.id, vendorCandidateId: candidate.id });
    await attachBudgetLineQuote({ organizationId, eventId, lineId: line.id, kind: BUDGET_KIND[input.kind], content: input.content, uploadedByUserId: input.userId });
    return { destination: "budget_line", lineId: line.id, lineLabel: line.label };
  }
  const folderId = input.kind === "other" ? input.folderId : await ensureTypedDocumentFolder(organizationId, eventId, input.locale, input.kind);
  await attachEventDocument({ organizationId, eventId, label: input.label, content: input.content, uploadedByUserId: input.userId, folderId });
  return { destination: "folder", folderId };
}
