// Lot 38a (MSG-01 ; D5 ; ADR 0072) — un e-mail dont le modèle emploie une variable sans valeur ne
// part pas : le message nomme le modèle et les variables, telles qu'elles s'écrivent dans le texte.
import { getTranslations } from "next-intl/server";
import type { EmailVariableMissingError } from "@/modules/hub/service";

export async function emailVariableMissingMessage(error: EmailVariableMissingError): Promise<string> {
  const t = await getTranslations("EmailTemplates");
  return t("variableMissing", { template: t(`kinds.${error.kind}.title`), tokens: error.tokens.join(", ") });
}
