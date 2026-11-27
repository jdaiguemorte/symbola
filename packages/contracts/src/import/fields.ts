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
  // Lot 36b (HUB-14, D11) : contacts du hub.
  "contacts",
  // Lot 71a (HUB-14, C-66 ; ADR 0119) : les PDF des prestataires retenus et du programme, au journal
  // commun des imports. Ils passent par l'assistant commun au paquet 71e ; d'ici là, ni l'écran
  // « Importer » ni la route d'envoi ne les acceptent (IMPORT_FILE_ENTITY_TYPES).
  "event_vendors",
  "program",
] as const;
export type ImportEntityType = (typeof IMPORT_ENTITY_TYPES)[number];

// Les sortes que l'assistant commun accepte aujourd'hui depuis un fichier déposé.
const NOT_YET_IN_WIZARD: readonly ImportEntityType[] = ["event_vendors", "program"];
export const IMPORT_FILE_ENTITY_TYPES: readonly ImportEntityType[] = IMPORT_ENTITY_TYPES.filter((type) => !NOT_YET_IN_WIZARD.includes(type));

// Type de valeur attendu, qui guide aussi la reconnaissance par le contenu.
// `choice` : une valeur parmi `choices`, reconnue par les synonymes de
// valeurs (« Confirmé », « signé » → confirmed).
export type ImportFieldKind = "text" | "date" | "amount" | "percentage" | "boolean" | "choice";

export type ImportFieldDefinition = {
  key: string;
  kind: ImportFieldKind;
  required?: true;
  choices?: readonly string[];
  // Lot 67a (HUB-14, BUD-01) : cellule vide = la valeur de la ligne du dessus (poste écrit une seule
  // fois, ou cellule fusionnée), si la ligne porte une autre valeur reconnue.
  carryDown?: true;
};

// Lot 36b (HUB-14) : un champ obligatoire parmi plusieurs (un contact a un nom, de sa colonne ou
// d'une colonne « nom complet ») ; la clé d'erreur nomme le groupe (Import.field.<clé>).
export const IMPORT_REQUIRED_ONE_OF: Partial<Record<ImportEntityType, { errorKey: string; keys: readonly string[] }>> = {
  contacts: { errorKey: "contactName", keys: ["lastFirstName", "firstLastName", "firstName", "lastName"] },
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

// Lot 34a (EVT-05, D2) : statuts du cahier des charges.
// Lot 72a (J1) : « En préparation » retiré ; le mot lu dans un fichier mène à « confirmed » (synonymes).
export const EVENT_STATUS_CHOICES = ["option", "confirmed", "closed", "postponed", "cancelled"] as const;
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
    { key: "slotLabel", kind: "text", required: true, carryDown: true },
    // Lot 28b (BUD-01, Q33) : plusieurs lignes par catégorie (poste).
    { key: "lineLabel", kind: "text" },
    { key: "vendorName", kind: "text" },
    { key: "plannedAmount", kind: "amount", required: true },
    { key: "actualAmount", kind: "amount" },
    // Lot 63b (BUD-01, BUD-03, HUB-14) : le réglé, et un acompte et un solde datés qui deviennent
    // les échéances de la ligne.
    { key: "paidAmount", kind: "amount" },
    { key: "depositAmount", kind: "amount" },
    { key: "depositDueOn", kind: "date" },
    { key: "balanceAmount", kind: "amount" },
    { key: "balanceDueOn", kind: "date" },
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
    // Lot 28c (PRE-01) : évaluation (1 à 5, « 4/5 », étoiles) et tarifs indicatifs.
    { key: "rating", kind: "text" },
    { key: "indicativePrices", kind: "text" },
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
    // Lot 71a (C-56 ; § 5.1) : la note va dans « Notes » ; le total engagé et le réglé vont au total
    // « à répartir » du budget (plus dans « Champs importés »). Le solde se recalcule : non repris.
    { key: "note", kind: "text" },
    { key: "total", kind: "amount" },
    { key: "paid", kind: "amount" },
  ],
  // Lot 36b (HUB-14, D11) : des personnes. Le nom vient d'une colonne pour le prénom et d'une pour
  // le nom, ou d'une seule colonne (« NOM Prénom », « Prénom Nom ») : un mot tout en majuscules y
  // est le nom, sinon l'ordre de la colonne décide. Au moins un nom par ligne (vérifié à la lecture).
  // « notes » devient une note de la fiche.
  // Lot 71a : lus d'un PDF par le moteur d'import (paquet 71e), sans colonnes à faire correspondre.
  event_vendors: [],
  program: [],
  contacts: [
    { key: "lastFirstName", kind: "text" },
    { key: "firstLastName", kind: "text" },
    { key: "firstName", kind: "text" },
    { key: "lastName", kind: "text" },
    { key: "email", kind: "text" },
    { key: "phone", kind: "text" },
    { key: "addressLine", kind: "text" },
    { key: "postalCode", kind: "text" },
    { key: "city", kind: "text" },
    { key: "country", kind: "text" },
    { key: "notes", kind: "text" },
  ],
};
