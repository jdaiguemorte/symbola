import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { formatAmount, formatCalendarDate, type Locale } from "@symbola/i18n";
import { ScreenHelp } from "@/app/screen-help";
import type { ImportValue } from "@symbola/import-engine";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { getImportPreview, type PreviewRow } from "@/lib/import/apply";
import { rowEventReference } from "@/lib/import/matching";
import { isValidId } from "../../access";
import { ImportSteps } from "../../import-steps";
import { ConfirmForm } from "./confirm-form";

// IMP-05 — « Avant confirmation, elle voit le résultat : X créations, Y mises
// à jour, Z lignes rejetées, avec un échantillon. »
export default async function ImportConfirmationPage({ params }: { params: Promise<{ importId: string }> }) {
  const auth = await getPlannerAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/mfa");
  if (auth.status === "forbidden") redirect(auth.role === "client" ? "/espace" : "/");
  if (!auth.user.organizationId) redirect("/");

  const { importId } = await params;
  if (!isValidId(importId)) notFound();
  const preview = await getImportPreview(auth.user.organizationId, importId);
  if (!preview) notFound();

  const t = await getTranslations("Import");
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) as Locale;

  const describe = (values: Record<string, ImportValue>): string => {
    if (preview.entityType === "events") {
      const reference = rowEventReference(values);
      const clients = reference.clients.map((client) => `${client.firstName} ${client.lastName ?? ""}`.trim()).join(" & ");
      return reference.eventDate ? t("eventTitle", { clients, date: formatCalendarDate(reference.eventDate, locale) }) : clients;
    }
    const label = preview.entityType === "budget_lines" ? values.slotLabel : values.label;
    const amount = preview.entityType === "budget_lines" ? values.plannedAmount : preview.entityType === "catalog_items" ? values.unitPrice : null;
    const text = typeof label === "string" ? label : t("rowWithoutLabel");
    return typeof amount === "number" ? `${text} — ${formatAmount(amount, locale)}` : text;
  };
  const sample = (rows: PreviewRow[]) => (
    <ul>
      {rows.map((row) => (
        <li key={row.rowIndex}>{t("rowHeading", { line: row.lineNumber, title: describe(row.values) })}</li>
      ))}
    </ul>
  );

  return (
    <main>
      <h1>{t("confirmTitle", { fileName: preview.fileName })}</h1>
      <ScreenHelp title={tHelp("importConfirm.title")} body={tHelp("importConfirm.body")} />
      <ImportSteps current={4} />
      <p role="status">
        {t("previewSummary", { created: preview.counts.creations, updated: preview.counts.updates, rejected: preview.rejectedCount })}
      </p>

      {preview.counts.creations > 0 ? (
        <section aria-labelledby="preview-creations">
          <h2 id="preview-creations">{t("previewCreationsTitle", { count: preview.counts.creations })}</h2>
          {sample(preview.creations)}
        </section>
      ) : null}
      {preview.counts.updates > 0 ? (
        <section aria-labelledby="preview-updates">
          <h2 id="preview-updates">{t("previewUpdatesTitle", { count: preview.counts.updates })}</h2>
          {sample(preview.updates)}
        </section>
      ) : null}
      {preview.rejectedCount > 0 ? (
        <p>
          <Link href={`/import/${preview.importId}/ecarts`}>{t("previewRejectedLink", { count: preview.rejectedCount })}</Link>
        </p>
      ) : null}

      {preview.blockers.length > 0 ? (
        <div role="alert">
          <p>{t("confirmBlocked")}</p>
          <ul>
            {preview.blockers.map((blocker) => (
              <li key={blocker}>{t(`blocker.${blocker}`)}</li>
            ))}
          </ul>
        </div>
      ) : (
        <>
          <p>{t("confirmIntro")}</p>
          <ConfirmForm importId={preview.importId} prospectSources={preview.entityType === "events" ? preview.prospectSources : null} />
        </>
      )}
      <p>
        <Link href={`/import/${preview.importId}`}>{t("backToDraft")}</Link>
      </p>
    </main>
  );
}
