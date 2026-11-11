import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ScreenHelp } from "@/app/screen-help";
import { ActionBar } from "@/app/ui/action-bar";
import { FamilyIcon } from "@/app/prestataires/family-icon";
import { getImportTypesView, type ImportTypesView } from "@/lib/import/matching";
import { importStepHref } from "@/lib/import/wizard";
import { ImportHeader } from "../../import-header";
import { importStepContext, wantsAbandon } from "../../step-context";
import { typeTargetValue } from "../../type-target";
import { saveTypesAction } from "./actions";

// Jeton ink-muted de DESIGN.md : la couleur d'une famille passe par l'attribut SVG fill,
// qui ne lit pas les variables CSS.
const UNCLASSIFIED_COLOR = "#5A6372";

// Liste « devient » d'un libellé : aucun type, un type du carnet ou un type de
// départ (par famille), ou un type créé sous le libellé du fichier.
function TargetOptions({ view, label, t }: { view: ImportTypesView; label: string; t: (key: string, values?: Record<string, string>) => string }) {
  const groups = [
    ...view.families.map((family) => ({ key: family.id, label: family.label, familyId: family.id as string | null })),
    { key: "none", label: t("typesUnclassifiedGroup"), familyId: null as string | null },
  ];
  return (
    <>
      <option value="none">{t("typeTargetNone")}</option>
      {groups.map((group) => {
        const types = view.types.filter((type) => type.familyId === group.familyId);
        const starters = view.starters.filter((starter) => starter.familyId === group.familyId);
        if (types.length + starters.length === 0) return null;
        return (
          <optgroup key={group.key} label={group.label}>
            {types.map((type) => (
              <option key={type.id} value={typeTargetValue({ kind: "existing", typeId: type.id })}>
                {type.label}
              </option>
            ))}
            {starters.map((starter) => (
              <option key={starter.key} value={typeTargetValue({ kind: "starter", starterKey: starter.key })}>
                {t("typeTargetStarter", { type: starter.label })}
              </option>
            ))}
          </optgroup>
        );
      })}
      <optgroup label={t("typeTargetNewGroup", { label })}>
        {view.families.map((family) => (
          <option key={family.id} value={typeTargetValue({ kind: "new", familyId: family.id })}>
            {t("typeTargetNewIn", { label, family: family.label })}
          </option>
        ))}
        <option value={typeTargetValue({ kind: "new", familyId: null })}>{t("typeTargetNewUnclassified", { label })}</option>
      </optgroup>
    </>
  );
}

// IMP-12 — étape « Types » (prestataires) : les libellés du fichier regroupés
// par famille, avec ce qu'ils deviennent ; jamais un type par libellé d'office.
export default async function ImportTypesPage({
  params,
  searchParams,
}: {
  params: Promise<{ importId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { importId } = await params;
  const { organizationId, wizard } = await importStepContext(importId);
  const columnsDone = wizard.steps.find((step) => step.key === "columns")?.done ?? false;
  if (wizard.entityType !== "vendors" || !columnsDone) redirect(importStepHref(importId, wizard.next));
  const view = await getImportTypesView(organizationId, importId);
  if (!view) redirect(importStepHref(importId, wizard.next));

  const t = await getTranslations("Import");
  const tHelp = await getTranslations("Help");
  const translate = (key: string, values?: Record<string, string>) => t(key, values);
  const indexed = view.choices.map((choice, index) => ({ ...choice, index }));
  const groups = [
    ...view.families.map((family) => ({ key: family.id, label: family.label, color: family.color, icon: family.icon, choices: indexed.filter((choice) => choice.familyId === family.id) })),
    { key: "none", label: t("typesUnclassifiedGroup"), color: UNCLASSIFIED_COLOR, icon: "other", choices: indexed.filter((choice) => choice.familyId === null) },
  ].filter((group) => group.choices.length > 0);

  return (
    <main className="import-assistant">
      <ImportHeader wizard={wizard} current="types" abandon={wantsAbandon(await searchParams)} />
      <ScreenHelp title={tHelp("importTypes.title")} body={tHelp("importTypes.body")} />
      <p>{t("typesIntro", { count: view.choices.length })}</p>
      <form action={saveTypesAction} id="types-form">
        <input type="hidden" name="importId" value={view.importId} />
        <input type="hidden" name="count" value={view.choices.length} />
        {groups.map((group) => (
          <section key={group.key} aria-labelledby={`types-${group.key}`} className="types-group">
            <h2 id={`types-${group.key}`} className="family-cell">
              <FamilyIcon color={group.color} icon={group.icon} />
              {group.label}
              <span className="meta">{t("typesGroupCount", { labels: group.choices.length, rows: group.choices.reduce((sum, choice) => sum + choice.rowCount, 0) })}</span>
            </h2>
            <div className="list-table-wrap" role="region" aria-label={t("typesGroupTable", { family: group.label })} tabIndex={0}>
              <table className="list-table">
                <thead>
                  <tr>
                    <th scope="col">{t("typesHeaderLabel")}</th>
                    <th scope="col">{t("typesHeaderRows")}</th>
                    <th scope="col">{t("typesHeaderBecomes")}</th>
                  </tr>
                </thead>
                <tbody>
                  {group.choices.map((choice) => (
                    <tr key={choice.label}>
                      <th scope="row">{choice.label}</th>
                      <td>{choice.rowCount}</td>
                      <td>
                        <input type="hidden" name={`label-${choice.index}`} value={choice.label} />
                        <label className="sr-only" htmlFor={`type-${choice.index}`}>
                          {t("typesBecomesLabel", { label: choice.label })}
                        </label>
                        <select id={`type-${choice.index}`} name={`type-${choice.index}`} defaultValue={typeTargetValue(choice.target)}>
                          <TargetOptions view={view} label={choice.label} t={translate} />
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </form>
      <ActionBar label={t("actionBarLabel")} backHref={importStepHref(importId, "columns")} backLabel={t("back")}>
        <button type="submit" form="types-form">
          {t("continue")}
        </button>
      </ActionBar>
    </main>
  );
}
