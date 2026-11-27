// Lot 73b (PRE-01, PRE-05, PRE-11, UX-12 ; spécification du lot 73, § 5.2, critères 2 à 6, 8 et 9 ; P3,
// P13) — les règles pures du carnet : les mots de l'état des pièces (le nom de la pièce en tête, une
// tournure sans accord, lisible sans la couleur ; le rouge pour l'expiré seulement), le tri par colonne et
// son lien, le filtre « Pièces », les pastilles des filtres posés, la phrase « à classer », les
// propositions de l'écran « Classer » et les identifiants de « Revoir ».
import { describe, expect, it } from "vitest";
import type { VendorDocumentState } from "@symbola/contracts";
import { classifyRows, decodeVendorIds, documentStateView, encodeVendorIds, unclassifiedNotice } from "./book-row";
import { activeFilters, clearFiltersHref, effectiveSort, parseBookFilters, sortHref, type ActiveFilterLabels } from "./filters";

const doc = (shortLabel: string | null, label = "Attestation d'assurance responsabilité civile", validUntil: string | null = null) => ({ documentId: "d", kindId: "k", label, shortLabel, validUntil });

describe("PRE-05 — L'état des pièces sur la ligne, en mots (lot 73b, critère 2 ; P3)", () => {
  const view = (state: VendorDocumentState) => documentStateView(state);

  it("« ✓ À jour » : un mot et une forme, sans rouge", () => {
    expect(view({ state: "up_to_date", document: null, othersToSettle: 0, reason: null })).toMatchObject({ tone: "ok", icon: "✓", message: { key: "upToDate" } });
  });

  it("« ! Assurance · à renouveler » : le nom court en tête, la seule tournure rouge, et sa raison", () => {
    const result = view({ state: "expired", document: doc("Assurance", undefined, "2026-11-01"), othersToSettle: 0, reason: { code: "valid_until", date: "2026-11-01", upcomingRetained: 2 } });
    expect(result).toMatchObject({ tone: "late", icon: "!", message: { key: "expired", values: { document: "Assurance" } } });
    expect(result.reason).toEqual({ key: "reasonValidUntilRetained", values: { date: "2026-11-01", count: 2 } });
  });

  it("« ◷ Assurance : expire le 15 déc. » : bientôt, sans rouge ; la raison dit le mariage, ou « avant un mariage » sans accès", () => {
    const soon = view({ state: "expiring", document: doc("Assurance", undefined, "2026-12-15"), othersToSettle: 0, reason: { code: "before_event", eventId: "e", eventDate: "2027-06-12", couple: "Léa & Maxime" } });
    expect(soon).toMatchObject({ tone: "soon", icon: "◷", message: { key: "expiring", values: { document: "Assurance", date: "2026-12-15" } }, reason: { key: "reasonBeforeEvent", values: { couple: "Léa & Maxime" } } });
    const hidden = view({ state: "expiring", document: doc("Assurance", undefined, "2026-12-15"), othersToSettle: 0, reason: { code: "before_event", eventId: "e", eventDate: "2027-06-12", couple: null } });
    expect(hidden.reason).toEqual({ key: "reasonBeforeAnEvent", values: {} });
  });

  it("« Kbis · à recevoir » et « Kbis · à vérifier » : sans accord, sans rouge", () => {
    const kbis = doc("Kbis", "Extrait Kbis ou avis de situation Insee");
    expect(view({ state: "requested", document: kbis, othersToSettle: 0, reason: { code: "requested_on", date: "2026-11-02" } })).toMatchObject({ tone: "todo", message: { key: "requested", values: { document: "Kbis" } }, reason: { key: "reasonRequestedOn", values: { date: "2026-11-02" } } });
    expect(view({ state: "to_verify", document: kbis, othersToSettle: 0, reason: { code: "uploaded_by_link", at: "2026-11-20T09:00:00.000Z" } })).toMatchObject({ tone: "todo", message: { key: "toVerify", values: { document: "Kbis" } }, reason: { key: "reasonUploadedByLink", values: { date: "2026-11-20T09:00:00.000Z" } } });
  });

  it("sans nom court, le libellé complet ; « + 1 » quand une autre pièce est à régler", () => {
    const result = view({ state: "requested", document: doc(null, "Plan du lieu"), othersToSettle: 1, reason: { code: "requested_on", date: null } });
    expect(result.message.values).toEqual({ document: "Plan du lieu" });
    expect(result.more).toBe(1);
    expect(result.reason).toBeNull();
  });

  it("« Aucune pièce demandée » n'est jamais « À jour »", () => {
    expect(view({ state: "none_requested", document: null, othersToSettle: 0, reason: null })).toMatchObject({ tone: "none", icon: null, message: { key: "noneRequested" } });
  });
});

describe("UX-12, PRE-01 — Le tri par colonne, dans l'adresse (lot 73b, critère 3)", () => {
  it("« tri » et « sens » inconnus sont ignorés sans erreur", () => {
    const filters = parseBookFilters({ tri: "salaire", sens: "n'importe", pieces: "tout-et-rien" }, []);
    expect(filters.sort).toBeNull();
    expect(filters.direction).toBeNull();
    expect(filters.documents).toBeNull();
  });

  it("sans tri choisi : par nom, ou par distance quand un lieu est posé (critère 6)", () => {
    expect(effectiveSort(parseBookFilters({}, []), false)).toEqual({ sort: "name", direction: "asc", natural: true });
    expect(effectiveSort(parseBookFilters({}, []), true)).toEqual({ sort: "distance", direction: "asc", natural: true });
    // « Pièces à régler » : ce qui presse d'abord (critère 4).
    expect(effectiveSort(parseBookFilters({ pieces: "a-regler" }, []), false)).toEqual({ sort: "documents", direction: "asc", natural: true });
    // La distance sans lieu trie par nom.
    expect(effectiveSort(parseBookFilters({ tri: "distance" }, []), false).sort).toBe("name");
  });

  it("chaque en-tête trie dans son sens naturel, puis à l'inverse au second clic", () => {
    const first = new URLSearchParams(sortHref("/prestataires", { q: "fleur" }, parseBookFilters({ q: "fleur" }, []), false, "rating").split("?")[1]);
    expect(Object.fromEntries(first)).toEqual({ q: "fleur", tri: "evaluation" });
    expect(effectiveSort(parseBookFilters({ tri: "evaluation" }, []), false)).toEqual({ sort: "rating", direction: "desc", natural: true });
    const second = new URLSearchParams(sortHref("/prestataires", { tri: "evaluation" }, parseBookFilters({ tri: "evaluation" }, []), false, "rating").split("?")[1]);
    expect(Object.fromEntries(second)).toEqual({ tri: "evaluation", sens: "asc" });
    expect(effectiveSort(parseBookFilters({ tri: "evaluation", sens: "asc" }, []), false)).toEqual({ sort: "rating", direction: "asc", natural: false });
    // « Avec vous » : du plus au moins d'abord.
    expect(effectiveSort(parseBookFilters({ tri: "avec-vous" }, []), false)).toEqual({ sort: "worked_with", direction: "asc", natural: true });
  });
});

const TAG = "11111111-1111-4111-8111-111111111111";
const FAMILY = "22222222-2222-4222-8222-222222222222";
const labels: ActiveFilterLabels = {
  text: (text) => `« ${text} »`,
  around: (place, km) => `Autour de ${place}, ${km} km`,
  workedWith: "Déjà travaillé ensemble",
  rating: (rating) => `Au moins ${rating} sur 5`,
  unplaced: "À placer",
  tag: (tagId) => (tagId === TAG ? "Bohème" : null),
  field: () => null,
  family: (familyId) => (familyId === FAMILY ? "Fleurs et décoration" : null),
  type: () => null,
  unclassified: "À classer",
  documents: (filter) => (filter === "up_to_date" ? "Pièces à jour" : `Pièces : ${filter}`),
};

describe("PRE-11, UX-12 — Pastilles qui s'enlèvent, « Effacer les filtres » (lot 73b, critère 5)", () => {
  const query = { famille: FAMILY, vue: "carte", autour: "Poitiers", rayon: "30", pieces: "a-jour", tri: "nom" };
  const filters = parseBookFilters(query, []);

  it("la famille, le lieu et les pièces posés sont chacun une pastille, dont le lien le retire seul", () => {
    const chips = activeFilters("/prestataires", query, filters, labels);
    expect(chips.map((chip) => chip.label)).toEqual(["Fleurs et décoration", "Autour de Poitiers, 30 km", "Pièces à jour"]);
    const family = new URLSearchParams(chips[0]!.href.split("?")[1]);
    expect(family.has("famille")).toBe(false);
    expect(family.get("pieces")).toBe("a-jour");
  });

  it("« Effacer les filtres » retire tous les filtres, et garde la vue et le tri", () => {
    const params = new URLSearchParams(clearFiltersHref("/prestataires", query, filters).split("?")[1]);
    expect(Object.fromEntries(params)).toEqual({ vue: "carte", tri: "nom" });
  });

  it("le filtre « Pièces » se lit dans l'adresse : « a-regler » donne « à régler »", () => {
    expect(parseBookFilters({ pieces: "a-regler" }, []).documents).toBe("to_settle");
    expect(parseBookFilters({ pieces: "a-renouveler" }, []).documents).toBe("expired_or_soon");
  });

  it("le rayon : 30 km est un choix ; le rayon sans lieu n'est pas un filtre", () => {
    expect(parseBookFilters({ autour: "Poitiers", rayon: "30" }, []).radiusKm).toBe(30);
    expect(activeFilters("/prestataires", { rayon: "50" }, parseBookFilters({ rayon: "50" }, []), labels)).toEqual([]);
  });
});

describe("HUB-14, PRE-01 — La phrase « à classer » (lot 73b, critère 8)", () => {
  it("dit la raison de l'import quand le fichier n'avait pas de colonne « métier », sinon le nombre seul", () => {
    expect(unclassifiedNotice({ count: 37, importWithoutTradeColumn: true })).toEqual({ key: "unclassifiedFromImport", count: 37 });
    expect(unclassifiedNotice({ count: 4, importWithoutTradeColumn: false })).toEqual({ key: "unclassifiedPlain", count: 4 });
    expect(unclassifiedNotice({ count: 0, importWithoutTradeColumn: true })).toBeNull();
  });
});

describe("HUB-14, PRE-01 — L'écran « Classer » propose un métier d'après le nom (lot 73b, critère 9)", () => {
  const types = [
    { id: "t-traiteur", label: "Traiteur", starterKey: "caterer" },
    { id: "t-caleche", label: "Calèche et attelage", starterKey: "carriage" },
    { id: "t-lieu", label: "Lieu de réception", starterKey: "venue" },
  ];
  const synonyms = [
    { key: "carriage", fr: ["Calèche"], en: ["Carriage"] },
    { key: "venue", fr: ["Domaine", "Château"], en: ["Venue"] },
  ];
  const vendors = [
    { id: "v1", name: "Belle Époque Traiteur", city: "Angoulême", typeIds: [] },
    { id: "v2", name: "Bulles & Cie", city: null, typeIds: [] },
    { id: "v3", name: "Calèches du Marais", city: "Niort", typeIds: [] },
    { id: "v4", name: "Domaine de la Brousse", city: "Ruffec", typeIds: [] },
  ];

  it("chaque fiche dont le nom le permet a sa proposition et le mot qui l'a fait proposer ; les autres « Choisir un métier »", () => {
    const result = classifyRows(vendors, types, synonyms, { withoutFirst: false });
    expect(result.proposed).toBe(3);
    expect(result.withoutProposal).toBe(1);
    expect(result.rows.map((row) => [row.id, row.proposal?.typeId ?? null, row.proposal?.word ?? null])).toEqual([
      ["v1", "t-traiteur", "Traiteur"],
      ["v2", null, null],
      ["v3", "t-caleche", "Calèches"],
      ["v4", "t-lieu", "Domaine"],
    ]);
  });

  it("« Afficher d'abord les N sans proposition »", () => {
    expect(classifyRows(vendors, types, synonyms, { withoutFirst: true }).rows.map((row) => row.id)).toEqual(["v2", "v1", "v3", "v4"]);
  });

  it("« Revoir » : une fiche déjà classée montre son métier enregistré, sans proposition", () => {
    const result = classifyRows([{ id: "v1", name: "Belle Époque Traiteur", city: null, typeIds: ["t-lieu"] }], types, synonyms, { withoutFirst: false });
    expect(result.rows[0]).toMatchObject({ savedTypeId: "t-lieu", proposal: null });
  });
});

describe("PRE-01 — « Revoir » : les identifiants passent à l'écran, jamais un nom (lot 73b, P13)", () => {
  it("les identifiants se codent et se relisent ; un code abîmé ne rend rien", () => {
    const ids = ["0b6c7b52-9a1e-4c2f-8d3e-5f6a7b8c9d0e", "ffffffff-ffff-4fff-bfff-ffffffffffff"];
    const code = encodeVendorIds(ids);
    expect(code).toMatch(/^[A-Za-z0-9_.-]+$/);
    expect(code.length).toBeLessThan(ids.join(",").length);
    expect(decodeVendorIds(code)).toEqual(ids);
    expect(decodeVendorIds("%%%")).toEqual([]);
    expect(decodeVendorIds("")).toEqual([]);
  });
});
