// Lot 71d (HUB-14, BUD-01, UX-07 ; spécification du lot 71, § 5.4 ; maquette 08, C-58, C-53, C-55,
// C-56) — les nombres d'un import, mot pour mot les mêmes à « Vérifier » et au bilan : ils viennent tous
// deux d'importFigures. Un réel vide est « non renseigné » ; « engagé » ne s'affiche pas : le réel est
// « réel selon votre fichier ». Montants en chiffres de même largeur, espace des milliers et « € ».
import { getLocale, getTranslations } from "next-intl/server";
import type { ImportFigures } from "@symbola/contracts";
import { formatAmount, formatCalendarDate, type Locale } from "@symbola/i18n";

export async function ImportFiguresList({ figures, done }: { figures: ImportFigures; done: boolean }) {
  const t = await getTranslations("ImportFigures");
  const locale = (await getLocale()) as Locale;
  if (figures.kind === "rows") {
    return (
      <ul className="import-figures">
        <li>{t("rows", { count: figures.rows })}</li>
      </ul>
    );
  }
  const amount = (cents: number) => <span className="import-figure-amount">{formatAmount(cents, locale)}</span>;
  const range =
    figures.toPayFrom && figures.toPayTo
      ? figures.toPayFrom === figures.toPayTo
        ? t("toPayOn", { date: formatCalendarDate(figures.toPayFrom, locale) })
        : t("toPayRange", { from: formatCalendarDate(figures.toPayFrom, locale), to: formatCalendarDate(figures.toPayTo, locale) })
      : "";
  return (
    <ul className="import-figures">
      <li>
        <strong>{t("lines", { lines: figures.lines, slots: figures.slots, newSlots: figures.newSlots })}</strong>
      </li>
      <li>
        {amount(figures.plannedCents)} {t("planned")}
      </li>
      <li>
        {amount(figures.realCents)} {t("real", { missing: figures.realMissing })}
      </li>
      <li>
        {amount(figures.paidCents)} {t("paid", { count: figures.paidCount })}
      </li>
      <li>
        {amount(figures.toPayCents)} {t("toPay", { count: figures.toPayCount })}
        {range}
      </li>
      <li>
        {t("vendors", { count: figures.vendors, outside: figures.vendorsOutsideCarnet })} · {t(done ? "notDoneAfter" : "notDoneBefore", { overdue: figures.overdue })}
      </li>
    </ul>
  );
}
