// Lot 39c (RGP-04 ; D14) — chaque champ libre déclaré « contenu_libre » au registre a, à l'écran où il
// se saisit, la mise en garde juste après lui (FreeTextNotice) ; un champ sans saisie libre à l'écran
// a sa raison écrite ici. Un nouveau champ libre au registre fait échouer ce test tant qu'il n'est
// pas rangé.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const REGISTRY = fileURLToPath(new URL("../../../privacy.registry.yaml", import.meta.url));

// Champ du registre → formulaire (fichier, nom du champ) où il se saisit.
const NOTICED: Record<string, { file: string; name: string }> = {
  "events.events.style": { file: "app/events/[id]/client-contact-forms.tsx", name: "style" },
  "events.events.notes": { file: "app/events/[id]/client-contact-forms.tsx", name: "notes" },
  "events.program_items.internal_note": { file: "app/events/[id]/program-forms.tsx", name: "internalNote" },
  "events.event_decisions.note": { file: "app/events/[id]/decision-forms.tsx", name: "note" },
  "budget.vendor_payments.refusal_reason": { file: "app/budget/[eventId]/declaration-refusal-form.tsx", name: "reason" },
  "vendors.vendors.internal_note": { file: "app/prestataires/vendor-form.tsx", name: "internalNote" },
  "events.event_vendor_candidate_notes.body": { file: "app/events/[id]/vendor-candidates.tsx", name: "body" },
  "events.event_vendor_slots.brief": { file: "app/events/[id]/vendor-candidates.tsx", name: "brief" },
  "events.event_task_comments.body": { file: "app/events/[id]/task-extra-forms.tsx", name: "body" },
  "hub.privacy_requests.extension_reason": { file: "app/rgpd/demandes/request-forms.tsx", name: "reason" },
  "quotes.payment_entries.reason": { file: "app/devis/[quoteId]/schedule-forms.tsx", name: "reason" },
};

// Aussi mis en garde, bien que rangés autrement au registre : la note d'un contact, le motif d'une perte.
const ALSO_NOTICED = [
  { file: "app/contacts/contact-forms.tsx", name: "body" },
  { file: "app/events/[id]/change-status-form.tsx", name: "lossReasonNote" },
];

const WITHOUT_ENTRY: Record<string, string> = {
  "hub.privacy_purges.lines": "relevé écrit par l'app à la purge, sans saisie",
  "events.events.imported_fields": "valeurs reprises d'un fichier importé, sans saisie à l'écran",
  "events.event_tasks.imported_fields": "valeurs reprises d'un fichier importé, sans saisie à l'écran",
  "events.event_vendor_slots.imported_fields": "valeurs reprises d'un fichier importé, sans saisie à l'écran",
  "quotes.catalog_items.imported_fields": "valeurs reprises d'un fichier importé, sans saisie à l'écran",
  "vendors.vendors.imported_fields": "valeurs reprises d'un fichier importé, sans saisie à l'écran",
  "events.program_versions.items": "copie figée du programme diffusé, sans saisie",
  "events.event_activities.task_label": "copie de l'intitulé d'une tâche, écrite par l'app",
  "hub.form_drafts.content": "brouillon : la mise en garde est sous le champ d'origine",
  "hub.jobs.payload": "e-mail en attente d'envoi : composé par Symbola à partir de champs qui portent déjà leur mise en garde",
  "budget.budget_lines.label": "libellé court d'une ligne de budget (nom d'une prestation)",
  "budget.vendor_payments.label": "libellé court d'un paiement (« Acompte », « Solde »)",
  "events.event_day_contacts.role": "rôle court d'un contact du jour J",
  "events.event_documents.label": "intitulé court d'un document",
  "events.event_document_folders.name": "nom court d'un dossier",
  "events.event_task_attachments.label": "intitulé court d'une pièce jointe",
  "events.event_documents.file_key": "fichier déposé, sans champ de texte",
  "events.event_document_versions.file_key": "fichier déposé, sans champ de texte",
  "budget.budget_line_attachments.file_key": "fichier déposé, sans champ de texte",
  "vendors.vendor_files.file_key": "fichier déposé, sans champ de texte",
  "events.event_task_attachments.file_key": "fichier déposé, sans champ de texte",
  "quotes.quote_lines.description": "texte du devis, lu par le client : il décrit une prestation",
  "quotes.contracts.clauses": "clauses du contrat, texte juridique écrit par la planner",
  "vendors.vendors.rating": "note de 1 à 5, sans texte",
  "vendors.vendors.indicative_prices": "tarifs indicatifs du prestataire",
  "vendors.vendors.field_values": "valeurs des champs propres au type de prestataire",
  "events.event_decisions.comment": "réponse du client sur son portail ; la mise en garde s'adresse à l'équipe",
};

function freeTextFields(): string[] {
  const text = readFileSync(REGISTRY, "utf8");
  return text
    .split(/\n  - schema: /)
    .slice(1)
    .filter((entry) => /category: contenu_libre/.test(entry))
    .map((entry) => `${entry.split("\n")[0]!.trim()}.${/table: (\S+)/.exec(entry)![1]}.${/field: (\S+)/.exec(entry)![1]}`);
}

function expectNoticeAfter(file: string, name: string) {
  const source = readFileSync(`${ROOT}${file}`, "utf8");
  const at = source.indexOf(`name="${name}"`);
  expect(at, `${file} : champ « ${name} » introuvable`).toBeGreaterThanOrEqual(0);
  expect(source.slice(at, at + 700), `${file} : pas de mise en garde après « ${name} »`).toContain("<FreeTextNotice");
}

describe("RGP-04 — Les champs libres portent une mise en garde", () => {
  it("chaque champ libre du registre a sa mise en garde à l'écran, ou la raison écrite de ne pas en avoir", () => {
    const unsorted = freeTextFields().filter((field) => !(field in NOTICED) && !(field in WITHOUT_ENTRY));
    expect(unsorted).toEqual([]);
  });

  it("la mise en garde suit son champ, dans le formulaire où il se saisit", () => {
    for (const { file, name } of [...Object.values(NOTICED), ...ALSO_NOTICED]) expectNoticeAfter(file, name);
  });
});
