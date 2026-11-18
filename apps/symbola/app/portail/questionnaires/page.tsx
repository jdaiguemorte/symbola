// Lot 45 (POR-07 ; D6 ; ADR 0090) — la rubrique « Questionnaires » du portail : les questionnaires
// envoyés à ce lien, leur avancement. Fermée par défaut (POR-10) ; sans elle, « indisponible ».
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ScreenHelp } from "@/app/screen-help";
import { requireLink } from "@/lib/guards";
import { listQuestionnairesOfLink } from "@/modules/events/service";
import { LinkPrivacyNotice } from "../link-privacy-notice";
import { portalQuestionnairesAccess } from "./access";

export default async function PortalQuestionnairesPage() {
  const link = await requireLink("client");
  const t = await getTranslations("PortalQuestionnaires");
  const tHelp = await getTranslations("Help");
  const access = await portalQuestionnairesAccess();
  const questionnaires = access ? await listQuestionnairesOfLink(access) : [];
  return (
    <main className="portal stack">
      <p>
        <Link href="/portail">{t("back")}</Link>
      </p>
      <h1>{t("title")}</h1>
      <ScreenHelp title={tHelp("portalQuestionnaires.title")} body={tHelp("portalQuestionnaires.body")} />
      {!access ? (
        <p>{t("unavailable")}</p>
      ) : questionnaires.length === 0 ? (
        <p>{t("none")}</p>
      ) : (
        <ul className="plain-list stack">
          {questionnaires.map((questionnaire) => {
            const answered = questionnaire.questions.filter((question) => questionnaire.answers[question.key]).length;
            return (
              <li key={questionnaire.id}>
                <Link href={`/portail/questionnaires/${questionnaire.id}`}>{questionnaire.name}</Link>{" "}
                <span className="meta">{questionnaire.finishedAt ? t("finished") : t("progress", { answered, total: questionnaire.questions.length })}</span>
              </li>
            );
          })}
        </ul>
      )}
      <LinkPrivacyNotice organizationId={link.organizationId} />
    </main>
  );
}
