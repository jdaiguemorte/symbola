// Lot 71d (HUB-14, BUD-01, UX-07 ; spécification du lot 71, § 5.4 ; maquette 08, C-58, C-66, D5) — le
// bilan d'un budget importé : qui, quand ; les mêmes nombres qu'à « Vérifier », mot pour mot (gardés au
// journal à l'écriture) ; ce qui n'a pas été repris, avec la raison et une suite ; ce que la planner a
// choisi (réponses et choix de « Doublons ») ; et maintenant (la reprise, le budget).
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import type { ImportAnswers, ImportFigures } from "@symbola/contracts";
import { formatDateTime, type Locale } from "@symbola/i18n";
import type { UndoPreview } from "@/lib/import/apply";
import { ImportFiguresList } from "../../import-figures";

export async function BudgetBilan({
  view,
  eventName,
  author,
  answers,
  back,
  budgetHref,
}: {
  view: UndoPreview;
  eventName: string | null;
  author: string | null;
  answers: ImportAnswers | null;
  back: { href: string; eventName: string | null } | null;
  budgetHref: string | null;
}) {
  const t = await getTranslations("ImportBilan");
  const locale = (await getLocale()) as Locale;
  const result = view.result!;
  const figures = result.figures as ImportFigures;
  const lines = figures.kind === "budget" ? figures.lines : 0;
  const paidCount = figures.kind === "budget" ? figures.paidCount : 0;
  const choices = result.choices ?? { splits: [], removedSlots: [], sameVendors: [], createdVendors: [] };
  const chosen = [
    answers?.depositsPaid ? t(`deposits.${answers.depositsPaid.answer}`, { count: paidCount }) : null,
    answers?.contracts ? t(`contracts.${answers.contracts.answer}`) : null,
    ...choices.splits.map((slot) => t("chosenSplit", { slot })),
    ...choices.sameVendors.map((entry) => t("chosenSame", { name: entry.name, vendor: entry.vendorName })),
    ...choices.createdVendors.map((name) => t("chosenCreated", { name })),
    ...choices.removedSlots.map((slot) => t("chosenRemoved", { slot })),
  ].filter((entry): entry is string => entry !== null);

  return (
    <section className="card stack import-bilan" aria-labelledby="bilan-title">
      <h2 id="bilan-title" className="sr-only">
        {t("summaryTitle")}
      </h2>
      <p className="meta">
        {view.appliedAt ? t("importedBy", { file: view.fileName, date: formatDateTime(view.appliedAt, locale), author: author ?? t("someone") }) : view.fileName}
      </p>
      {view.status === "applied" && budgetHref ? (
        <p>
          <Link href={budgetHref} className="button-link button-link-primary">
            {t("seeBudget")}
          </Link>
        </p>
      ) : null}
      <ImportFiguresList figures={figures} done />

      <h3>{t("notTakenTitle")}</h3>
      <p>{result.rejected > 0 ? t("notTaken", { count: result.rejected }) : t("notTakenNone", { count: lines })}</p>

      {chosen.length > 0 ? (
        <>
          <h3>{t("chosenTitle")}</h3>
          <ul>
            {chosen.map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
        </>
      ) : null}

      {back && view.status === "applied" ? (
        <>
          <h3>{t("nextTitle")}</h3>
          <p>
            {t("nextTakeover", { event: eventName ?? back.eventName ?? "" })} <Link href={back.href}>{t("backToTakeover")}</Link>
          </p>
        </>
      ) : null}
    </section>
  );
}
