import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { HelpButton } from "@symbola/ui";
import { listProgramTemplates } from "@/modules/events/service";
import { getAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled } from "../module-access";
import { AddProgramTemplateItemForm, CreateProgramTemplateForm, LoadStarterProgramForm } from "./template-forms";
import { removeProgramTemplateAction, removeProgramTemplateItemAction } from "./template-actions";

// EVT-05 — modèles de programme du jour J de l'organisation.
export default async function ProgramTemplatesPage() {
  const auth = await getAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/mfa");
  if (!auth.user.organizationId) redirect("/");
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
      <HelpButton title={tHelp("eventsProgramTemplates.title")} body={tHelp("eventsProgramTemplates.body")} />
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
                <form action={removeProgramTemplateItemAction} style={{ display: "inline" }}>
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

      <h2>{t("newProgramTemplateTitle")}</h2>
      <CreateProgramTemplateForm />
      <LoadStarterProgramForm />
    </main>
  );
}
