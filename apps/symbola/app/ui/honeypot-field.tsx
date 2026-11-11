// Lot 24b (SEC-22) — champ piège des formulaires publics (lib/honeypot.ts) :
// hors de l'écran, ignoré des lecteurs d'écran et de la tabulation.
import { useTranslations } from "next-intl";
import { HONEYPOT_FIELD } from "@/lib/honeypot";

export function HoneypotField() {
  const t = useTranslations("Honeypot");
  return (
    <div className="honeypot" aria-hidden="true">
      <label>
        {t("label")}
        <input type="text" name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" defaultValue="" />
      </label>
    </div>
  );
}
