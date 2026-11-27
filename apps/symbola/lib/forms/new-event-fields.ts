// Lot 70b (UX-10, EVT-01 ; P-18, C-04), refait au lot 70e (D8, M13, A14) — « Nouvel évènement » ne pose
// que « Où en est-il ? » et le nom de l'évènement ; le client, la date et le type sont facultatifs ou
// proposés. Contrôlé à l'écran et au serveur par le même schéma.
import { z } from "zod";
import { parseStanding } from "@/app/events/new/new-event-standing";

const text = z.string().optional().default("");

export const newEventFieldsSchema = z.object({ standing: text, name: text }).superRefine((values, context) => {
  if (parseStanding(values.standing) === null) context.addIssue({ code: "custom", path: ["standing"], message: "standingRequired" });
  if (values.name.trim() === "") context.addIssue({ code: "custom", path: ["name"], message: "eventNameRequired" });
});
