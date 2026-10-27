import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { HelpButton } from "@symbola/ui";
import { listTaskTemplates } from "@/modules/events/service";
import { getAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled } from "../module-access";
import { AddTaskTemplateItemForm, CreateTaskTemplateForm, LoadStarterRetroplanningForm } from "./template-forms";
import { removeTaskTemplateAction, removeTaskTemplateItemAction } from "./template-actions";

// EVT-04 — modèles de rétroplanning de l'organisation.
export default async function TaskTemplatesPage() {
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
  const templates = await listTaskTemplates(organizationId);

  function offsetLabel(offsetDays: number): string {
    if (offsetDays === 0) return t("offsetEventDay");
    return offsetDays < 0 ? t("offsetBefore", { days: -offsetDays }) : t("offsetAfter", { days: offsetDays });
  }

  return (
    <main>
      <h1>{t("taskTemplatesTitle")}</h1>
      <HelpButton title={tHelp("eventsTemplates.title")} body={tHelp("eventsTemplates.body")} />
      <p>{t("taskTemplatesIntro")}</p>

      {templates.length === 0 ? <p>{t("noTaskTemplates")}</p> : null}
      {templates.map((template) => (
        <section key={template.id} aria-labelledby={`template-${template.id}`}>
          <h2 id={`template-${template.id}`}>{template.name}</h2>
          {template.items.length === 0 ? <p>{t("noTaskTemplateItems")}</p> : null}
          <ul>
            {template.items.map((item) => (
              <li key={item.id}>
                <strong>{offsetLabel(item.offsetDays)}</strong> — {item.label} —{" "}
                {item.responsible === "clients" ? t("responsibleClients") : t("responsiblePlanner")}{" "}
                <form action={removeTaskTemplateItemAction} style={{ display: "inline" }}>
                  <input type="hidden" name="itemId" value={item.id} />
                  <button type="submit">{t("removeTask", { label: item.label })}</button>
                </form>
              </li>
            ))}
          </ul>
          <AddTaskTemplateItemForm templateId={template.id} templateName={template.name} />
          <form action={removeTaskTemplateAction}>
            <input type="hidden" name="templateId" value={template.id} />
            <button type="submit">{t("removeTaskTemplate", { name: template.name })}</button>
          </form>
        </section>
      ))}

      <h2>{t("newTaskTemplateTitle")}</h2>
      <CreateTaskTemplateForm />
      <LoadStarterRetroplanningForm />
    </main>
  );
}
