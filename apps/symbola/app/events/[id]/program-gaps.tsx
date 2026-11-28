// Lot 71e (CHR-06, CHR-08 ; spécification du lot 71, § 5.5, critère 6 ; maquette 11, D5, R12) — en tête de
// l'onglet d'un programme repris : « À compléter : 5 heures de fin non renseignées », puis chaque moment
// concerné avec ses deux gestes, saisir l'heure de fin ou le dire « Ponctuel » (retiré du compte) ; le
// bloc disparaît à zéro. Rendu côté serveur, des formulaires simples (NFR-02 : rien de plus au
// navigateur). L'onglet du programme est refait au lot 72g, qui reprend ces gestes.
import { getLocale, getTranslations } from "next-intl/server";
import { formatCalendarDate, type Locale } from "@symbola/i18n";
import { clockLabel } from "@/lib/import/pdf-import-rules";
import { completeProgramItemAction } from "./program-actions";

export type ProgramGapRow = { id: string; label: string; startTime: string; day: { name: string; date: string } | null };

export async function ProgramGaps({ eventId, rows, published }: { eventId: string; rows: ProgramGapRow[]; published: boolean }) {
  if (rows.length === 0) return null;
  const t = await getTranslations("ProgramGaps");
  const locale = (await getLocale()) as Locale;
  const lang = locale === "en" ? "en" : "fr";
  return (
    <section className="notice notice-attention program-gaps stack" aria-labelledby="program-gaps-title" id="a-completer">
      <h3 id="program-gaps-title">{t("title", { count: rows.length })}</h3>
      <p>
        {t("body")} {published ? null : t("notShared")} <a href={`#fin-${rows[0]!.id}`}>{t("goFirst")}</a>
      </p>
      <div className="list-table-wrap" role="region" tabIndex={0} aria-label={t("tableLabel")}>
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">{t("colMoment")}</th>
              <th scope="col">{t("colDay")}</th>
              <th scope="col">{t("endLabel")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} id={`fin-${row.id}`}>
                <th scope="row">
                  {clockLabel(row.startTime, lang)} · {row.label}
                  <span className="meta"> · {t("endMissing")}</span>
                </th>
                <td>{row.day ? `${row.day.name}, ${formatCalendarDate(row.day.date, locale)}` : ""}</td>
                <td>
                  <form action={completeProgramItemAction} className="form-inline">
                    <input type="hidden" name="eventId" value={eventId} />
                    <input type="hidden" name="itemId" value={row.id} />
                    <input type="time" name="endTime" aria-label={t("endFor", { label: row.label })} />
                    <button type="submit" name="intent" value="end" className="button-secondary">
                      {t("saveEnd")}
                    </button>
                    <button type="submit" name="intent" value="point" className="button-secondary" aria-label={t("pointFor", { label: row.label })}>
                      {t("point")}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
