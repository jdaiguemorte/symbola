// Lot 73c (PRE-02, UX-07 ; spécification du lot 73, § 5.3, critères 1, 2, 4, 6 et 7 ; P12, M13) — la
// fenêtre « Ajouter à un mariage… » et le panneau du poste, côté calcul (aucun écran, aucune base).
import { describe, expect, it } from "vitest";
import {
  additionFeedback,
  allowedModes,
  footerFor,
  initialAdditionForm,
  NEW_SLOT,
  panelGroups,
  panelRowState,
  planAddition,
  slotOptions,
  withEvent,
  type AdditionChoices,
} from "./add-to-event-model";

const choices = (overrides: Partial<AdditionChoices> = {}): AdditionChoices => ({
  vendors: [{ id: "v1", name: "Les Fleurs du Causse" }],
  tradeLabel: "Fleuriste",
  events: [
    {
      eventId: "e1",
      label: "Léa & Maxime",
      eventDate: "2027-06-12",
      status: "confirmed",
      proposedSlotId: "s-fleurs",
      documentWarning: null,
      slots: [
        { id: "s-traiteur", label: "Traiteur", comparingCount: 0, retained: [{ candidateId: "c1", vendorName: "Maison Haddad" }] },
        { id: "s-fleurs", label: "Fleurs et décoration", comparingCount: 2, retained: [] },
      ],
    },
    {
      eventId: "e2",
      label: "Inès & Sacha",
      eventDate: "2027-09-04",
      status: "option",
      proposedSlotId: null,
      documentWarning: { label: "Assurance", validUntil: "2027-08-31" },
      slots: [{ id: "s-dj", label: "DJ", comparingCount: 0, retained: [] }],
    },
  ],
  ...overrides,
});

describe("PRE-02 — La fenêtre « Ajouter à un mariage… » (lot 73c, critères 1, 2, 4 et 6)", () => {
  it("critère 1 — rien n'est coché d'avance ; « Ajouter au mariage » sans réponse à « Comment l'ajouter ? » ne part pas et le dit", () => {
    const form = initialAdditionForm(choices());
    expect(form.mode).toBeNull();
    expect(planAddition(form, choices(), "add")).toEqual({ ok: false, errors: ["mode"] });
  });

  it("critère 2 — le mariage le plus proche est choisi, et son poste proposé d'après le métier principal ; il reste un choix", () => {
    const form = initialAdditionForm(choices());
    expect(form).toMatchObject({ eventId: "e1", slot: "s-fleurs" });
    const options = slotOptions(choices().events[0]!, "Fleuriste");
    expect(options.map((option) => [option.value, option.proposed])).toEqual([
      ["s-traiteur", false],
      ["s-fleurs", true],
      [NEW_SLOT, false],
    ]);
    const other = { ...form, slot: "s-traiteur", mode: "compare" as const };
    expect(planAddition(other, choices(), "add")).toEqual({ ok: true, request: { eventId: "e1", slotId: "s-traiteur", vendorIds: ["v1"], mode: "compare" } });
  });

  it("critère 2 — sans correspondance, aucun poste n'est choisi et « Nouveau poste « métier » » vient en tête ; il crée le poste dans la même opération", () => {
    const form = withEvent(initialAdditionForm(choices()), choices(), "e2");
    expect(form.slot).toBeNull();
    expect(form.newSlotLabel).toBe("Fleuriste");
    expect(slotOptions(choices().events[1]!, "Fleuriste").map((option) => option.value)).toEqual([NEW_SLOT, "s-dj"]);
    expect(planAddition({ ...form, mode: "compare" }, choices(), "add")).toEqual({ ok: false, errors: ["slot"] });
    expect(planAddition({ ...form, slot: NEW_SLOT, mode: "compare" }, choices(), "add")).toEqual({ ok: true, request: { eventId: "e2", newSlotLabel: "Fleuriste", vendorIds: ["v1"], mode: "compare" } });
    expect(planAddition({ ...form, slot: NEW_SLOT, newSlotLabel: "  ", mode: "compare" }, choices(), "add")).toEqual({ ok: false, errors: ["newSlotLabel"] });
  });

  it("une fiche sans métier : rien n'est proposé, « Nouveau poste » reste vide à nommer", () => {
    const form = initialAdditionForm(choices({ tradeLabel: null, events: [{ ...choices().events[0]!, proposedSlotId: null }] }));
    expect(form.slot).toBeNull();
    expect(form.newSlotLabel).toBe("");
  });

  it("critère 4 (P12) — « Retenu » sur un poste déjà pourvu : le pied propose « Remplacer {nom} » puis « Retenir aussi »", () => {
    const form = { ...initialAdditionForm(choices()), slot: "s-traiteur", mode: "retain" as const };
    expect(footerFor(form, choices())).toEqual({ kind: "choose", retainedName: "Maison Haddad" });
    expect(planAddition(form, choices(), "replace")).toEqual({ ok: true, request: { eventId: "e1", slotId: "s-traiteur", vendorIds: ["v1"], mode: "replace" } });
    expect(planAddition(form, choices(), "retain_also")).toEqual({ ok: true, request: { eventId: "e1", slotId: "s-traiteur", vendorIds: ["v1"], mode: "retain_also" } });
    // Un poste libre : un seul bouton, « Ajouter au mariage ».
    expect(footerFor({ ...form, slot: "s-fleurs" }, choices())).toEqual({ kind: "add" });
    expect(footerFor({ ...form, mode: "compare" }, choices())).toEqual({ kind: "add" });
  });

  it("critère 6 — plusieurs fiches : « En comparaison » seulement, choisi ; « Retenu » n'est pas proposé", () => {
    const many = choices({ vendors: [{ id: "v1", name: "A" }, { id: "v2", name: "B" }, { id: "v3", name: "C" }] });
    expect(allowedModes(many)).toEqual(["compare"]);
    expect(allowedModes(choices())).toEqual(["compare", "retain"]);
    const form = initialAdditionForm(many);
    expect(form.mode).toBe("compare");
    expect(planAddition({ ...form, mode: "retain" }, many, "add")).toEqual({ ok: false, errors: ["mode"] });
    expect(planAddition(form, many, "add")).toEqual({ ok: true, request: { eventId: "e1", slotId: "s-fleurs", vendorIds: ["v1", "v2", "v3"], mode: "compare" } });
  });

  it("depuis un poste, le mariage et le poste sont déjà choisis ; un mariage qui n'est plus proposé laisse le choix vide", () => {
    expect(initialAdditionForm(choices(), { eventId: "e2", slotId: "s-dj" })).toMatchObject({ eventId: "e2", slot: "s-dj" });
    expect(initialAdditionForm(choices(), { eventId: "ailleurs", slotId: "x" })).toMatchObject({ eventId: null, slot: null });
    expect(planAddition({ ...initialAdditionForm(choices({ events: [] })), mode: "compare" }, choices({ events: [] }), "add")).toEqual({ ok: false, errors: ["event", "slot"] });
  });
});

describe("UX-07 — Le message de retour dit où le prestataire est allé (lot 73c, critère 5)", () => {
  it("en comparaison : le poste, puis la fiche, les mariés et le nombre en comparaison", () => {
    expect(additionFeedback({ mode: "compare", slotLabel: "Fleurs et décoration", vendorNames: ["Les Fleurs du Causse"], eventLabel: "Léa & Maxime", comparingCount: 3, replacedName: null })).toEqual({
      title: { key: "addedCompared", values: { slot: "Fleurs et décoration" } },
      detail: [{ text: "Les Fleurs du Causse" }, { text: "Léa & Maxime" }, { key: "comparingCount", values: { count: 3 } }],
    });
  });

  it("retenu, en remplaçant : le poste, et celui qui repasse en comparaison", () => {
    expect(additionFeedback({ mode: "replace", slotLabel: "Traiteur", vendorNames: ["Belle Époque"], eventLabel: "Léa & Maxime", comparingCount: 1, replacedName: "Maison Haddad" })).toEqual({
      title: { key: "addedRetained", values: { slot: "Traiteur" } },
      detail: [{ text: "Belle Époque" }, { text: "Léa & Maxime" }, { key: "backToComparison", values: { name: "Maison Haddad" } }],
    });
  });

  it("plusieurs fiches : leur nombre", () => {
    expect(additionFeedback({ mode: "compare", slotLabel: "DJ", vendorNames: ["A", "B"], eventLabel: "Inès", comparingCount: 2, replacedName: null }).detail[0]).toEqual({ key: "recordsCount", values: { count: 2 } });
  });
});

describe("PRE-02 — Le panneau du poste (lot 73c, critère 7)", () => {
  const vendor = (id: string, matchesSlot: boolean, onSlot: "compared" | "retained" | null = null) => ({ id, name: id, matchesSlot, onSlot });

  it("les fiches du métier d'abord, puis le reste du carnet ; l'ordre de la recherche est gardé", () => {
    const groups = panelGroups([vendor("a", true), vendor("b", false), vendor("c", true)]);
    expect(groups.matching.map((entry) => entry.id)).toEqual(["a", "c"]);
    expect(groups.others.map((entry) => entry.id)).toEqual(["b"]);
  });

  it("une fiche déjà sur le poste dit « Dans la comparaison » ou « Retenu » au lieu de ses boutons", () => {
    expect(panelRowState(vendor("a", true, "compared"))).toBe("inComparison");
    expect(panelRowState(vendor("a", true, "retained"))).toBe("retained");
    expect(panelRowState(vendor("a", true))).toBe("actions");
  });
});
