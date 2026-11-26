// Lot 70a (CHR-02 ; A1, décision de Julien du 26/11/2026) — prénom et nom d'une personne de l'équipe,
// saisis par elle dans Mon compte. Ils appartiennent à la personne (hub.users), pas à l'organisation ; ils
// ne se montrent qu'aux membres de ses organisations (jamais aux mariés, aux prestataires ni dans un
// journal). Tant que le prénom est vide, le début de l'adresse en tient lieu (« bastien »).
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { AppDatabase } from "@symbola/db/client";
import { users } from "@symbola/db/schema/hub";
import { withActorContext } from "@symbola/db/with-organization";

export const PERSON_NAME_MAX = 80;

// Vide : effacé. Sans caractère de contrôle, 80 caractères au plus (contraintes de la migration 0216).
const nameField = z
  .string()
  .transform((value) => value.trim().replace(/\s+/g, " "))
  .refine((value) => value.length <= PERSON_NAME_MAX && !/[\p{Cc}]/u.test(value))
  .transform((value) => (value === "" ? null : value));

export const personNamesSchema = z.object({ firstName: nameField, lastName: nameField });
export type PersonNamesInput = z.input<typeof personNamesSchema>;
export type PersonNames = { firstName: string | null; lastName: string | null };

export class PersonNamesInvalidError extends Error {
  constructor() {
    super("prénom ou nom refusé");
    this.name = "PersonNamesInvalidError";
  }
}

// La personne règle les siens (l'appelant vérifie que c'est son compte).
export async function setUserNames(db: AppDatabase, userId: string, input: PersonNamesInput): Promise<PersonNames> {
  const parsed = personNamesSchema.safeParse(input);
  if (!parsed.success) throw new PersonNamesInvalidError();
  await withActorContext(db, (tx) => tx.update(users).set({ firstName: parsed.data.firstName, lastName: parsed.data.lastName, updatedAt: new Date() }).where(eq(users.id, userId)));
  return parsed.data;
}

export async function getUserNames(db: AppDatabase, userId: string): Promise<PersonNames> {
  const [row] = await db.select({ firstName: users.firstName, lastName: users.lastName }).from(users).where(eq(users.id, userId));
  return { firstName: row?.firstName ?? null, lastName: row?.lastName ?? null };
}

type Named = { email: string; firstName: string | null; lastName: string | null };

// Le début de l'adresse, tel quel (« bastien.leroy@… » → « bastien.leroy »).
function emailStart(email: string): string {
  return email.split("@")[0] || email;
}

// Sur une ligne : le prénom ; sinon le début de l'adresse.
export function personShortName(person: Named): string {
  return person.firstName ?? emailStart(person.email);
}

// Dans un menu ou un panneau : prénom et nom ; sinon ce qu'il y a.
export function personFullName(person: Named): string {
  const full = [person.firstName, person.lastName].filter(Boolean).join(" ");
  return full || emailStart(person.email);
}

// Initiales des deux (« BL ») ; une seule lettre sans nom ; celle de l'adresse sans prénom.
export function personInitials(person: Named): string {
  const letters = [person.firstName, person.lastName].flatMap((part) => (part ? [Array.from(part)[0]!.toLocaleUpperCase("fr")] : []));
  return letters.length > 0 ? letters.join("") : (Array.from(emailStart(person.email))[0] ?? "?").toLocaleUpperCase("fr");
}
