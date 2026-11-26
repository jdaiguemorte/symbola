// Lot 70b (UX-10, EVT-01 ; P-18, C-04) — « Nouvel évènement » : ce qui est demandé selon le choix
// (demande, évènement confirmé, client existant ; newEventRules), contrôlé à l'écran et au serveur.
import { z } from "zod";

export type NewEventFieldRules = {
  clientRequired: boolean;
  sourceRequired: boolean;
  existingContactOnly: boolean;
  // Évènement confirmé sans client : il lui faut un nom.
  nameRequiredWithoutClient: boolean;
};

const text = z.string().optional().default("");

export function newEventFieldsSchema(rules: NewEventFieldRules) {
  return z
    .object({ contactId1: text, firstName1: text, name: text, prospectSourceId: text })
    .superRefine((values, context) => {
      const hasClient = values.firstName1.trim() !== "" || values.contactId1.trim() !== "";
      if (rules.existingContactOnly) {
        if (values.contactId1.trim() === "") context.addIssue({ code: "custom", path: ["contactId1"], message: "existingContactRequired" });
      } else if (rules.clientRequired && !hasClient) {
        context.addIssue({ code: "custom", path: ["firstName1"], message: "clientFirstNameRequired" });
      } else if (rules.nameRequiredWithoutClient && !hasClient && values.name.trim() === "") {
        context.addIssue({ code: "custom", path: ["name"], message: "eventNameRequired" });
      }
      if (rules.sourceRequired && values.prospectSourceId.trim() === "") context.addIssue({ code: "custom", path: ["prospectSourceId"], message: "sourceRequired" });
    });
}
