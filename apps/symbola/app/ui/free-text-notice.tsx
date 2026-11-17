// Lot 39c (RGP-04 ; D14, texte validé par Julien le 16/11/2026) — sous chaque champ libre qui peut
// recevoir une donnée personnelle : ce qu'il ne faut pas y noter, et pourquoi. La liste des champs
// et le test qui la tient sont dans lib/free-text-notices.test.ts.
import { useTranslations } from "next-intl";

export function FreeTextNotice() {
  const t = useTranslations("FreeText");
  return <p className="meta free-text-notice">{t("notice")}</p>;
}
