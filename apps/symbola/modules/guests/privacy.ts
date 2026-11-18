// Lot 49 — contrat privacy/v1 du module guests (ADR 0023, RGP-05, RGP-08). Champs personnels
// (privacy.registry.yaml) : prénom, nom, e-mail et téléphone d'un invité, tranche d'âge d'un enfant,
// nom d'un foyer, ses réponses, ses régimes (chiffrés), ses preuves d'accord. Une personne trouvée
// l'est par ses champs ; un invité qui demande l'effacement à la planner est effacé sans attendre la
// purge. Les données liées à un évènement (purge mensuelle d'un évènement client, oubli d'un client)
// sont une seule fiche « liste des invités », sans nom d'invité : l'export d'un client n'emporte pas
// les données de ses invités, mais l'effacement de l'évènement les emporte toutes.
import { eq, inArray } from "drizzle-orm";
import { diets, dietConsents, guests, households, rsvpAnswers } from "@symbola/db/schema/guests";
import { hasTerms, idsOfKind, prepareTerms, recordMatches, type ErasurePlanItem, type PrivacyContractV1, type PrivacyRecord } from "@symbola/privacy";
import { dietPlace, openDietOptions } from "./diets";
import { removeEventGuestRows } from "./households";
import { ensureDietaryOptions, inOrganization, UUID, type Tx } from "./repository";
import { seatsOfGuests } from "./seating";
import { pruneSeatingConstraints } from "./seating-release";
import { guestEventContexts } from "@/modules/events/service";
import { starterDietaryOptionLabel } from "@symbola/starter-templates";

const MODULE = "guests";

function compact(fields: Record<string, string | null | undefined>): Record<string, string> {
  return Object.fromEntries(Object.entries(fields).filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1] !== ""));
}

async function existingGuests(tx: Tx, ids: string[]): Promise<string[]> {
  const valid = ids.filter((id) => UUID.test(id));
  if (valid.length === 0) return [];
  return (await tx.select({ id: guests.id }).from(guests).where(inArray(guests.id, valid))).map((row) => row.id);
}

async function existingLists(tx: Tx, eventIds: string[]): Promise<string[]> {
  const valid = eventIds.filter((id) => UUID.test(id));
  if (valid.length === 0) return [];
  return [...new Set((await tx.select({ eventId: households.eventId }).from(households).where(inArray(households.eventId, valid))).map((row) => row.eventId))];
}

const deleted = (kind: string, ids: string[]): ErasurePlanItem[] => ids.map((recordId) => ({ kind, recordId, fate: "deleted", legalBasis: null, keptUntil: null }));

// Effacer une personne : sa ligne (en cascade ses réponses, régimes et liens ; ses preuves d'accord
// perdent la personne). Un foyer vidé disparaît ; un répondant effacé est remplacé par un autre adulte.
async function eraseGuests(tx: Tx, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const rows = await tx.select({ id: guests.id, householdId: guests.householdId }).from(guests).where(inArray(guests.id, ids));
  await tx.update(dietConsents).set({ guestId: null }).where(inArray(dietConsents.guestId, ids));
  await tx.delete(guests).where(inArray(guests.id, ids));
  // Lot 50 : places et appartenances aux contraintes partent en cascade ; une contrainte réduite à
  // moins de deux personnes disparaît.
  await pruneSeatingConstraints(tx);
  for (const householdId of new Set(rows.map((row) => row.householdId))) {
    const left = await tx.select().from(guests).where(eq(guests.householdId, householdId));
    if (left.length === 0) {
      await tx.delete(households).where(eq(households.id, householdId));
      continue;
    }
    const [household] = await tx.select().from(households).where(eq(households.id, householdId));
    if (household && (!household.respondentGuestId || ids.includes(household.respondentGuestId))) {
      const adult = left.sort((a, b) => a.position - b.position).find((person) => person.kind === "adult");
      await tx.update(households).set({ respondentGuestId: adult?.id ?? null }).where(eq(households.id, householdId));
    }
  }
}

export const guestsPrivacy: PrivacyContractV1 = {
  module: MODULE,

  async find({ organizationId, terms: rawTerms }) {
    const terms = prepareTerms(rawTerms);
    if (!hasTerms(terms)) return [];
    const found = await inOrganization(organizationId, async (tx) => {
      const rows = await tx.select({ person: guests, householdName: households.displayName }).from(guests).innerJoin(households, eq(households.id, guests.householdId));
      const matches = rows.filter(({ person }) => recordMatches([person.firstName, person.lastName, person.email, person.phone], terms));
      if (matches.length === 0) return null;
      const ids = matches.map(({ person }) => person.id);
      const [answers, dietRows, consents, options, seats] = await Promise.all([
        tx.select().from(rsvpAnswers).where(inArray(rsvpAnswers.guestId, ids)),
        tx.select().from(diets).where(inArray(diets.guestId, ids)),
        tx.select().from(dietConsents).where(inArray(dietConsents.guestId, ids)),
        ensureDietaryOptions(tx, organizationId),
        seatsOfGuests(tx, ids),
      ]);
      return { matches, answers, dietRows, consents, options, seats };
    });
    if (!found) return [];
    // Lot 50 : la table de la personne à chaque temps fort à table ; jamais les contraintes de
    // placement, données internes de l'organisation (DPO-8).
    const contexts = await guestEventContexts(organizationId, [...new Set(found.seats.map((seat) => seat.eventId))]);
    const momentName = new Map(contexts.flatMap((context) => context.keyMoments.map((moment) => [moment.id, moment.name] as const)));
    {
      const { matches, answers, dietRows, consents, options, seats } = found;
      const labelOf = new Map(options.map((option) => [option.id, option.starterKey ? (starterDietaryOptionLabel(option.starterKey, "fr") ?? option.starterKey) : (option.label ?? "")]));
      return matches.map(({ person, householdName }): PrivacyRecord => {
        const sealed = dietRows.find((row) => row.guestId === person.id)?.optionsSealed;
        const diet = sealed ? openDietOptions(sealed, dietPlace(organizationId, person.id)).map((id) => labelOf.get(id) ?? id) : [];
        return {
          module: MODULE,
          kind: "guest",
          recordId: person.id,
          label: [person.firstName, person.lastName].filter(Boolean).join(" "),
          fields: compact({
            firstName: person.firstName,
            lastName: person.lastName,
            email: person.email,
            phone: person.phone,
            ageRange: person.ageRange,
            household: householdName,
            answers: answers.filter((answer) => answer.guestId === person.id).map((answer) => `${answer.keyMomentId} : ${answer.attending ? "oui" : "non"}`).join(" · ") || null,
            diet: diet.join(", ") || null,
            dietConsent: consents.filter((consent) => consent.guestId === person.id).map((consent) => `${consent.textVersion} ${consent.grantedAt.toISOString()}${consent.withdrawnAt ? ` → ${consent.withdrawnAt.toISOString()}` : ""}`).join(" · ") || null,
            opposedAt: person.opposedAt?.toISOString() ?? null,
            seating: seats.filter((seat) => seat.guestId === person.id).map((seat) => `${momentName.get(seat.keyMomentId) ?? seat.keyMomentId} : ${seat.tableName}`).join(" · ") || null,
          }),
          eventId: person.eventId,
        };
      });
    }
  },

  async related({ organizationId, eventIds }) {
    return inOrganization(organizationId, async (tx) => {
      const lists = await existingLists(tx, eventIds);
      if (lists.length === 0) return [];
      const people = await tx.select({ eventId: guests.eventId }).from(guests).where(inArray(guests.eventId, lists));
      return lists.map((eventId): PrivacyRecord => ({
        module: MODULE,
        kind: "guest_list",
        recordId: eventId,
        label: "Liste des invités",
        fields: { people: String(people.filter((person) => person.eventId === eventId).length) },
        eventId,
      }));
    });
  },

  async planErasure(input) {
    return inOrganization(input.organizationId, async (tx) => [
      ...deleted("guest", await existingGuests(tx, idsOfKind(input.records, "guest"))),
      ...deleted("guest_list", await existingLists(tx, idsOfKind(input.records, "guest_list"))),
    ]);
  },

  async erase(input) {
    const { guestIds, lists } = await inOrganization(input.organizationId, async (tx) => {
      const guestIds = await existingGuests(tx, idsOfKind(input.records, "guest"));
      await eraseGuests(tx, guestIds);
      return { guestIds, lists: await existingLists(tx, idsOfKind(input.records, "guest_list")) };
    });
    await removeEventGuestRows(input.organizationId, lists);
    return [...deleted("guest", guestIds), ...deleted("guest_list", lists)];
  },
};
