// EVT-04 — modèles de rétroplanning de l'organisation. Lot 21 (EVT-22,
// décision 4) : comme le Programme du jour J, la liste des modèles ; un clic
// ouvre le détail. « Nouveau modèle » demande le nom dans le panneau latéral,
// puis ouvre le modèle créé.
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ScreenHelp } from "@/app/screen-help";
import { PageHeader } from "@/app/ui/page-header";
import { SidePanel } from "@/app/ui/side-panel";
import { listTaskTemplates } from "@/modules/events/service";
import { requirePlanner } from "@/lib/guards";
import { isEventsModuleEnabled } from "../module-access";
import { offsetLabel } from "./offset-label";
import { CreateTaskTemplateForm, LoadStarterRetroplanningForm } from "./template-forms";

const PATH = "/events/modeles";

export default async function TaskTemplatesPage({ searchParams }: { searchParams: Promise<{ nouveau?: string }> }) {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;

  const t = await getTranslations("Events");
  const tHelp = await getTranslations("Help");
  const tCommon = await getTranslations("Common");
  if (!(await isEventsModuleEnabled(organizationId))) {
    return (
      <main>
        <h1>{t("title")}</h1>
        <p>{t("moduleUnavailable")}</p>
      </main>
    );
  }
  const templates = await listTaskTemplates(organizationId);
  const creating = (await searchParams).nouveau === "1";

  return (
    <main>
      <PageHeader
        title={t("taskTemplatesTitle")}
        actions={
          <Link href={`${PATH}?nouveau=1`} scroll={false} className="button-link button-link-primary">
            <Plus aria-hidden="true" />
            {t("newTemplateButton")}
          </Link>
        }
      />
      <ScreenHelp title={tHelp("eventsTemplates.title")} body={tHelp("eventsTemplates.body")} />
      <p>{t("taskTemplatesIntro")}</p>

      {templates.length === 0 ? (
        <p>{t("noTaskTemplates")}</p>
      ) : (
        <ul className="template-list" aria-label={t("taskTemplatesTitle")}>
          {templates.map((template) => {
            const offsets = template.items.map((item) => item.offsetDays);
            return (
              <li key={template.id}>
                <Link href={`${PATH}/${template.id}`} className="template-row">
                  <span className="template-name">{template.name}</span>
                  <span className="meta">{t("templateTaskCount", { count: template.items.length })}</span>
                  <span className="meta">
                    {offsets.length > 0 ? t("templateSpan", { start: offsetLabel(t, Math.min(...offsets)), end: offsetLabel(t, Math.max(...offsets)) }) : ""}
                  </span>
                  <ChevronRight aria-hidden="true" className="template-chevron" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <LoadStarterRetroplanningForm />

      {creating ? (
        <SidePanel title={t("newTaskTemplateTitle")} closeHref={PATH} closeLabel={tCommon("closePanel")}>
          <CreateTaskTemplateForm />
        </SidePanel>
      ) : null}
    </main>
  );
}
