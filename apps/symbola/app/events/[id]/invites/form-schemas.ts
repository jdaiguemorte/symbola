// Lot 49 — entrées des formulaires du module Invités (équipe et portail), validées par Zod côté
// serveur (CLAUDE.md § 5) ; les erreurs du service deviennent des messages traduits.
import { z } from "zod";
import { GUEST_AGE_RANGES, type HouseholdInput } from "@symbola/contracts";
import {
  GuestEventNotFoundError,
  GuestImportNotFoundError,
  GuestLinkUnavailableError,
  GuestNotFoundError,
  GuestSettingsInvalidError,
  GuestsNotReadyError,
  HouseholdInvalidError,
  HouseholdNotFoundError,
  InvitationsNotReadyError,
  PostponementInvalidError,
  SeatingInvalidError,
  SeatingNotFoundError,
} from "@/modules/guests/service";

const text = (max: number) => z.string().max(max).nullable().optional();

export const householdSchema = z.object({
  displayName: text(200),
  side: z.union([z.object({ kind: z.literal("client"), clientId: z.uuid() }), z.object({ kind: z.literal("both") }), z.null()]).optional(),
  groupLabel: text(100),
  language: z.enum(["fr", "en"]).optional(),
  keyMomentIds: z.array(z.uuid()).max(20).nullable().optional(),
  respondentIndex: z.number().int().min(0).max(19).optional(),
  people: z
    .array(
      z.object({
        id: z.uuid().optional(),
        kind: z.enum(["adult", "child"]),
        firstName: z.string().max(100),
        lastName: text(100),
        email: text(320),
        phone: text(40),
        ageRange: z.enum(GUEST_AGE_RANGES).nullable().optional(),
      }),
    )
    .max(20),
});

export function parseHousehold(value: FormDataEntryValue | null): HouseholdInput | null {
  try {
    const parsed = householdSchema.safeParse(JSON.parse(String(value ?? "")));
    return parsed.success ? (parsed.data as HouseholdInput) : null;
  } catch {
    return null;
  }
}

// Clé du message (espace « Guests.errors ») d'une erreur connue du service, sinon null.
export function guestErrorKey(error: unknown): string | null {
  if (error instanceof GuestsNotReadyError) return "notReady";
  if (error instanceof GuestEventNotFoundError) return "eventNotFound";
  if (error instanceof HouseholdNotFoundError || error instanceof GuestNotFoundError) return "notFound";
  if (error instanceof HouseholdInvalidError) return `household.${error.problem}`;
  if (error instanceof GuestLinkUnavailableError) return `link.${error.reason}`;
  if (error instanceof InvitationsNotReadyError) return `invitations.${error.reason}`;
  if (error instanceof GuestSettingsInvalidError) return `settings.${error.problem}`;
  if (error instanceof PostponementInvalidError) return `postpone.${error.problem}`;
  if (error instanceof GuestImportNotFoundError) return "notFound";
  // Lot 50 : plan de table, types de repas, synthèse pour le traiteur.
  if (error instanceof SeatingNotFoundError) return "notFound";
  if (error instanceof SeatingInvalidError) return `seating.${error.problem}`;
  return null;
}
