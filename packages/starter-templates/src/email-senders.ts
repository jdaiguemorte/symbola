// Lot 65d (MSG-01, HUB-20 ; ADR 0110) — qui envoie chaque modèle d'e-mail, en données (CLAUDE.md
// § 2.6) : les modèles techniques partent toujours de Symbola ; ceux de la relation sont préparés pour
// la messagerie de la planner, ou envoyés par Symbola si l'organisation le choisit. Liste fermée.
import { z } from "zod";
import emailSendersFile from "./email-senders.json";

const kind = z.string().regex(/^[a-z_]+$/);
const emailSendersSchema = z
  .object({ version: z.literal(1), technical: z.array(kind).min(1), relation: z.array(kind).min(1) })
  .refine((file) => new Set([...file.technical, ...file.relation]).size === file.technical.length + file.relation.length, { message: "un modèle est dans les deux listes, ou deux fois dans la même" });
const emailSenders = emailSendersSchema.parse(emailSendersFile);

export type StarterEmailSenders = { technical: string[]; relation: string[] };

export function starterEmailSenders(): StarterEmailSenders {
  return { technical: [...emailSenders.technical], relation: [...emailSenders.relation] };
}
