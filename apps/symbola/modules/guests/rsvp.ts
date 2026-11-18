// Lot 49 (INV-01, INV-03, RGP-06, RGP-18 ; D3, D11, D13) — règles pures des foyers et du RSVP, sans
// base : ce qu'un foyer doit contenir, qui répond pour qui, ce qu'une réponse peut enregistrer.
// Le serveur les applique quoi que contienne la requête (RGP-06 : sans accord, rien n'est gardé).
import type { GuestAgeRange, GuestKind, GuestPersonInput, HouseholdInput, RsvpAnswerInput } from "@symbola/contracts";

const DAY_MS = 86_400_000;
const NAME_MAX = 100;
const PEOPLE_MAX = 20;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const AGE_RANGES: readonly GuestAgeRange[] = ["0-2", "3-5", "6-11", "12-17"];

// Jour (« AAAA-MM-JJ ») décalé de n jours : calcul sur la date seule, sans fuseau ni heure d'été.
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

export function normalizeEmail(value: string | null | undefined): string | null {
  const email = value?.trim().toLowerCase() ?? "";
  return email === "" ? null : email;
}

export function normalizePhone(value: string | null | undefined): string | null {
  const phone = value?.trim().replace(/\s+/g, " ") ?? "";
  return phone === "" ? null : phone;
}

function clean(value: string | null | undefined): string | null {
  const text = value?.trim().replace(/\s+/g, " ") ?? "";
  return text === "" ? null : text;
}

export type CleanPerson = {
  id?: string | undefined;
  kind: GuestKind;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  ageRange: GuestAgeRange | null;
};

export type HouseholdProblem = "no_adult" | "person_name_missing" | "contact_missing" | "child_contact" | "adult_age_range" | "email_invalid" | "phone_invalid" | "respondent_not_adult" | "too_many_people" | "name_too_long";

// INV-01 : le nom de chaque personne et un moyen de contact pour le foyer (e-mail ou téléphone d'un
// de ses adultes) ; RGP-18 : un enfant n'a ni e-mail, ni téléphone, ni nom de famille.
export function validateHousehold(input: Pick<HouseholdInput, "people" | "respondentIndex">): { ok: true; people: CleanPerson[]; respondentIndex: number } | { ok: false; problem: HouseholdProblem } {
  if (input.people.length > PEOPLE_MAX) return { ok: false, problem: "too_many_people" };
  const people: CleanPerson[] = [];
  for (const person of input.people as GuestPersonInput[]) {
    const firstName = clean(person.firstName);
    const lastName = clean(person.lastName);
    const email = normalizeEmail(person.email);
    const phone = normalizePhone(person.phone);
    if (!firstName) return { ok: false, problem: "person_name_missing" };
    if (firstName.length > NAME_MAX || (lastName && lastName.length > NAME_MAX)) return { ok: false, problem: "name_too_long" };
    if (person.kind === "child") {
      if (email || phone || lastName) return { ok: false, problem: "child_contact" };
      const ageRange = person.ageRange && AGE_RANGES.includes(person.ageRange) ? person.ageRange : null;
      people.push({ id: person.id, kind: "child", firstName, lastName: null, email: null, phone: null, ageRange });
      continue;
    }
    if (person.ageRange) return { ok: false, problem: "adult_age_range" };
    if (email && (!EMAIL.test(email) || email.length > 320)) return { ok: false, problem: "email_invalid" };
    if (phone && (phone.replace(/\D/g, "").length < 6 || phone.length > 40)) return { ok: false, problem: "phone_invalid" };
    people.push({ id: person.id, kind: "adult", firstName, lastName, email, phone, ageRange: null });
  }
  const adults = people.flatMap((person, index) => (person.kind === "adult" ? [index] : []));
  if (adults.length === 0) return { ok: false, problem: "no_adult" };
  if (!people.some((person) => person.kind === "adult" && (person.email || person.phone))) return { ok: false, problem: "contact_missing" };
  const respondentIndex = input.respondentIndex ?? adults[0]!;
  if (people[respondentIndex]?.kind !== "adult") return { ok: false, problem: "respondent_not_adult" };
  return { ok: true, people, respondentIndex };
}

// « Jeanne & Paul Durand », « Jeanne Durand & Paul Martin », « Antoine ».
export function defaultDisplayName(people: Pick<CleanPerson, "kind" | "firstName" | "lastName">[]): string {
  const adults = people.filter((person) => person.kind === "adult");
  const shown = adults.length > 0 ? adults : people;
  const lastNames = new Set(shown.map((person) => person.lastName ?? ""));
  if (lastNames.size === 1) {
    const [lastName] = [...lastNames];
    return `${shown.map((person) => person.firstName).join(" & ")}${lastName ? ` ${lastName}` : ""}`.slice(0, 200);
  }
  return shown.map((person) => (person.lastName ? `${person.firstName} ${person.lastName}` : person.firstName)).join(" & ").slice(0, 200);
}

// D13 : clôture proposée N jours avant le premier temps fort (ou la date de l'évènement).
export function suggestedCloseOn(keyMomentDates: string[], eventDate: string | null, daysBefore: number): string | null {
  const first = [...keyMomentDates].sort()[0] ?? eventDate;
  return first ? addDays(first, -daysBefore) : null;
}

// SEC-15, D13 : les réponses restent ouvertes jusqu'à la fin du jour de clôture (Paris).
export function rsvpOpen(closesOn: string | null, today: string): boolean {
  return closesOn !== null && today <= closesOn;
}

// Temps forts d'un foyer : tous (null), ou ceux choisis qui existent encore, dans l'ordre de l'évènement.
export function invitedMoments(householdKeyMomentIds: string[] | null, allMomentIds: string[]): string[] {
  if (householdKeyMomentIds === null) return [...allMomentIds];
  const chosen = new Set(householdKeyMomentIds);
  return allMomentIds.filter((id) => chosen.has(id));
}

// D3 : le répondant répond à la présence de tout le foyer ; chaque adulte à la sienne. Le régime :
// le sien, et celui d'un enfant (avec la déclaration de représentant légal) ; jamais un autre adulte.
export function rsvpPermissions(selfId: string, respondentId: string | null, members: { id: string; kind: GuestKind }[]): Map<string, { presence: boolean; diet: boolean }> {
  const isRespondent = selfId === respondentId;
  return new Map(members.map((member) => [member.id, { presence: member.id === selfId || isRespondent, diet: member.id === selfId || member.kind === "child" }]));
}

export type RsvpContext = {
  selfId: string;
  respondentId: string | null;
  members: { id: string; kind: GuestKind; invited: string[] }[];
  // Entrées de la liste fermée proposées (visibles).
  optionIds: string[];
  questions: { diet: boolean; accommodation: boolean; transport: boolean };
};

export type SanitizedRsvpAnswer = {
  presence: { guestId: string; keyMomentId: string; attending: boolean }[];
  // undefined : question désactivée (rien ne change) ; null : sans accord (régime effacé).
  ownDiet: string[] | null | undefined;
  children: { guestId: string; optionIds: string[] | null }[];
  accommodation: boolean | null | undefined;
  transport: boolean | null | undefined;
};

// Ce qu'une réponse peut enregistrer : les personnes et temps forts permis, les cases de la liste
// fermée, et rien sans accord (RGP-06) ni sans déclaration de représentant légal pour un enfant.
export function sanitizeRsvpAnswer(context: RsvpContext, input: RsvpAnswerInput): SanitizedRsvpAnswer {
  const permissions = rsvpPermissions(context.selfId, context.respondentId, context.members);
  const invited = new Map(context.members.map((member) => [member.id, new Set(member.invited)]));
  const seen = new Set<string>();
  const presence: SanitizedRsvpAnswer["presence"] = [];
  for (const answer of input.presence) {
    const key = `${answer.guestId}:${answer.keyMomentId}`;
    if (seen.has(key) || !permissions.get(answer.guestId)?.presence || !invited.get(answer.guestId)?.has(answer.keyMomentId)) continue;
    seen.add(key);
    presence.push({ guestId: answer.guestId, keyMomentId: answer.keyMomentId, attending: answer.attending === true });
  }
  const known = new Set(context.optionIds);
  const pick = (ids: string[]) => [...new Set(ids.filter((id) => known.has(id)))];
  let ownDiet: SanitizedRsvpAnswer["ownDiet"];
  const children: SanitizedRsvpAnswer["children"] = [];
  if (context.questions.diet) {
    ownDiet = input.consent ? pick(input.dietOptionIds) : null;
    const kinds = new Map(context.members.map((member) => [member.id, member.kind]));
    const done = new Set<string>();
    for (const child of input.children) {
      if (kinds.get(child.guestId) !== "child" || done.has(child.guestId)) continue;
      done.add(child.guestId);
      children.push({ guestId: child.guestId, optionIds: input.consent && child.guardianDeclared ? pick(child.dietOptionIds) : null });
    }
  }
  return {
    presence,
    ownDiet,
    children,
    accommodation: context.questions.accommodation ? (input.accommodation ?? null) : undefined,
    transport: context.questions.transport ? (input.transport ?? null) : undefined,
  };
}

// Un foyer a répondu quand chacun a une réponse pour chaque temps fort où il est invité.
export function householdComplete(members: { id: string; invited: string[] }[], answered: Set<string>): boolean {
  return members.every((member) => member.invited.every((momentId) => answered.has(`${member.id}:${momentId}`)));
}
