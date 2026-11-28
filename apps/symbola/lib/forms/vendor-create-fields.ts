// Lot 73d (PRE-01, UX-10, HUB-19 ; spécification du lot 73, § 5.4, critères 1 et 3 ; V10, C-46, P-18) — le
// formulaire unique de création d'un prestataire, contrôlé à l'écran et au serveur par le même schéma
// (lib/forms, lot 70b). Le nom et le métier sont obligatoires ; « À classer », choisi exprès dans la liste
// des métiers, est une réponse (UNCLASSIFIED_TRADE). Depuis un poste, « Comment l'ajouter ? » doit avoir
// une réponse : rien n'est coché d'avance. Les messages sont des clés du domaine « VendorCreate.errors ».
import { z } from "zod";

// La valeur du choix « À classer » dans la liste des métiers : la fiche est créée sans métier.
export const UNCLASSIFIED_TRADE = "unclassified";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const text = z.string().optional().default("");

// fromSlot : la fenêtre est ouverte depuis un poste (le champ « mode » existe alors) ; edit : la fenêtre
// « Modifier », où les métiers se cochent (typeIds) au lieu d'un seul choix.
export function vendorCreateFieldsSchema(options: { fromSlot?: boolean; edit?: boolean } = {}) {
  return z
    .object({ name: text, typeId: text, email: text, mode: text })
    .superRefine((values, context) => {
      if (values.name.trim() === "") context.addIssue({ code: "custom", path: ["name"], message: "nameRequired" });
      if (values.name.trim().length > 200) context.addIssue({ code: "custom", path: ["name"], message: "nameTooLong" });
      if (!options.edit && values.typeId !== UNCLASSIFIED_TRADE && !UUID.test(values.typeId)) context.addIssue({ code: "custom", path: ["typeId"], message: "tradeRequired" });
      if (values.email.trim() !== "" && !EMAIL.test(values.email.trim())) context.addIssue({ code: "custom", path: ["email"], message: "emailInvalid" });
      if (options.fromSlot && values.mode !== "compare" && values.mode !== "retain") context.addIssue({ code: "custom", path: ["mode"], message: "modeRequired" });
    });
}

// Les métiers de la fiche créée : le métier choisi, ou aucun pour « À classer ».
export function chosenTypeIds(typeId: string): string[] {
  return UUID.test(typeId) ? [typeId] : [];
}
