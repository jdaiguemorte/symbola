import { getTranslations } from "next-intl/server";
import { ScreenHelp } from "@/app/screen-help";
import { listProgramTemplates } from "@/modules/events/service";
import { requirePlanner } from "@/lib/guards";
import { isEventsModuleEnabled } from "../module-access";
import { AddProgramTemplateItemForm, CreateProgramTemplateForm, LoadStarterProgramForm } from "./template-forms";
import { removeProgramTemplateAction, removeProgramTemplateItemAction } from "./template-actions";

// EVT-05 — modèles de programme du jour J de l'organisation.
export default async function ProgramTemplatesPage() {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;

  const t = await getTranslations("Events");
  const tHelp = await getTranslations("Help");
  if (!(await isEventsModuleEnabled(organizationId))) {
    return (
      <main>
        <h1>{t("title")}</h1>
        <p>{t("moduleUnavailable")}</p>
      </main>
    );
  }
  const templates = await listProgramTemplates(organizationId);

  return (
    <main>
      <h1>{t("programTemplatesTitle")}</h1>
      <ScreenHelp title={tHelp("eventsProgramTemplates.title")} body={tHelp("eventsProgramTemplates.body")} />
      <p>{t("programTemplatesIntro")}</p>

      {templates.length === 0 ? <p>{t("noProgramTemplates")}</p> : null}
      {templates.map((template) => (
        <section key={template.id} aria-labelledby={`program-template-${template.id}`}>
          <h2 id={`program-template-${template.id}`}>{template.name}</h2>
          {template.items.length === 0 ? <p>{t("noProgramTemplateItems")}</p> : null}
          <ul>
            {template.items.map((item) => (
              <li key={item.id}>
                <strong>{item.endTime ? `${item.startTime} – ${item.endTime}` : item.startTime}</strong> — {item.label}
                {item.location ? ` — ${item.location}` : ""}
                {item.participantLabels.length > 0 ? ` — ${item.participantLabels.join(", ")}` : ""}{" "}
                <form action={removeProgramTemplateItemAction} className="inline-form">
                  <input type="hidden" name="itemId" value={item.id} />
                  <button type="submit">{t("removeProgramItem", { label: item.label })}</button>
                </form>
              </li>
            ))}
          </ul>
          <AddProgramTemplateItemForm templateId={template.id} templateName={template.name} />
          <form action={removeProgramTemplateAction}>
            <input type="hidden" name="templateId" value={template.id} />
            <button type="submit">{t("removeProgramTemplate", { name: template.name })}</button>
          </form>
        </section>
      ))}

      {/* Lot 20 (EVT-20) : titre et formulaire dans une même carte, de la largeur
          des cartes des modèles (un formulaire seul est limité en largeur). */}
      <section aria-labelledby="new-program-template">
        <h2 id="new-program-template">{t("newProgramTemplateTitle")}</h2>
        <CreateProgramTemplateForm />
      </section>
      <LoadStarterProgramForm />
    </main>
  );
}
