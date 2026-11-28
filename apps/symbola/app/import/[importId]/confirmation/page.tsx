import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { formatAmount, formatCalendarDate, type Locale } from "@symbola/i18n";
import { EVENT_STATUS_CHOICES, eventStatusForStage } from "@symbola/contracts";
import { foldSearchText } from "@symbola/db/search";
import { normalizeVendorImportValues, type ImportValue } from "@symbola/import-engine";
import { planningSoftwareProfile } from "@symbola/starter-templates";
import { ScreenHelp } from "@/app/screen-help";
import { ActionBar } from "@/app/ui/action-bar";
import { getImportPreview, type PreviewRow } from "@/lib/import/apply";
import { getImportGapsView } from "@/lib/import/gaps";
import { contactRowTitle, rowEventReference } from "@/lib/import/matching";
import Link from "next/link";
import { importStepHref } from "@/lib/import/wizard";
import { listVendorTags } from "@/modules/vendors/service";
import { STATUS_LABEL_KEYS } from "@/app/events/event-status";
import { ImportHeader } from "../../import-header";
import { importStepContext, wantsAbandon } from "../../step-context";
import { reasonText } from "../ecarts/reasons";
import { SheetStatusSelect } from "./sheet-status-select";
import { ConfirmForm } from "./confirm-form";

// Décision J : libellés des statuts (fiche événement, module events) ; statuts du lot 34a (EVT-05).
const STATUS_KEYS: Record<string, string> = STATUS_LABEL_KEYS;

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
    if (preview.entityType === "contacts") return contactRowTitle(values) ?? t("rowWithoutLabel");
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
  // Lot 71c : le statut montré est celui choisi dans l'aperçu, sinon celui de « Où en est-il ? ».
  const chosen = new Set((wizard.draft.matching?.rowStatuses ?? []).map((entry) => entry.rowIndex));
  const stage = wizard.questions?.answers?.eventStage;
  const sheetStatus = (row: PreviewRow) => (stage && !chosen.has(row.rowIndex) ? eventStatusForStage(stage) : typeof row.values.status === "string" ? row.values.status : "option");
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

      {/* Lot 71c (C-64) : le statut d'une fiche vient de « Où en est-il ? », à l'étape « Questions » ; la
          planner peut encore le changer fiche par fiche ici (décision J). */}
      {preview.counts.creations > 0 && preview.entityType === "event_sheets" ? (
        <section aria-labelledby="preview-creations">
          <h2 id="preview-creations">{t("previewCreationsTitle", { count: preview.counts.creations })}</h2>
          <p>{t("sheetStatusIntro")}</p>
          <ul className="sheet-statuses">
            {preview.creations.map((row) => (
              <SheetStatusSelect
                key={row.rowIndex}
                importId={preview.importId}
                rowIndex={row.rowIndex}
                label={t("rowHeading", { line: row.lineNumber, title: describe(row.values) })}
                initialStatus={sheetStatus(row)}
                options={EVENT_STATUS_CHOICES.map((status) => ({ value: status, label: tEvents(STATUS_KEYS[status] ?? "statusOption") }))}
                savedText={t("sheetStatusSaved")}
                failedText={t("sheetStatusFailed")}
              />
            ))}
          </ul>
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
              <li key={blocker}>
                {t(`blocker.${blocker}`)}
                {/* Lot 67a (HUB-14 ; R04) : chaque blocage mène à l'écran qui le lève. */}
                {blocker === "matches_undecided" ? (
                  <>
                    {" "}
                    <Link href={`${importStepHref(importId, "matches")}?filtre=a-verifier`}>{t("blockerLink.matches_undecided")}</Link>
                  </>
                ) : blocker === "questions_pending" ? (
                  <>
                    {" "}
                    <Link href={importStepHref(importId, "questions")}>{t("blockerLink.questions_pending")}</Link>
                  </>
                ) : blocker === "columns_undecided" ? (
                  <>
                    {" "}
                    <Link href={`/import/${importId}/ecarts`}>{t("blockerLink.columns_undecided")}</Link>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        // Lot 71c (C-64) : la source d'une fiche est demandée à l'étape « Questions », facultative.
        <ConfirmForm importId={preview.importId} prospectSources={preview.entityType === "events" ? preview.prospectSources : null} />
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
