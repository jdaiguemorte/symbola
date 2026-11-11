// Lot 21 (L21-EVT-22, décision 4) — détail d'un modèle de rétroplanning : un
// tableau à colonnes fixes (Échéance, Tâche, Responsable) ; « Modifier » et
// « Supprimer » toujours en fin de ligne. Ajouter ou modifier une tâche et
// renommer le modèle se font dans le panneau latéral (ADR 0033) ; la
// suppression du modèle demande une confirmation.
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ScreenHelp } from "@/app/screen-help";
import { ConfirmDialog } from "@/app/ui/confirm-dialog";
import { PageHeader } from "@/app/ui/page-header";
import { SidePanel } from "@/app/ui/side-panel";
import { listTaskTemplates } from "@/modules/events/service";
import { requirePlanner } from "@/lib/guards";
import { isEventsModuleEnabled, isValidId } from "../../module-access";
import { offsetLabel } from "../offset-label";
import { RenameTaskTemplateForm, TaskTemplateItemForm } from "../template-forms";
import { removeTaskTemplateAction, removeTaskTemplateItemAction } from "../template-actions";

const PATH = "/events/modeles";

export default async function TaskTemplatePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tache?: string; renommer?: string }>;
}) {
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
  const { id } = await params;
  if (!isValidId(id)) notFound();
  const template = (await listTaskTemplates(organizationId)).find((candidate) => candidate.id === id);
  if (!template) notFound();
  const { tache, renommer } = await searchParams;
  const base = `${PATH}/${template.id}`;
  const editing = tache && tache !== "nouvelle" ? template.items.find((item) => item.id === tache) : undefined;

  return (
    <main>
      <Link href={PATH} className="back-link">
        <ArrowLeft aria-hidden="true" />
        {t("backToTaskTemplates")}
      </Link>
      <PageHeader
        title={template.name}
        actions={
          <>
            <Link href={`${base}?renommer=1`} scroll={false} className="button-link">
              {t("renameTemplate")}
            </Link>
            <Link href={`${base}?tache=nouvelle`} scroll={false} className="button-link button-link-primary">
              <Plus aria-hidden="true" />
              {t("addTemplateTask")}
            </Link>
          </>
        }
      />
      <ScreenHelp title={tHelp("eventsTemplates.title")} body={tHelp("eventsTemplates.body")} />

      {template.items.length === 0 ? (
        <p>{t("noTaskTemplateItems")}</p>
      ) : (
        <table className="template-lines template-tasks">
          <caption className="sr-only">{template.name}</caption>
          <thead>
            <tr>
              <th scope="col" className="template-time">
                {t("templateColumnDue")}
              </th>
              <th scope="col">{t("templateColumnTask")}</th>
              <th scope="col" className="template-who">
                {t("taskResponsible")}
              </th>
              <th scope="col" className="template-actions">
                <span className="sr-only">{t("templateColumnActions")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {template.items.map((item) => (
              <tr key={item.id} aria-current={editing?.id === item.id ? "true" : undefined}>
                <td className="template-time">{offsetLabel(t, item.offsetDays)}</td>
                <td className="template-label">{item.label}</td>
                <td className="template-who">{item.responsible === "clients" ? t("responsibleClients") : t("responsiblePlanner")}</td>
                <td className="template-actions">
                  <Link href={`${base}?tache=${item.id}`} scroll={false} className="icon-button" aria-label={t("editTemplateTask", { label: item.label })}>
                    <Pencil aria-hidden="true" />
                  </Link>
                  <form action={removeTaskTemplateItemAction} className="inline-form">
                    <input type="hidden" name="itemId" value={item.id} />
                    <input type="hidden" name="templateId" value={template.id} />
                    <button type="submit" className="icon-button" aria-label={t("removeTask", { label: item.label })}>
                      <Trash2 aria-hidden="true" />
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <ConfirmDialog
        trigger={t("deleteTemplate")}
        triggerLabel={t("deleteTemplate")}
        triggerClassName="link-button template-delete"
        title={t("deleteTemplateTitle", { name: template.name })}
        body={t("deleteTaskTemplateBody")}
        confirmLabel={t("deleteTemplateConfirm")}
        cancelLabel={tCommon("cancel")}
        action={removeTaskTemplateAction}
        fields={{ templateId: template.id }}
      />

      {tache === "nouvelle" ? (
        <SidePanel title={t("newTemplateTask")} closeHref={base} closeLabel={tCommon("closePanel")}>
          <TaskTemplateItemForm templateId={template.id} />
        </SidePanel>
      ) : null}
      {editing ? (
        <SidePanel title={t("editTemplateLineTitle", { label: editing.label })} closeHref={base} closeLabel={tCommon("closePanel")}>
          <TaskTemplateItemForm
            key={editing.id}
            templateId={template.id}
            item={{ id: editing.id, label: editing.label, offsetDays: String(editing.offsetDays), responsible: editing.responsible }}
          />
        </SidePanel>
      ) : null}
      {renommer === "1" ? (
        <SidePanel title={t("renameTemplateTitle")} closeHref={base} closeLabel={tCommon("closePanel")}>
          <RenameTaskTemplateForm templateId={template.id} name={template.name} />
        </SidePanel>
      ) : null}
    </main>
  );
}
