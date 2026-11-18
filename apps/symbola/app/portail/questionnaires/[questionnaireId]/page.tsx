// Lot 45 (POR-07, CRM-09 ; D7 ; ADR 0090) — un questionnaire, depuis le lien personnel : seulement un
// questionnaire envoyé à ce lien, pour l'évènement du lien ; sinon, « indisponible », sans rien révéler.
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ScreenHelp } from "@/app/screen-help";
import { requireLink } from "@/lib/guards";
import { getQuestionnaireOfLink, QuestionnaireNotFoundError, type PortalQuestionnaireView } from "@/modules/events/service";
import { isValidId } from "@/app/events/module-access";
import { LinkPrivacyNotice } from "../../link-privacy-notice";
import { portalQuestionnairesAccess } from "../access";
import { QuestionnaireAnswerer } from "./questionnaire-answerer";

export default async function PortalQuestionnairePage({ params }: { params: Promise<{ questionnaireId: string }> }) {
  const link = await requireLink("client");
  const t = await getTranslations("PortalQuestionnaires");
  const tHelp = await getTranslations("Help");
  const { questionnaireId } = await params;
  const access = await portalQuestionnairesAccess();
  let view: PortalQuestionnaireView | null = null;
  if (access && isValidId(questionnaireId)) {
    try {
      view = await getQuestionnaireOfLink(access, questionnaireId);
    } catch (error) {
      if (!(error instanceof QuestionnaireNotFoundError)) throw error;
    }
  }
  return (
    <main className="portal stack">
      <p>
        <Link href="/portail/questionnaires">{t("backToList")}</Link>
      </p>
      <h1>{view?.name ?? t("title")}</h1>
      <ScreenHelp title={tHelp("portalQuestionnaires.title")} body={tHelp("portalQuestionnaires.body")} />
      {view ? <QuestionnaireAnswerer questionnaireId={view.id} questions={view.questions} finished={view.finishedAt !== null} /> : <p>{t("unavailable")}</p>}
      <LinkPrivacyNotice organizationId={link.organizationId} />
    </main>
  );
}
