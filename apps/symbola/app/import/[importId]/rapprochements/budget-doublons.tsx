// Lot 71d (HUB-14, BUD-01, PRE-01, UX-07 ; spécification du lot 71, § 5.4 ; maquette 08, C-57, C-61,
// P-03, P-16) — l'étape « Doublons » d'un budget, en deux parties. Les postes : chaque poste du fichier,
// le poste du mariage qui reçoit ses lignes et pourquoi, modifiable ; un poste réparti d'après le détail
// est « À vérifier », avec « C'est juste » ; un poste « à trouver » sans ligne se garde ou se retire. Les
// prestataires : ceux retrouvés tels quels au carnet, comptés ; un doublon possible comparé colonne par
// colonne, « Si c'est la même » en gras sur ce qui change. Aucun bouton ne tranche à la place de la
// planner ; la seule action principale est « Continuer », qui nomme ce qui reste.
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { formatAmount, type Locale } from "@symbola/i18n";
import { ScreenHelp } from "@/app/screen-help";
import { ActionBar } from "@/app/ui/action-bar";
import type { BudgetDoublonsView, DoublonsGroup, DoublonsVendorDoubt } from "@/lib/import/budget-doublons";
import { importStepHref, type ImportWizard } from "@/lib/import/wizard";
import { ImportHeader } from "../../import-header";
import { reviewMatchesAction } from "./actions";
import { ScrollToChoice } from "./scroll-to-choice";
import { confirmBudgetSplitAction, decideCarnetVendorAction, decideUnusedSlotAction, placeBudgetGroupAction } from "./budget-actions";

export async function BudgetDoublons({ view, wizard, abandon, remaining }: { view: BudgetDoublonsView; wizard: ImportWizard; abandon: boolean; remaining: boolean }) {
  const t = await getTranslations("ImportDoublons");
  const tImport = await getTranslations("Import");
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) as Locale;
  const importId = view.importId;
  const slotName = new Map(view.slotOptions.map((slot) => [slot.id, slot.label]));
  const previousStep = wizard.steps.some((step) => step.key === "questions") ? "questions" : "columns";
  const choiceCount = view.choices.length;

  const reasonText = (group: DoublonsGroup) => {
    if (group.reason === "new") return t("reason.new");
    if (group.reason === "same") return group.rows.length > 1 ? t("reason.sameLines", { count: group.rows.length }) : t("reason.same");
    return t(`reason.${group.reason}`);
  };

  const groupRow = (group: DoublonsGroup) => {
    const anchor = `poste-${Math.min(...group.rows.map((row) => row.rowIndex))}`;
    const rowFields = group.rows.map((row) => <input key={row.rowIndex} type="hidden" name="rowIndex" value={row.rowIndex} />);
    return (
      <tr key={group.fileSlot} id={anchor} className={group.pending ? "doublons-pending" : undefined}>
        <th scope="row">
          {group.fileSlot || t("withoutSlot")}
          <span className="meta">{t("groupMeta", { count: group.rows.length, planned: formatAmount(group.plannedCents, locale) })}</span>
        </th>
        <td>
          {group.reason === "split" ? (
            <ul className="doublons-split">
              {group.rows.map((row) => (
                <li key={row.rowIndex}>
                  {t("splitLine", { detail: row.lineLabel ?? t("withoutDetail"), slot: slotName.get(row.slotId ?? "") ?? "" })}
                </li>
              ))}
            </ul>
          ) : (
            <form action={placeBudgetGroupAction} className="doublons-place">
              <input type="hidden" name="importId" value={importId} />
              {rowFields}
              <label className="sr-only" htmlFor={`${anchor}-slot`}>
                {t("placeLabel", { slot: group.fileSlot })}
              </label>
              <select id={`${anchor}-slot`} name="slotId" defaultValue={group.slotId ?? "new"}>
                {view.slotOptions.map((slot) => (
                  <option key={slot.id} value={slot.id}>
                    {slot.label}
                  </option>
                ))}
                <option value="new">{t("newSlotOption", { slot: group.fileSlot })}</option>
              </select>
              <button type="submit">{t("placeSubmit")}</button>
            </form>
          )}
        </td>
        <td>
          {group.reason === "split" ? (
            <>
              {group.pending ? <span className="badge badge-warning">{t("toVerify")}</span> : <span className="meta">{t("splitConfirmed")}</span>}
              <p className="meta">{t("splitWhy")}</p>
              {group.pending ? (
                <form action={confirmBudgetSplitAction}>
                  <input type="hidden" name="importId" value={importId} />
                  {rowFields}
                  <button type="submit">{t("splitConfirm")}</button>
                </form>
              ) : null}
            </>
          ) : (
            <>
              {reasonText(group)}
              {group.reason === "new" ? <p className="meta">{t("newSlotWhy")}</p> : null}
            </>
          )}
        </td>
      </tr>
    );
  };

  const doubtBlock = (doubt: DoublonsVendorDoubt) => {
    const fields = (
      <>
        <input type="hidden" name="importId" value={importId} />
        <input type="hidden" name="index" value={doubt.index} />
      </>
    );
    const empty = t("notGiven");
    const lines: { key: string; file: string; carnet: string; same: string; changed: boolean }[] = [
      { key: "name", file: doubt.name, carnet: doubt.carnet.name, same: doubt.carnet.name, changed: doubt.name !== doubt.carnet.name },
      { key: "type", file: doubt.fileSlot ?? empty, carnet: doubt.carnet.typeLabel ?? empty, same: doubt.carnet.typeLabel ?? doubt.fileSlot ?? empty, changed: false },
      { key: "city", file: empty, carnet: doubt.carnet.city ?? empty, same: doubt.carnet.city ?? empty, changed: doubt.carnet.city !== null },
      { key: "event", file: t("plannedOnEvent", { planned: formatAmount(doubt.plannedCents, locale) }), carnet: t("noEvent"), same: t("retainedOn", { slot: doubt.fileSlot ?? "" }), changed: true },
    ];
    const reasons = [
      doubt.likeness.sharedWords.length > 0 ? t("likeness.words", { words: doubt.likeness.sharedWords.map((word) => `« ${word} »`).join(t("and")) }) : null,
      doubt.likeness.sameType ? t("likeness.type") : null,
      doubt.likeness.sameCity ? t("likeness.city") : null,
    ].filter((reason): reason is string => reason !== null);
    return (
      <article key={doubt.index} id={`prestataire-${doubt.index}`} className={`card doublons-vendor${doubt.decision === "proposed" ? " doublons-pending" : ""}`} aria-labelledby={`prestataire-${doubt.index}-title`}>
        <h3 id={`prestataire-${doubt.index}-title`}>{t("doubtTitle", { name: doubt.name })}</h3>
        <p className="meta">{doubt.lineNumber !== null ? t("doubtMeta", { line: doubt.lineNumber }) : t("doubtMetaNoLine")}</p>
        <div className="list-table-wrap" role="region" aria-label={t("compareLabel", { name: doubt.name })} tabIndex={0}>
          <table className="list-table doublons-compare">
            <caption className="sr-only">{t("compareLabel", { name: doubt.name })}</caption>
            <thead>
              <tr>
                <td />
                <th scope="col">{t("colFile")}</th>
                <th scope="col">{t("colCarnet")}</th>
                <th scope="col">{t("colIfSame")}</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.key}>
                  <th scope="row">{t(`field.${line.key}`)}</th>
                  <td>{line.file}</td>
                  <td>{line.carnet}</td>
                  <td>{line.changed ? <strong>{line.same}</strong> : line.same}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          {t("likeness.intro", { reasons: reasons.join(t("comma")) || t("likeness.none") })} {doubt.likeness.phoneComparable ? null : t("likeness.noPhone")}
        </p>
        <div className="row-actions" role="group" aria-label={t("doubtChoice", { name: doubt.name })}>
          <form action={decideCarnetVendorAction}>
            {fields}
            <input type="hidden" name="decision" value="same" />
            <button type="submit" aria-pressed={doubt.decision === "same"}>
              {t("same")}
            </button>
          </form>
          <form action={decideCarnetVendorAction}>
            {fields}
            <input type="hidden" name="decision" value="create" />
            <button type="submit" aria-pressed={doubt.decision === "create"}>
              {t("create")}
            </button>
          </form>
        </div>
        {doubt.decision !== "proposed" ? <p role="status">{doubt.decision === "same" ? t("sameChosen", { name: doubt.carnet.name }) : t("createChosen", { name: doubt.name })}</p> : null}
      </article>
    );
  };

  return (
    <main className="import-assistant doublons">
      <ImportHeader wizard={wizard} current="matches" abandon={abandon} />
      <ScreenHelp title={tHelp("importMatches.title")} body={tHelp("importMatches.body")} />
      {remaining && choiceCount > 0 ? (
        <div role="alert" className="doublons-remaining">
          <ScrollToChoice anchor={view.choices[0]!.anchor} />
          <p>
            {t("remaining", { count: choiceCount })}{" "}
            {view.choices.map((choice, index) => (
              <span key={choice.anchor}>
                {index > 0 ? t("comma") : null}
                <Link href={`#${choice.anchor}`}>{choice.label}</Link>
              </span>
            ))}
          </p>
        </div>
      ) : null}

      <section aria-labelledby="doublons-postes">
        <h2 id="doublons-postes">{t("slotsTitle", { file: view.fileSlotCount, event: view.eventSlotCount })}</h2>
        <p className="meta">{t("slotsIntro")}</p>
        <div className="list-table-wrap" role="region" aria-label={t("slotsCaption")} tabIndex={0}>
          <table className="list-table doublons-table">
            <caption className="sr-only">{t("slotsCaption")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("colInFile")}</th>
                <th scope="col">{t("colPlaced")}</th>
                <th scope="col">{t("colWhy")}</th>
              </tr>
            </thead>
            <tbody>{view.groups.map(groupRow)}</tbody>
          </table>
        </div>
        {view.unusedSlots.length > 0 ? (
          <div className="doublons-unused">
            <h3>{t("unusedTitle")}</h3>
            <ul>
              {view.unusedSlots.map((slot) => (
                <li key={slot.slotId} id={`poste-vide-${slot.slotId}`} className={slot.decision === null ? "doublons-pending" : undefined}>
                  <span>
                    <strong>{slot.label}</strong> <span className="meta">{slot.starter ? t("unusedStarter") : t("unusedOwn")}</span>
                  </span>
                  <span className="row-actions" role="group" aria-label={t("unusedChoice", { slot: slot.label })}>
                    {(["keep", "remove"] as const).map((decision) => (
                      <form key={decision} action={decideUnusedSlotAction}>
                        <input type="hidden" name="importId" value={importId} />
                        <input type="hidden" name="slotId" value={slot.slotId} />
                        <input type="hidden" name="decision" value={decision} />
                        <button type="submit" aria-pressed={slot.decision === decision}>
                          {t(`unused.${decision}`)}
                        </button>
                      </form>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {view.vendors.total > 0 ? (
        <section aria-labelledby="doublons-prestataires">
          <h2 id="doublons-prestataires">{t("vendorsTitle", { total: view.vendors.total, found: view.vendors.found })}</h2>
          {view.vendors.absent > 0 ? <p className="meta">{t("vendorsAbsent", { count: view.vendors.absent })}</p> : null}
          {view.vendors.doubts.map(doubtBlock)}
        </section>
      ) : null}

      <form action={reviewMatchesAction} id="matches-review">
        <input type="hidden" name="importId" value={importId} />
      </form>
      <ActionBar label={tImport("actionBarLabel")} backHref={importStepHref(importId, previousStep)} backLabel={tImport("back")}>
        <button type="submit" form="matches-review">
          {tImport("continue")}
        </button>
        {choiceCount > 0 ? <span className="meta doublons-left">{t("left", { count: choiceCount })}</span> : null}
      </ActionBar>
    </main>
  );
}
