import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { formatAmount, formatCalendarDate, type Locale } from "@symbola/i18n";
import { EVENT_STATUS_CHOICES } from "@symbola/contracts";
import { foldSearchText } from "@symbola/db/search";
import { normalizeVendorImportValues, type ImportValue } from "@symbola/import-engine";
import { planningSoftwareProfile } from "@symbola/starter-templates";
import { ScreenHelp } from "@/app/screen-help";
import { ActionBar } from "@/app/ui/action-bar";
import { getImportPreview, type PreviewRow } from "@/lib/import/apply";
import { getImportGapsView } from "@/lib/import/gaps";
import { rowEventReference } from "@/lib/import/matching";
import { importStepHref } from "@/lib/import/wizard";
import { listVendorTags } from "@/modules/vendors/service";
import { ImportHeader } from "../../import-header";
import { importStepContext, wantsAbandon } from "../../step-context";
import { reasonText } from "../ecarts/reasons";
import { saveSheetStatusesAction } from "./actions";
import { ConfirmForm } from "./confirm-form";

// Décision J : libellés des statuts (fiche événement, module events).
const STATUS_KEYS: Record<string, string> = {
  prospect: "statusProspect",
  quote_sent: "statusQuoteSent",
  confirmed: "statusConfirmed",
  done: "statusDone",
  lost: "statusLost",
};

// IMP-05 — « Avant confirmation, elle voit le résultat : X créations, Y mises
// à jour, Z lignes rejetées, avec un échantillon. » Lot 16 (IMP-11, ADR 0041) :
// étape « Vérifier et confirmer » — bilan des effets (fiches, types,
// étiquettes, champs libres, lignes rejetées), aperçu des valeurs après
// correction, et « Importer 25 prestataires » dans la barre du bas.
export default async function ImportConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ importId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { importId } = await params;
  const { organizationId, wizard } = await importStepContext(importId);
  if (wizard.next !== "confirm") redirect(importStepHref(importId, wizard.next));
  const [preview, gaps] = await Promise.all([getImportPreview(organizationId, importId), getImportGapsView(organizationId, importId)]);
  if (!preview || !gaps) notFound();

  const t = await getTranslations("Import");
  const tEvents = await getTranslations("Events");
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) as Locale;
  const translate = (key: string, values?: Record<string, string>) => t(key, values);
  const isVendors = preview.entityType === "vendors";
  const separator = planningSoftwareProfile().vendors.listSeparator;

  // Valeurs montrées après correction (entités HTML, accents, codes postaux, téléphones).
  const describe = (values: Record<string, ImportValue>): string => {
    if (preview.entityType === "events" || preview.entityType === "event_sheets") {
      const reference = rowEventReference(values);
      const clients = reference.clients.map((client) => `${client.firstName} ${client.lastName ?? ""}`.trim()).join(" & ");
      return reference.eventDate ? t("eventTitle", { clients, date: formatCalendarDate(reference.eventDate, locale) }) : clients;
    }
    if (isVendors) {
      const record = normalizeVendorImportValues(values, separator);
      if (!record) return t("rowWithoutLabel");
      const place = [record.postalCode, record.city].filter(Boolean).join(" ");
      return [record.name, place, record.phone].filter(Boolean).join(" — ");
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

  // Bilan des effets : types et étiquettes créés (prestataires), colonnes gardées en champ libre.
  const typesStep = wizard.steps.find((step) => step.key === "types");
  const typesCreated = typesStep?.summary?.values.created ?? 0;
  let tagsCreated = 0;
  if (isVendors && wizard.matches) {
    const existing = new Set((await listVendorTags(organizationId)).map((tag) => foldSearchText(tag.label).trim()));
    const wanted = new Set(
      wizard.matches.rows
        .filter((row) => row.errors.length === 0)
        .flatMap((row) => normalizeVendorImportValues(row.values, separator)?.criteria ?? [])
        .map((criterion) => foldSearchText(criterion).trim()),
    );
    tagsCreated = [...wanted].filter((tag) => tag && !existing.has(tag)).length;
  }
  const freeColumns = (wizard.draft.mapping ?? []).filter((choice) => choice.target === "free").map((choice) => wizard.draft.headers[choice.columnIndex] || t("unnamedColumn", { number: choice.columnIndex + 1 }));
  const total = preview.counts.creations + preview.counts.updates;
  const previousStep = wizard.steps.filter((step) => step.key !== "confirm").at(-1)?.key ?? "columns";

  return (
    <main className="import-assistant">
      <ImportHeader wizard={wizard} current="confirm" abandon={wantsAbandon(await searchParams)} />
      <ScreenHelp title={tHelp("importConfirm.title")} body={tHelp("importConfirm.body")} />

      <section aria-labelledby="effects-title" className="card">
        <h2 id="effects-title">{t("effectsTitle")}</h2>
        <dl className="effects">
          <div>
            <dt>{t("effectsCreations")}</dt>
            <dd>{preview.counts.creations}</dd>
          </div>
          <div>
            <dt>{t("effectsUpdates")}</dt>
            <dd>{preview.counts.updates}</dd>
          </div>
          {isVendors ? (
            <>
              <div>
                <dt>{t("effectsTypes")}</dt>
                <dd>{typesCreated}</dd>
              </div>
              <div>
                <dt>{t("effectsTags")}</dt>
                <dd>{tagsCreated}</dd>
              </div>
            </>
          ) : null}
          <div>
            <dt>{t("effectsFreeColumns")}</dt>
            <dd>{freeColumns.length > 0 ? freeColumns.join(", ") : 0}</dd>
          </div>
          <div>
            <dt>{t("effectsRejected")}</dt>
            <dd>{preview.rejectedCount}</dd>
          </div>
        </dl>
      </section>

      {preview.counts.creations > 0 && preview.entityType === "event_sheets" ? (
        <section aria-labelledby="preview-creations">
          <h2 id="preview-creations">{t("previewCreationsTitle", { count: preview.counts.creations })}</h2>
          <p>{t("sheetStatusIntro")}</p>
          <form action={saveSheetStatusesAction} className="sheet-statuses">
            <input type="hidden" name="importId" value={preview.importId} />
            <ul>
              {preview.creations.map((row) => {
                const title = describe(row.values);
                return (
                  <li key={row.rowIndex}>
                    <input type="hidden" name="rowIndex" value={row.rowIndex} />
                    <label htmlFor={`status-${row.rowIndex}`}>{t("rowHeading", { line: row.lineNumber, title })}</label>
                    <select id={`status-${row.rowIndex}`} name={`status-${row.rowIndex}`} defaultValue={typeof row.values.status === "string" ? row.values.status : "prospect"}>
                      {EVENT_STATUS_CHOICES.map((status) => (
                        <option key={status} value={status}>
                          {tEvents(STATUS_KEYS[status] ?? "statusProspect")}
                        </option>
                      ))}
                    </select>
                  </li>
                );
              })}
            </ul>
            <button type="submit">{t("sheetStatusSave")}</button>
          </form>
        </section>
      ) : preview.counts.creations > 0 ? (
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

      {gaps.rejected.length > 0 ? (
        <section aria-labelledby="gaps-rejected">
          <h2 id="gaps-rejected">{t("gapsRejectedTitle", { count: gaps.rejected.length })}</h2>
          <p>{t("gapsRejectedIntro", { count: gaps.rejected.length, total: gaps.rowCount })}</p>
          <ul>
            {gaps.rejected.map((row) => (
              <li key={row.rowIndex}>
                {row.source
                  ? t("gapsRejectedSheet", { file: row.source, reasons: row.reasons.map((reason) => reasonText(translate, reason)).join(" ; ") })
                  : t("gapsRejectedRow", { line: row.lineNumber, reasons: row.reasons.map((reason) => reasonText(translate, reason)).join(" ; ") })}
              </li>
            ))}
          </ul>
          <p>
            <a href={`/import/${importId}/ecarts/csv`} download>
              {t("gapsDownloadCsv")}
            </a>
          </p>
        </section>
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
        <ConfirmForm importId={preview.importId} prospectSources={preview.entityType === "events" || preview.entityType === "event_sheets" ? preview.prospectSources : null} />
      )}

      <ActionBar label={t("actionBarLabel")} backHref={importStepHref(importId, previousStep)} backLabel={t("back")}>
        {preview.blockers.length === 0 ? (
          <button type="submit" form="confirm-form">
            {t(`importButton.${preview.entityType}`, { count: total })}
          </button>
        ) : null}
      </ActionBar>
    </main>
  );
}
