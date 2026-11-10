// Lot 21 (EVT-21, décision 3) — détail d'un modèle de programme : un tableau
// à colonnes fixes (Heure, Intitulé, Lieu, Intervenants) ; « Modifier » et
// « Supprimer » toujours en fin de ligne. Ajouter ou modifier une ligne et
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
import { listProgramTemplates } from "@/modules/events/service";
import { requirePlanner } from "@/lib/guards";
import { isEventsModuleEnabled, isValidId } from "../../module-access";
import { ProgramTemplateItemForm, RenameProgramTemplateForm } from "../template-forms";
import { removeProgramTemplateAction, removeProgramTemplateItemAction } from "../template-actions";

const PATH = "/events/modeles-programme";

export default async function ProgramTemplatePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ligne?: string; renommer?: string }>;
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
  const template = (await listProgramTemplates(organizationId)).find((candidate) => candidate.id === id);
  if (!template) notFound();
  const { ligne, renommer } = await searchParams;
  const base = `${PATH}/${template.id}`;
  const editing = ligne && ligne !== "nouvelle" ? template.items.find((item) => item.id === ligne) : undefined;

  return (
    <main>
      <Link href={PATH} className="back-link">
        <ArrowLeft aria-hidden="true" />
        {t("backToProgramTemplates")}
      </Link>
      <PageHeader
        title={template.name}
        actions={
          <>
            <Link href={`${base}?renommer=1`} scroll={false} className="button-link">
              {t("renameTemplate")}
            </Link>
            <Link href={`${base}?ligne=nouvelle`} scroll={false} className="button-link button-link-primary">
              <Plus aria-hidden="true" />
              {t("addTemplateLine")}
            </Link>
          </>
        }
      />
      <ScreenHelp title={tHelp("eventsProgramTemplates.title")} body={tHelp("eventsProgramTemplates.body")} />

      {template.items.length === 0 ? (
        <p>{t("noProgramTemplateItems")}</p>
      ) : (
        <table className="template-lines">
          <caption className="sr-only">{template.name}</caption>
          <thead>
            <tr>
              <th scope="col" className="template-time">
                {t("templateColumnTime")}
              </th>
              <th scope="col">{t("templateColumnLabel")}</th>
              <th scope="col" className="template-place">
                {t("programLocation")}
              </th>
              <th scope="col" className="template-who">
                {t("templateColumnParticipants")}
              </th>
              <th scope="col" className="template-actions">
                <span className="sr-only">{t("templateColumnActions")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {template.items.map((item) => (
              <tr key={item.id} aria-current={editing?.id === item.id ? "true" : undefined}>
                <td className="template-time">{item.endTime ? `${item.startTime} – ${item.endTime}` : item.startTime}</td>
                <td className="template-label">{item.label}</td>
                <td className="template-place">{item.location ?? "—"}</td>
                <td className="template-who">{item.participantLabels.length > 0 ? item.participantLabels.join(", ") : "—"}</td>
                <td className="template-actions">
                  <Link href={`${base}?ligne=${item.id}`} scroll={false} className="icon-button" aria-label={t("editProgramItem", { label: item.label })}>
                    <Pencil aria-hidden="true" />
                  </Link>
                  <form action={removeProgramTemplateItemAction} className="inline-form">
                    <input type="hidden" name="itemId" value={item.id} />
                    <input type="hidden" name="templateId" value={template.id} />
                    <button type="submit" className="icon-button" aria-label={t("removeProgramItem", { label: item.label })}>
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
        body={t("deleteProgramTemplateBody")}
        confirmLabel={t("deleteTemplateConfirm")}
        cancelLabel={tCommon("cancel")}
        action={removeProgramTemplateAction}
        fields={{ templateId: template.id }}
      />

      {ligne === "nouvelle" ? (
        <SidePanel title={t("newTemplateLine")} closeHref={base} closeLabel={tCommon("closePanel")}>
          <ProgramTemplateItemForm templateId={template.id} />
        </SidePanel>
      ) : null}
      {editing ? (
        <SidePanel title={t("editTemplateLineTitle", { label: editing.label })} closeHref={base} closeLabel={tCommon("closePanel")}>
          <ProgramTemplateItemForm
            key={editing.id}
            templateId={template.id}
            item={{
              id: editing.id,
              startTime: editing.startTime,
              endTime: editing.endTime ?? "",
              label: editing.label,
              location: editing.location ?? "",
              participantLabels: editing.participantLabels.join(", "),
            }}
          />
        </SidePanel>
      ) : null}
      {renommer === "1" ? (
        <SidePanel title={t("renameTemplateTitle")} closeHref={base} closeLabel={tCommon("closePanel")}>
          <RenameProgramTemplateForm templateId={template.id} name={template.name} />
        </SidePanel>
      ) : null}
    </main>
  );
}
