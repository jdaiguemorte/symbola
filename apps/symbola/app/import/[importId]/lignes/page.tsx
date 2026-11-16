import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ScreenHelp } from "@/app/screen-help";
import { ActionBar } from "@/app/ui/action-bar";
import { getImportRowFilterView } from "@/lib/import/matching";
import { importStepHref } from "@/lib/import/wizard";
import { ImportHeader } from "../../import-header";
import { importStepContext, wantsAbandon } from "../../step-context";
import { saveRowFilterAction } from "./actions";

// Lot 36b (D11, SC-10) — étape « Lignes » d'un import de contacts : un fichier qui mêle clients,
// prospects et prestataires. Les valeurs d'une colonne (« Catégorie ») sont regroupées sans tenir
// compte de la casse ni des espaces ; cocher une valeur écarte ses lignes, qui restent au rapport
// des écarts (et à son téléchargement) pour être importées ailleurs.
export default async function ImportRowsPage({
  params,
  searchParams,
}: {
  params: Promise<{ importId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { importId } = await params;
  const { organizationId, wizard } = await importStepContext(importId);
  if (wizard.entityType !== "contacts") redirect(importStepHref(importId, wizard.next));
  const view = await getImportRowFilterView(organizationId, importId);
  if (!view) redirect(importStepHref(importId, wizard.next));
  const query = await searchParams;
  const t = await getTranslations("Import");
  const tHelp = await getTranslations("Help");
  const error = query.erreur === "colonnes" ? t("rowsErrorColumns") : query.erreur === "valeurs" ? t("rowsErrorValues") : null;

  return (
    <main className="import-assistant">
      <ImportHeader wizard={wizard} current="rows" abandon={wantsAbandon(query)} />
      <ScreenHelp title={tHelp("importRows.title")} body={tHelp("importRows.body")} />
      <p>{t("rowsIntro")}</p>
      {error ? <p role="alert">{error}</p> : null}

      <form action={saveRowFilterAction} id="rows-filter" className="stack">
        <input type="hidden" name="importId" value={importId} />
        {view.columns.length === 0 ? (
          <p>{t("rowsNoColumn")}</p>
        ) : (
          view.columns.map((column) => (
            <fieldset key={column.columnIndex} className="card stack">
              <legend>{t("rowsColumnLegend", { column: column.header.trim() || t("unnamedColumn", { number: column.columnIndex + 1 }) })}</legend>
              <p className="meta">{t("rowsColumnHint")}</p>
              {column.values.map((value, index) => {
                const id = `exclude-${column.columnIndex}-${index}`;
                const checked = view.filter?.columnIndex === column.columnIndex && view.filter.excluded.includes(value.value);
                return (
                  <label key={value.value} htmlFor={id}>
                    <input type="checkbox" id={id} name={`exclude-${column.columnIndex}`} value={value.value} defaultChecked={checked} />
                    {t("rowsValue", { value: value.label || t("rowsEmptyValue"), count: value.count })}
                  </label>
                );
              })}
            </fieldset>
          ))
        )}
      </form>

      <ActionBar label={t("actionBarLabel")} backHref={importStepHref(importId, "columns")} backLabel={t("back")}>
        <button type="submit" form="rows-filter">
          {t("continue")}
        </button>
      </ActionBar>
    </main>
  );
}
