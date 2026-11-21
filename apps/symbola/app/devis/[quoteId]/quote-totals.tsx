import { getTranslations } from "next-intl/server";
import { formatAmount, type Locale } from "@symbola/i18n";
import type { QuoteLine, QuoteVersionView } from "@/modules/quotes/service";
import { formatRate } from "../quote-display";
import { removeLineAction, removeSectionAction } from "./actions";
import { DisclosureButton, DisclosurePanel } from "./disclosure";
import { EditLineForm, RenameSectionForm } from "./quote-forms";

// DEV-01 — lignes d'une version (courante ou ancienne), en lecture : toujours calculées côté serveur.
// Lot 31a (FAC-01, D2) : lignes groupées par section (sous-total de chacune), options marquées
// « choisie » ou « non retenue » (hors du total).
// Lot 62d (UX-13, « liste éditable ») : sur un brouillon (`edit`), chaque ligne et chaque section porte
// ses actions (« Modifier », « Retirer ») ; la ligne s'ouvre en place, sous elle-même, une seule à la
// fois (le groupe d'ouverture est posé par l'écran).
// La colonne « Remise » n'apparaît que si une ligne en porte une ; `captionHidden` : la carte a déjà son
// titre, la légende reste le nom du tableau pour les lecteurs d'écran.
export async function QuoteLinesTable({
  version,
  locale,
  caption,
  captionHidden = false,
  edit,
}: {
  version: QuoteVersionView;
  locale: Locale;
  caption: string;
  captionHidden?: boolean;
  edit?: { quoteId: string } | undefined;
}) {
  const t = await getTranslations("Quotes");
  const tRubrics = await getTranslations("QuoteRubrics");
  const showDiscount = version.lines.some((line) => line.discountBasisPoints > 0);
  const dataColumns = 4 + (showDiscount ? 1 : 0) + (version.vatApplicable ? 1 : 0);
  const columns = dataColumns + (edit ? 1 : 0);
  const groups: { id: string | null; title: string | null; subtotalCents: number | null; lines: QuoteLine[] }[] = [
    { id: null, title: null, subtotalCents: null, lines: version.lines.filter((line) => line.sectionId === null || !version.sections.some((section) => section.id === line.sectionId)) },
    ...version.sections.map((section) => ({ id: section.id, title: section.title, subtotalCents: section.subtotalCents, lines: version.lines.filter((line) => line.sectionId === section.id) })),
  ].filter((group) => group.title !== null || group.lines.length > 0);
  return (
    <div role="region" aria-label={caption} tabIndex={0} className="quote-lines">
      <table>
        <caption className={captionHidden ? "sr-only" : undefined}>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{t("itemLabel")}</th>
            <th scope="col">{t("quantity")}</th>
            <th scope="col" className="amount">
              {t("itemUnitPrice")}
            </th>
            {showDiscount ? (
              <th scope="col" className="amount">
                {t("lineDiscount")}
              </th>
            ) : null}
            {version.vatApplicable ? (
              <th scope="col" className="amount">
                {t("itemVatRate")}
              </th>
            ) : null}
            <th scope="col" className="amount">
              {t("lineTotal")}
            </th>
            {edit ? (
              <th scope="col" className="quote-actions-cell">
                {tRubrics("actions")}
              </th>
            ) : null}
          </tr>
        </thead>
        {groups.map((group) => {
          const section = edit && group.id !== null ? version.sections.find((candidate) => candidate.id === group.id) : undefined;
          return (
            <tbody key={group.id ?? "sans-section"}>
              {group.title !== null ? (
                <tr className="quote-section-row">
                  <th scope="colgroup" colSpan={edit ? columns - 1 : columns}>
                    {group.title}
                  </th>
                  {edit && section ? (
                    <td className="quote-actions-cell">
                      <div className="quote-row-actions">
                        <DisclosureButton className="quote-row-button" id={`section-${section.id}`} label={t("renameSectionNamed", { title: section.title })}>
                          {t("renameSection")}
                        </DisclosureButton>
                        <form action={removeSectionAction}>
                          <input type="hidden" name="quoteId" value={edit.quoteId} />
                          <input type="hidden" name="sectionId" value={section.id} />
                          <button type="submit" className="quote-row-button quote-remove" aria-label={t("removeSection", { title: section.title })}>
                            {tRubrics("remove")}
                          </button>
                        </form>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ) : null}
              {edit && section ? (
                <DisclosurePanel id={`section-${section.id}`} as="row" columns={columns} className="quote-edit-row">
                  <RenameSectionForm quoteId={edit.quoteId} section={section} />
                </DisclosurePanel>
              ) : null}
              {group.lines.map((line) => (
                <QuoteLineRows key={line.id} line={line} version={version} locale={locale} columns={columns} showDiscount={showDiscount} edit={edit} />
              ))}
              {group.title !== null ? (
                <tr className="quote-section-subtotal">
                  <th scope="row" colSpan={dataColumns - 1}>
                    {t("sectionSubtotal", { title: group.title })}
                  </th>
                  <td className="amount">{formatAmount(group.subtotalCents ?? 0, locale)}</td>
                  {edit ? <td className="quote-actions-cell" /> : null}
                </tr>
              ) : null}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}

async function QuoteLineRows({
  line,
  version,
  locale,
  columns,
  showDiscount,
  edit,
}: {
  line: QuoteLine;
  version: QuoteVersionView;
  locale: Locale;
  columns: number;
  showDiscount: boolean;
  edit?: { quoteId: string } | undefined;
}) {
  const t = await getTranslations("Quotes");
  const tRubrics = await getTranslations("QuoteRubrics");
  return (
    <>
      <tr className={line.isOption && !line.optionChosen ? "quote-option-unchosen" : undefined}>
        <th scope="row">
          {line.label}
          {line.isOption ? (
            <>
              {" "}
              <span className="badge badge-wrap">{line.optionChosen ? t("optionChosen") : t("optionNotChosen")}</span>
            </>
          ) : null}
          {/* Lot 48b (JUR-10) : facturée par le prestataire au client, hors du total. */}
          {line.supplyMode === "intermediary" ? (
            <>
              {" "}
              <span className="badge badge-wrap">{t("lineIntermediaryBadge")}</span>
            </>
          ) : null}
          {line.description ? (
            <>
              <br />
              <small>{line.description}</small>
            </>
          ) : null}
        </th>
        <td>
          {new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-GB", { maximumFractionDigits: 3 }).format(line.quantityMilli / 1000)} {line.unit}
        </td>
        <td className="amount">{formatAmount(line.unitPriceCents, locale)}</td>
        {showDiscount ? <td className="amount">{line.discountBasisPoints > 0 ? `${formatRate(line.discountBasisPoints, locale)} %` : "—"}</td> : null}
        {version.vatApplicable ? <td className="amount">{formatRate(line.vatRateBasisPoints, locale)} %</td> : null}
        <td className="amount">{formatAmount(line.netCents, locale)}</td>
        {edit ? (
          <td className="quote-actions-cell">
            <div className="quote-row-actions">
              <DisclosureButton className="quote-row-button" id={`ligne-${line.id}`} label={t("editLineNamed", { label: line.label })}>
                {tRubrics("edit")}
              </DisclosureButton>
              <form action={removeLineAction}>
                <input type="hidden" name="quoteId" value={edit.quoteId} />
                <input type="hidden" name="lineId" value={line.id} />
                <button type="submit" className="quote-row-button quote-remove" aria-label={t("removeLine", { label: line.label })}>
                  {tRubrics("remove")}
                </button>
              </form>
            </div>
          </td>
        ) : null}
      </tr>
      {edit ? (
        <DisclosurePanel id={`ligne-${line.id}`} as="row" columns={columns} className="quote-edit-row">
          <EditLineForm quoteId={edit.quoteId} line={line} vatApplicable={version.vatApplicable} sections={version.sections} />
        </DisclosurePanel>
      ) : null}
    </>
  );
}

// Totaux d'une version : HT, remise globale, TVA par taux (ADR 0059), TTC.
export async function QuoteTotalsList({ version, locale }: { version: QuoteVersionView; locale: Locale }) {
  const t = await getTranslations("Quotes");
  const { totals } = version;
  return (
    <dl className="quote-totals-list">
      <dt>{t("subtotal")}</dt>
      <dd>{formatAmount(totals.subtotalCents, locale)}</dd>
      {totals.globalDiscountCents > 0 ? (
        <>
          <dt>{t("globalDiscount")}</dt>
          <dd>− {formatAmount(totals.globalDiscountCents, locale)}</dd>
        </>
      ) : null}
      <dt>{t("totalHt")}</dt>
      <dd>{formatAmount(totals.totalHtCents, locale)}</dd>
      {totals.vatByRate.map((vat) => (
        <div key={vat.rateBasisPoints}>
          <dt>{t("vatAtRate", { rate: formatRate(vat.rateBasisPoints, locale) })}</dt>
          <dd>{formatAmount(vat.vatCents, locale)}</dd>
        </div>
      ))}
      <dt className="quote-total-ttc">{t("totalTtc")}</dt>
      <dd className="quote-total-ttc">
        <strong>{formatAmount(totals.totalTtcCents, locale)}</strong>
      </dd>
    </dl>
  );
}

// Une version précédente, en lecture : ses lignes puis ses totaux.
export async function QuoteVersionTable({ version, locale, caption }: { version: QuoteVersionView; locale: Locale; caption: string }) {
  return (
    <>
      <QuoteLinesTable version={version} locale={locale} caption={caption} />
      <QuoteTotalsList version={version} locale={locale} />
    </>
  );
}
