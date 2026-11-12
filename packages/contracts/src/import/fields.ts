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
  "vendors",
  "event_sheets",
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
    // Lot 28b (BUD-01, Q33) : plusieurs lignes par catégorie (poste).
    { key: "lineLabel", kind: "text" },
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
  // Lot 14 (IMP-07) : fiches du carnet de prestataires. Plusieurs numéros
  // dans « phones » : le premier devient le téléphone, les autres vont dans
  // la note ; « criteria » devient des étiquettes, « services » la note.
  vendors: [
    { key: "name", kind: "text", required: true },
    { key: "type", kind: "text" },
    { key: "contactFirstName", kind: "text" },
    { key: "contactLastName", kind: "text" },
    { key: "email", kind: "text" },
    { key: "addressLine", kind: "text" },
    { key: "postalCode", kind: "text" },
    { key: "city", kind: "text" },
    { key: "phones", kind: "text" },
    { key: "website", kind: "text" },
    { key: "instagram", kind: "text" },
    { key: "facebook", kind: "text" },
    { key: "pinterest", kind: "text" },
    { key: "linkedin", kind: "text" },
    { key: "x", kind: "text" },
    { key: "siret", kind: "text" },
    { key: "criteria", kind: "text" },
    { key: "services", kind: "text" },
  ],
  // Lot 14c (IMP-08) : une fiche événement PDF par ligne (colonnes construites
  // par l'app, déjà reconnues). Décision I : coordonnées des clients ;
  // décision J : statut proposé ; décision K : budget souhaité seul.
  event_sheets: [
    ...([1, 2] as const).flatMap((index): ImportFieldDefinition[] => [
      { key: `client${index}FirstName`, kind: "text", ...(index === 1 ? { required: true as const } : {}) },
      { key: `client${index}LastName`, kind: "text" },
      { key: `client${index}Email`, kind: "text" },
      { key: `client${index}Phone`, kind: "text" },
      { key: `client${index}AddressLine`, kind: "text" },
      { key: `client${index}PostalCode`, kind: "text" },
      { key: `client${index}City`, kind: "text" },
    ]),
    { key: "eventDate", kind: "date" },
    { key: "venueName", kind: "text" },
    { key: "places", kind: "text" },
    { key: "status", kind: "choice", choices: EVENT_STATUS_CHOICES },
    { key: "wantedBudget", kind: "amount" },
  ],
};
