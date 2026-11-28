// Lot 73c (PRE-02, UX-07, UX-14 ; spécification du lot 73, § 5.3 ; P12, M13, P-14 ; maquette 19) — la
// fenêtre « Ajouter à un mariage… » (carnet, fiche, sélection, carnet ouvert depuis un poste) et le
// panneau du poste, côté calcul : ce qui est choisi d'avance, l'ordre des postes, le pied de la fenêtre,
// la demande envoyée au serveur, le message de retour. Fonctions pures, testées sans écran ni base ; le
// serveur revérifie tout (session, organisation, équipe, fiche, mariage, poste).

export type AdditionSlot = { id: string; label: string; comparingCount: number; retained: { candidateId: string; vendorName: string }[] };
export type AdditionEvent = {
  eventId: string;
  // Les mariés (« Léa & Maxime »), ou le nom de l'évènement.
  label: string;
  eventDate: string | null;
  status: string;
  slots: AdditionSlot[];
  // Le poste du métier principal de la fiche (correspondance du 73a), ou rien.
  proposedSlotId: string | null;
  // Une pièce de la fiche qui ne sera plus valide le jour du mariage (une seule fiche).
  documentWarning: { label: string; validUntil: string } | null;
};
export type AdditionChoices = {
  vendors: { id: string; name: string }[];
  // Le métier principal de la fiche (une seule fiche), pour « Nouveau poste « {métier} » ».
  tradeLabel: string | null;
  events: AdditionEvent[];
};

export type AdditionMode = "compare" | "retain";
export type AdditionRequestMode = "compare" | "retain" | "replace" | "retain_also";
// « Nouveau poste » dans la liste des postes.
export const NEW_SLOT = "new";

export type AdditionForm = { eventId: string | null; slot: string | null; newSlotLabel: string; mode: AdditionMode | null };
export type AdditionRequest = { eventId: string; slotId?: string; newSlotLabel?: string; vendorIds: string[]; mode: AdditionRequestMode };
export type AdditionField = "event" | "slot" | "newSlotLabel" | "mode";

const eventOf = (choices: AdditionChoices, eventId: string | null) => (eventId ? (choices.events.find((event) => event.eventId === eventId) ?? null) : null);

// Plusieurs fiches vont toutes en comparaison : « Retenu » n'est proposé que pour une seule (critère 6).
export function allowedModes(choices: AdditionChoices): AdditionMode[] {
  return choices.vendors.length > 1 ? ["compare"] : ["compare", "retain"];
}

// Le mariage le plus proche (la liste vient du serveur dans cet ordre) et son poste proposé ; depuis un
// poste, ce mariage et ce poste. « Comment l'ajouter ? » n'a rien de coché (M13), sauf pour plusieurs
// fiches où « En comparaison » est la seule réponse.
export function initialAdditionForm(choices: AdditionChoices, preset?: { eventId: string; slotId: string }): AdditionForm {
  const mode: AdditionMode | null = allowedModes(choices).length === 1 ? "compare" : null;
  if (preset) {
    const event = eventOf(choices, preset.eventId);
    const slot = event?.slots.some((entry) => entry.id === preset.slotId) ? preset.slotId : null;
    return { eventId: event?.eventId ?? null, slot: event ? slot : null, newSlotLabel: choices.tradeLabel ?? "", mode };
  }
  const first = choices.events[0] ?? null;
  return { eventId: first?.eventId ?? null, slot: first?.proposedSlotId ?? null, newSlotLabel: choices.tradeLabel ?? "", mode };
}

// Changer de mariage : son poste proposé, ou rien.
export function withEvent(form: AdditionForm, choices: AdditionChoices, eventId: string): AdditionForm {
  const event = eventOf(choices, eventId);
  return { ...form, eventId: event?.eventId ?? null, slot: event?.proposedSlotId ?? null };
}

export type SlotOption = { value: string; label: string; comparingCount: number; retainedNames: string[]; proposed: boolean };

// Les postes du mariage, dans leur ordre, puis « Nouveau poste » ; sans poste proposé pour un métier
// connu, « Nouveau poste « {métier} » » vient en tête.
export function slotOptions(event: AdditionEvent, tradeLabel: string | null): SlotOption[] {
  const slots = event.slots.map((slot): SlotOption => ({ value: slot.id, label: slot.label, comparingCount: slot.comparingCount, retainedNames: slot.retained.map((entry) => entry.vendorName), proposed: slot.id === event.proposedSlotId }));
  const created: SlotOption = { value: NEW_SLOT, label: tradeLabel ?? "", comparingCount: 0, retainedNames: [], proposed: false };
  return event.proposedSlotId === null && tradeLabel ? [created, ...slots] : [...slots, created];
}

// Le pied de la fenêtre : « Ajouter au mariage », ou, pour « Retenu » sur un poste déjà pourvu (P12),
// « Remplacer {nom} » puis « Retenir aussi ».
export function footerFor(form: AdditionForm, choices: AdditionChoices): { kind: "add" } | { kind: "choose"; retainedName: string } {
  if (form.mode !== "retain" || !form.slot || form.slot === NEW_SLOT) return { kind: "add" };
  const slot = eventOf(choices, form.eventId)?.slots.find((entry) => entry.id === form.slot);
  const retained = slot?.retained[0];
  return retained ? { kind: "choose", retainedName: slot!.retained.map((entry) => entry.vendorName).join(", ") } : { kind: "add" };
}

// La demande envoyée, ou ce qui manque (écrit sous chaque question ; rien n'est envoyé).
export function planAddition(form: AdditionForm, choices: AdditionChoices, intent: "add" | "replace" | "retain_also"): { ok: true; request: AdditionRequest } | { ok: false; errors: AdditionField[] } {
  const errors: AdditionField[] = [];
  const event = eventOf(choices, form.eventId);
  if (!event) errors.push("event");
  const creating = form.slot === NEW_SLOT;
  const slot = event && form.slot && !creating ? (event.slots.find((entry) => entry.id === form.slot) ?? null) : null;
  if (!creating && !slot) errors.push("slot");
  if (creating && form.newSlotLabel.trim() === "") errors.push("newSlotLabel");
  if (form.mode === null || !allowedModes(choices).includes(form.mode)) errors.push("mode");
  if (errors.length > 0 || !event) return { ok: false, errors };
  const mode: AdditionRequestMode = form.mode === "retain" ? (intent === "add" ? "retain" : intent) : "compare";
  return {
    ok: true,
    request: {
      eventId: event.eventId,
      ...(creating ? { newSlotLabel: form.newSlotLabel.trim() } : { slotId: slot!.id }),
      vendorIds: choices.vendors.map((vendor) => vendor.id),
      mode,
    },
  };
}

// Le message de retour : où le prestataire est allé (le poste), puis la fiche (ou leur nombre), les
// mariés, et le nombre en comparaison ou celui qui y repasse. Clés de traduction de « VendorAddition ».
type Part = { text: string } | { key: string; values: Record<string, string | number> };
export function additionFeedback(outcome: { mode: AdditionRequestMode; slotLabel: string; vendorNames: string[]; eventLabel: string; comparingCount: number; replacedName: string | null }): { title: { key: string; values: Record<string, string> }; detail: Part[] } {
  const compared = outcome.mode === "compare";
  const who: Part = outcome.vendorNames.length === 1 ? { text: outcome.vendorNames[0]! } : { key: "recordsCount", values: { count: outcome.vendorNames.length } };
  const tail: Part[] = outcome.replacedName ? [{ key: "backToComparison", values: { name: outcome.replacedName } }] : compared ? [{ key: "comparingCount", values: { count: outcome.comparingCount } }] : [];
  return {
    title: { key: compared ? "addedCompared" : "addedRetained", values: { slot: outcome.slotLabel } },
    detail: [who, ...(outcome.eventLabel ? [{ text: outcome.eventLabel }] : []), ...tail],
  };
}

// Le panneau du poste : les fiches du métier d'abord (« {métier} du carnet · N »), puis le reste.
export function panelGroups<T extends { matchesSlot: boolean }>(choices: T[]): { matching: T[]; others: T[] } {
  return { matching: choices.filter((choice) => choice.matchesSlot), others: choices.filter((choice) => !choice.matchesSlot) };
}

// Une fiche déjà sur le poste le dit, au lieu de boutons grisés.
export function panelRowState(choice: { onSlot: "compared" | "retained" | null }): "inComparison" | "retained" | "actions" {
  return choice.onSlot === "compared" ? "inComparison" : choice.onSlot === "retained" ? "retained" : "actions";
}
