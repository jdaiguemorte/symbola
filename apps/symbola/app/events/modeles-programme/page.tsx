// PRD-EVT-05 — modèles de programme du jour J de l'organisation. Lot 21 (L21-EVT-21,
// décision 3) : la liste des modèles ; un clic ouvre le détail. « Nouveau
// modèle » demande le nom dans le panneau latéral, puis ouvre le modèle créé.
import { ScreenMain } from "@/app/ui/screen-main";
import Link from "next/link";
import { EmptyState } from "@/app/ui/empty-state";
import { ChevronRight, Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ScreenHelp } from "@/app/screen-help";
import { PageHeader } from "@/app/ui/page-header";
import { SidePanel } from "@/app/ui/side-panel";
import { listProgramTemplates } from "@/modules/events/service";
import { requirePlanner } from "@/lib/guards";
import { isEventsModuleEnabled } from "../module-access";
import { CreateProgramTemplateForm, LoadStarterProgramForm } from "./template-forms";

const PATH = "/events/modeles-programme";

export default async function ProgramTemplatesPage({ searchParams }: { searchParams: Promise<{ nouveau?: string }> }) {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;

  const t = await getTranslations("Events");

  const tMenu = await getTranslations("SettingsMenu");
  const tHelp = await getTranslations("Help");
  const tCommon = await getTranslations("Common");
  if (!(await isEventsModuleEnabled(organizationId))) {
    return (
      <ScreenMain>
        <h1>{tMenu("rubrics.program.label")}</h1>
        <p>{t("moduleUnavailable")}</p>
      </ScreenMain>
    );
  }
  const templates = await listProgramTemplates(organizationId);
  const creating = (await searchParams).nouveau === "1";

  return (
    <ScreenMain>
      <PageHeader
        title={tMenu("rubrics.program.label")}
        actions={
          <Link href={`${PATH}?nouveau=1`} scroll={false} className="button-link button-link-primary">
            <Plus aria-hidden="true" />
            {t("newTemplateButton")}
          </Link>
        }
      />
      <ScreenHelp title={tHelp("eventsProgramTemplates.title")} body={tHelp("eventsProgramTemplates.body")} />
      <p>{t("programTemplatesIntro")}</p>

      {templates.length === 0 ? (
        // Lot 39c (UX-08) : l'écran vide enseigne.
        <EmptyState screen="programTemplates" title={t("noProgramTemplates")} actionHref={`${PATH}?nouveau=1`} />
      ) : (
        <ul className="template-list" aria-label={t("programTemplatesTitle")}>
          {templates.map((template) => {
            const first = template.items[0];
            const last = template.items[template.items.length - 1];
            return (
              <li key={template.id}>
                <Link href={`${PATH}/${template.id}`} className="template-row">
                  <span className="template-name">{template.name}</span>
                  <span className="meta">{t("templateLineCount", { count: template.items.length })}</span>
                  <span className="meta">{first && last ? t("templateSpan", { start: first.startTime, end: last.endTime ?? last.startTime }) : ""}</span>
                  <ChevronRight aria-hidden="true" className="template-chevron" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <LoadStarterProgramForm />

      {creating ? (
        <SidePanel title={t("newProgramTemplateTitle")} closeHref={PATH} closeLabel={tCommon("closePanel")}>
          <CreateProgramTemplateForm />
        </SidePanel>
      ) : null}
    </ScreenMain>
  );
}
