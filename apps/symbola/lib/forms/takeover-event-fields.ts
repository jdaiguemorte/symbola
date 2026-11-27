// Lot 71b (HUB-14, UX-10 ; maquette 06, « Saisir les noms et la date ») — le mariage saisi sur la page de
// reprise : le nom est demandé, la date se vérifie au calendrier, le reste est facultatif. Contrôlé à
// l'écran et au serveur par le même schéma (clés du domaine « Validation »).
import { z } from "zod";
import { isCalendarDate } from "./field-validation";

const text = z.string().optional().default("");

export const takeoverEventFieldsSchema = z.object({ name: text, eventDate: text }).superRefine((values, context) => {
  if (values.name.trim() === "") context.addIssue({ code: "custom", path: ["name"], message: "eventNameRequired" });
  if (values.eventDate.trim() !== "" && !isCalendarDate(values.eventDate.trim())) context.addIssue({ code: "custom", path: ["eventDate"], message: "dateInvalid" });
});
