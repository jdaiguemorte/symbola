// Lot 74a (HUB-09, PAR-01 ; C-68 ; critère 2 ; page 22, « Interrompu, repris ») — l'assistant de démarrage
// quitté en route : une ligne d'état au-dessus de l'accueil, « Votre espace n'est pas tout à fait prêt · 2
// questions sur 5 restent, environ 1 minute », et « Continuer les questions ». Fond blanc, bouton secondaire :
// le seul bouton plein reste celui de l'accueil. Elle disparaît dès la dernière réponse ; titulaire seulement.
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import { getOrganizationProfile } from "@/modules/hub/service";
import { questionsLeft } from "@/lib/onboarding/questionnaire";

export async function SetupNotReadyLine({ organizationId, step }: { organizationId: string; step: number }) {
  const t = await getTranslations("Onboarding");
  const profile = await getOrganizationProfile(appDatabase(), organizationId);
  const { left, total } = questionsLeft(step, profile.hasOngoingEvents);
  return (
    <section className="setup-line" aria-labelledby="setup-line-title">
      <p>
        <strong id="setup-line-title">{t("notReady.title")}</strong> <span aria-hidden="true">·</span>{" "}
        <span>{t("notReady.left", { left, total })}</span>
      </p>
      <Link className="button-link" href="/demarrage">
        {t("notReady.action")}
      </Link>
    </section>
  );
}
