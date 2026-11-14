// Création d'un compte par l'opérateur (Julien), en ligne de commande sur le
// serveur : le premier compte d'exploitation d'un environnement, ou une
// organisation et sa titulaire. Lot 33 (SEC-01, ADR 0067) : aucun mot de passe ;
// la personne se connecte par lien magique à son adresse, et le fournisseur
// d'identité lui fait installer sa double authentification (D4).
import { z } from "zod";

const argsSchema = z.discriminatedUnion("role", [
  z.object({ role: z.literal("admin"), email: z.email() }),
  z.object({ role: z.literal("owner"), email: z.email(), organization: z.string().trim().min(1).max(200) }),
]);

export type AccountRequest = z.infer<typeof argsSchema>;

export class AccountCliError extends Error {}

// `--role admin --email x@y.fr` ou `--role owner --email x@y.fr --organization "Nom"`.
export function parseAccountArgs(argv: string[]): AccountRequest {
  const values: Record<string, string> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--") continue;
    if (!flag?.startsWith("--")) throw new AccountCliError(`argument inattendu : ${flag}`);
    if (!["--role", "--email", "--organization"].includes(flag)) throw new AccountCliError(`option inconnue : ${flag}`);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) throw new AccountCliError(`valeur manquante pour ${flag}`);
    values[flag.slice(2)] = value;
    index += 1;
  }
  const parsed = argsSchema.safeParse({ ...values, email: values.email?.trim().toLowerCase() });
  if (!parsed.success) {
    throw new AccountCliError(
      "usage : --role admin --email <e-mail>  |  --role owner --email <e-mail> --organization \"<nom>\"",
    );
  }
  return parsed.data;
}
