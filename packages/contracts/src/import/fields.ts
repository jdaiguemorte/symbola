// Lot 5 (IMP-02) — champs que chaque module accepte à l'import, par type
// d'éléments (ADR 0022). Contrat interne : l'écran de correspondance des
// colonnes (hub) propose ces champs, la fonction d'import du module (IMP-05)
// les reçoit. Les intitulés affichés sont dans les traductions
// (Import.field.<clé>), les synonymes de colonnes dans
// packages/starter-templates (import-synonyms.json) — jamais ici.

export const IMPORT_ENTITY_TYPES = [
  "events",
  "tasks",
  "budget_lines",
  "catalog_items",
  "vendor_slots",
  "prospect_sources",
  "loss_reasons",
  "payment_methods",
] as const;
export type ImportEntityType = (typeof IMPORT_ENTITY_TYPES)[number];

// Type de valeur attendu, qui guide aussi la reconnaissance par le contenu.
// `choice` : une valeur parmi `choices`, reconnue par les synonymes de
// valeurs (« Confirmé », « signé » → confirmed).
export type ImportFieldKind = "text" | "date" | "amount" | "percentage" | "boolean" | "choice";

export type ImportFieldDefinition = {
  key: string;
  kind: ImportFieldKind;
  required?: true;
  choices?: readonly string[];
};

// Une tâche ou une ligne de budget se rattache à un événement existant par
// ses clients et sa date (décision 2 du lot 5).
const EVENT_REFERENCE: ImportFieldDefinition[] = [
  { key: "eventDate", kind: "date" },
  { key: "client1FirstName", kind: "text" },
  { key: "client1LastName", kind: "text" },
  { key: "client2FirstName", kind: "text" },
  { key: "client2LastName", kind: "text" },
];

const LIST_LABEL: ImportFieldDefinition[] = [{ key: "label", kind: "text", required: true }];

export const EVENT_STATUS_CHOICES = ["prospect", "quote_sent", "confirmed", "done", "lost"] as const;
export const TASK_RESPONSIBLE_CHOICES = ["planner", "clients"] as const;

export const IMPORT_FIELDS: Record<ImportEntityType, readonly ImportFieldDefinition[]> = {
  events: [
    { key: "client1FirstName", kind: "text", required: true },
    { key: "client1LastName", kind: "text" },
    { key: "client2FirstName", kind: "text" },
    { key: "client2LastName", kind: "text" },
    { key: "eventDate", kind: "date" },
    { key: "venueName", kind: "text" },
    { key: "venueCity", kind: "text" },
    { key: "prospectSource", kind: "text" },
    { key: "status", kind: "choice", choices: EVENT_STATUS_CHOICES },
  ],
  tasks: [
    ...EVENT_REFERENCE,
    { key: "label", kind: "text", required: true },
    { key: "dueDate", kind: "date", required: true },
    { key: "responsible", kind: "choice", choices: TASK_RESPONSIBLE_CHOICES },
    { key: "done", kind: "boolean" },
  ],
  budget_lines: [
    ...EVENT_REFERENCE,
    { key: "slotLabel", kind: "text", required: true },
    { key: "vendorName", kind: "text" },
    { key: "plannedAmount", kind: "amount", required: true },
    { key: "actualAmount", kind: "amount" },
  ],
  catalog_items: [
    { key: "label", kind: "text", required: true },
    { key: "description", kind: "text" },
    { key: "unit", kind: "text", required: true },
    { key: "unitPrice", kind: "amount", required: true },
    { key: "vatRate", kind: "percentage" },
    { key: "category", kind: "text" },
  ],
  vendor_slots: LIST_LABEL,
  prospect_sources: LIST_LABEL,
  loss_reasons: LIST_LABEL,
  payment_methods: LIST_LABEL,
};
