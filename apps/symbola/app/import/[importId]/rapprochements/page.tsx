import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { formatCalendarDate, type Locale } from "@symbola/i18n";
import { ScreenHelp } from "@/app/screen-help";
import { ActionBar } from "@/app/ui/action-bar";
import type { ImportValue, PersonName } from "@symbola/import-engine";
import { contactRowTitle, rowEventReference, type MatchesRowView } from "@/lib/import/matching";
import { onlyOneNameInCommon } from "@/lib/import/vendor-compare";
import { importStepHref, SAFE_MATCH_SCORE } from "@/lib/import/wizard";
import type { EventCandidate } from "@/lib/import/candidates";
import { ImportHeader } from "../../import-header";
import { importStepContext, wantsAbandon } from "../../step-context";
import { decideMatchesAction, ignoreContactRowsAction, manualMatchAction, reviewMatchesAction } from "./actions";

const FILTERS = ["a-verifier", "nouveaux", "mises-a-jour"] as const;
type Filter = (typeof FILTERS)[number];
const PAGE_SIZE = 20;

function names(clients: PersonName[]): string {
  return clients.map((client) => `${client.firstName} ${client.lastName ?? ""}`.trim()).join(" & ");
}

// Une ligne à vérifier : une proposition en attente, une fiche du même lot
// qui décrit le même événement, ou un événement de rattachement introuvable.
function toCheck(row: MatchesRowView): boolean {
  // Lot 63b (HUB-14) : une proposition « À vérifier » y reste, même décidée, pour revoir son choix.
  return row.match?.status === "proposed" || row.sameAsLine !== undefined || (row.event !== undefined && !row.event.candidate) || row.match?.toVerify === true || row.compare?.toVerify === true;
}

const CHOICES = [
  { decision: "accept", status: "accepted", label: "matchChoiceSame" },
  { decision: "refuse", status: "refused", label: "matchChoiceTwo" },
  { decision: "later", status: "proposed", label: "matchChoiceLater" },
] as const;

// IMP-03 — étape « Doublons ». Lot 16 (IMP-11, ADR 0041) : tableau filtrable
// (« À vérifier », « Nouveaux », « Mises à jour »), 20 lignes par page, et
// « Tout accepter » pour les propositions sûres. Lot 63b (HUB-14) : un prestataire rapproché se
// vérifie côte à côte (nom, métier, ville, e-mail, téléphone, nombre d'évènements ; les différences
// dites par un texte), avec trois choix : « C'est le même », « Ce sont deux prestataires »,
// « Décider plus tard ».
export default async function ImportMatchesPage({
  params,
  searchParams,
}: {
  params: Promise<{ importId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { importId } = await params;
  const { wizard } = await importStepContext(importId);
  const view = wizard.matches;
  if (!view) redirect(importStepHref(importId, wizard.next));
  const query = await searchParams;

  const t = await getTranslations("Import");
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) as Locale;

  const eventTitle = (event: EventCandidate | { eventDate: string | null; clients: PersonName[] }) => {
    const who = names(event.clients) || t("eventWithoutClients");
    return event.eventDate ? t("eventTitle", { clients: who, date: formatCalendarDate(event.eventDate, locale) }) : who;
  };
  const rowTitle = (values: Record<string, ImportValue>) => {
    if (view.entityType === "events" || view.entityType === "event_sheets") return eventTitle(rowEventReference(values));
    if (view.entityType === "vendors") {
      const name = typeof values.name === "string" ? values.name : t("rowWithoutLabel");
      return typeof values.city === "string" ? `${name} — ${values.city}` : name;
    }
    if (view.entityType === "contacts") return contactRowTitle(values) ?? t("rowWithoutLabel");
    const label = view.entityType === "budget_lines" ? values.slotLabel : values.label;
    return typeof label === "string" ? label : t("rowWithoutLabel");
  };
  const optionTitle = (option: MatchesRowView["options"][number]) => (option.event ? eventTitle(option.event) : (option.label ?? ""));

  const valid = view.rows.filter((row) => row.errors.length === 0);
  const rejectedCount = view.rows.length - valid.length;
  const lists: Record<Filter, MatchesRowView[]> = {
    "a-verifier": valid.filter(toCheck),
    nouveaux: valid.filter((row) => !toCheck(row) && row.match?.status !== "accepted"),
    "mises-a-jour": valid.filter((row) => !toCheck(row) && row.match?.status === "accepted"),
  };
  const requested = FILTERS.find((filter) => filter === query.filtre);
  const filter: Filter = requested ?? (lists["a-verifier"].length > 0 ? "a-verifier" : "nouveaux");
  const pages = Math.max(1, Math.ceil(lists[filter].length / PAGE_SIZE));
  const page = Math.min(Math.max(Number(query.page) || 1, 1), pages);
  const shown = lists[filter].slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const compared = shown.filter((row) => row.compare && row.match);
  const tabled = shown.filter((row) => !(row.compare && row.match));
  const safeCount = valid.filter((row) => row.match?.status === "proposed" && row.match.score >= SAFE_MATCH_SCORE).length;
  const base = importStepHref(importId, "matches");
  const href = (values: { filtre?: Filter; page?: number }) => `${base}?filtre=${values.filtre ?? filter}${values.page && values.page > 1 ? `&page=${values.page}` : ""}`;
  const previousStep = wizard.steps.some((step) => step.key === "types") ? "types" : wizard.steps.some((step) => step.key === "rows") ? "rows" : "columns";
  // Lot 36b (DAT-12) : pour un contact, accepter, c'est compléter le contact existant ; refuser une
  // adresse déjà connue, c'est ignorer la ligne (jamais deux contacts pour une adresse).
  const isContacts = view.entityType === "contacts";
  const decisionText = (row: MatchesRowView) => {
    if (row.ignored) return t("rowIgnored");
    if (!row.match) return isContacts && row.sameAsLine !== undefined ? t("rowWillCompleteLine", { line: row.sameAsLine }) : t("rowWillCreate");
    if (row.match.status === "accepted") return isContacts ? t("rowWillComplete") : t("rowWillUpdate");
    if (row.match.status === "refused") return t("rowWillCreate");
    return t("matchStatus.proposed");
  };

  return (
    <main className="import-assistant">
      <ImportHeader wizard={wizard} current="matches" abandon={wantsAbandon(query)} />
      <ScreenHelp title={tHelp("importMatches.title")} body={tHelp("importMatches.body")} />
      <p>{t("matchesIntro")}</p>
      {rejectedCount > 0 ? <p className="muted">{t("matchesRejectedNotice", { count: rejectedCount })}</p> : null}

      <nav aria-label={t("matchesFilterLabel")} className="pills">
        {FILTERS.map((key) => (
          <Link key={key} href={href({ filtre: key })} aria-current={key === filter ? "true" : undefined} scroll={false}>
            {t(`matchesFilter.${key}`, { count: lists[key].length })}
          </Link>
        ))}
      </nav>

      {safeCount > 0 ? (
        <form action={decideMatchesAction} className="primary-action matches-accept-safe">
          <input type="hidden" name="importId" value={importId} />
          <input type="hidden" name="decision" value="accept_safe" />
          <button type="submit">{t("acceptSafeMatches", { count: safeCount })}</button>
        </form>
      ) : null}

      {shown.length === 0 ? <p>{t("matchesEmptyFilter")}</p> : null}

      {/* Lot 63b (HUB-14) : un prestataire rapproché se vérifie côte à côte. */}
      {compared.length > 0 ? (
        <ol className="matches-list" aria-label={t("matchCompareList")}>
          {compared.map((row) => {
            const compare = row.compare!;
            const title = rowTitle(row.values);
            const current = row.match!.status;
            const nameLine = compare.lines.find((line) => line.key === "name");
            const reason = compare.toVerify ? (nameLine?.file && nameLine.existing && onlyOneNameInCommon(nameLine.file, nameLine.existing) ? t("matchCheckOnlyFirstName") : t("matchCheckTypeAndCity")) : null;
            const headingId = `match-${row.rowIndex}`;
            return (
              <li key={row.rowIndex} className="match-compare" aria-labelledby={headingId}>
                <header>
                  <h3 id={headingId}>{t("matchCompareTitle", { line: row.lineNumber, title })}</h3>
                  {compare.toVerify ? <span className="badge badge-ambre">{t("matchToVerify")}</span> : null}
                </header>
                {reason ? <p className="meta">{reason}</p> : null}
                <div className="list-table-wrap" role="region" aria-label={t("matchCompareTable", { line: row.lineNumber })} tabIndex={0}>
                  <table>
                    <caption className="sr-only">{t("matchCompareTable", { line: row.lineNumber })}</caption>
                    <thead>
                      <tr>
                        <th scope="col">
                          <span className="sr-only">{t("matchCompareField")}</span>
                        </th>
                        <th scope="col">{t("matchCompareFile", { line: row.lineNumber })}</th>
                        <th scope="col">{t("matchCompareExisting")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {compare.lines.map((line) => (
                        <tr key={line.key}>
                          <th scope="row">{t(`matchCompareKey.${line.key}`)}</th>
                          <td className={line.different ? "is-different" : undefined}>{line.file ?? "—"}</td>
                          <td className={line.different ? "is-different" : undefined}>
                            {line.existing ?? "—"}
                            {line.different ? (
                              <>
                                {" "}
                                <span className="difference">{t("matchDifferent")}</span>
                              </>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <th scope="row">{t("matchCompareRecord")}</th>
                        <td>—</td>
                        <td>
                          <Link href={`/prestataires/${compare.vendorId}`} target="_blank" rel="noopener">
                            {t("matchOpenRecord")}
                          </Link>
                          {" · "}
                          {t("matchEventCount", { count: compare.eventCount })}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="meta">{t("matchCurrentChoice", { choice: t(CHOICES.find((choice) => choice.status === current)!.label) })}</p>
                <div className="match-choices">
                  {CHOICES.map((choice) => (
                    <form key={choice.decision} action={decideMatchesAction}>
                      <input type="hidden" name="importId" value={importId} />
                      <input type="hidden" name="rowIndex" value={row.rowIndex} />
                      <input type="hidden" name="decision" value={choice.decision} />
                      <button type="submit" aria-pressed={current === choice.status} className={choice.decision === "later" ? "button-secondary" : undefined} aria-label={t("matchChoiceFor", { choice: t(choice.label), title })}>
                        {t(choice.label)}
                      </button>
                    </form>
                  ))}
                </div>
                {row.options.length > 1 ? (
                  <details>
                    <summary>{t("matchOtherRecord")}</summary>
                    <form action={manualMatchAction} className="matches-manual">
                      <input type="hidden" name="importId" value={importId} />
                      <input type="hidden" name="rowIndex" value={row.rowIndex} />
                      <label htmlFor={`manual-${row.rowIndex}`}>{t("manualMatchLabel", { title })}</label>
                      <select id={`manual-${row.rowIndex}`} name="candidateId" defaultValue={row.match?.candidateId ?? row.options[0]?.id}>
                        {row.options.map((option) => (
                          <option key={option.id} value={option.id}>
                            {optionTitle(option)}
                          </option>
                        ))}
                      </select>
                      <button type="submit">{t("manualMatchSubmit")}</button>
                    </form>
                  </details>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : null}

      {tabled.length === 0 ? null : (
        <div className="list-table-wrap" role="region" aria-label={t("matchesTable")} tabIndex={0}>
          <table className="list-table matches-table">
            <thead>
              <tr>
                <th scope="col">{t("matchesHeaderLine")}</th>
                <th scope="col">{t("matchesHeaderElement")}</th>
                <th scope="col">{t("matchesHeaderProposal")}</th>
                <th scope="col">{t("matchesHeaderDecision")}</th>
              </tr>
            </thead>
            <tbody>
              {tabled.map((row) => {
                const title = rowTitle(row.values);
                return (
                  <tr key={row.rowIndex}>
                    <td>{row.lineNumber}</td>
                    <th scope="row">
                      {title}
                      {row.sameAsLine !== undefined ? <span className="meta"> {t(isContacts ? "rowSameEmail" : "rowSameAs", { line: row.sameAsLine })}</span> : null}
                      {row.event ? (
                        <span className="meta"> {row.event.candidate ? t("rowEvent", { event: eventTitle(row.event.candidate), score: row.event.score }) : t("rowEventNotFound")}</span>
                      ) : null}
                    </th>
                    <td>
                      {row.match
                        ? isContacts
                          ? t(row.match.reason === "email" ? "contactMatchEmail" : "contactMatchName", { element: row.match.label ?? "" })
                          : t("matchProposal", { element: row.match.event ? eventTitle(row.match.event) : (row.match.label ?? ""), score: row.match.score })
                        : row.event && !row.event.candidate
                          ? t("rowWillBeRejected")
                          : isContacts && row.sameAsLine !== undefined
                            ? t("contactSameLine", { line: row.sameAsLine })
                            : t("rowWillCreate")}
                    </td>
                    <td>
                      {isContacts && !row.match && row.sameAsLine !== undefined ? (
                        <div className="row-actions">
                          <span className="meta">{decisionText(row)}</span>
                          <form action={ignoreContactRowsAction}>
                            <input type="hidden" name="importId" value={importId} />
                            <input type="hidden" name="rowIndex" value={row.rowIndex} />
                            <input type="hidden" name="ignored" value={row.ignored ? "0" : "1"} />
                            <button type="submit" aria-label={t(row.ignored ? "decisionKeepFor" : "decisionIgnoreFor", { title })}>
                              {t(row.ignored ? "decisionKeep" : "decisionIgnore")}
                            </button>
                          </form>
                        </div>
                      ) : null}
                      {row.match ? (
                        <div className="row-actions">
                          <span className="meta">{isContacts ? decisionText(row) : row.match.status === "refused" ? t("rowWillCreate") : row.match.status === "accepted" ? t("rowWillUpdate") : t("matchStatus.proposed")}</span>
                          {row.match.status !== "accepted" ? (
                            <form action={decideMatchesAction}>
                              <input type="hidden" name="importId" value={importId} />
                              <input type="hidden" name="rowIndex" value={row.rowIndex} />
                              <input type="hidden" name="decision" value="accept" />
                              <button type="submit" aria-label={t(isContacts ? "decisionCompleteFor" : "decisionUpdateFor", { title })}>
                                {t(isContacts ? "decisionComplete" : "decisionUpdate")}
                              </button>
                            </form>
                          ) : null}
                          {row.match.status !== "refused" ? (
                            <form action={decideMatchesAction}>
                              <input type="hidden" name="importId" value={importId} />
                              <input type="hidden" name="rowIndex" value={row.rowIndex} />
                              <input type="hidden" name="decision" value="refuse" />
                              <button type="submit" aria-label={t(isContacts && row.match.reason === "email" ? "decisionIgnoreFor" : "decisionCreateFor", { title })}>
                                {t(isContacts && row.match.reason === "email" ? "decisionIgnore" : "decisionCreate")}
                              </button>
                            </form>
                          ) : null}
                        </div>
                      ) : null}
                      {row.options.length > 0 ? (
                        <form action={manualMatchAction} className="matches-manual">
                          <input type="hidden" name="importId" value={importId} />
                          <input type="hidden" name="rowIndex" value={row.rowIndex} />
                          <label htmlFor={`manual-${row.rowIndex}`}>{t("manualMatchLabel", { title })}</label>
                          <select id={`manual-${row.rowIndex}`} name="candidateId" defaultValue={row.match?.candidateId ?? row.options[0]?.id}>
                            {row.options.map((option) => (
                              <option key={option.id} value={option.id}>
                                {optionTitle(option)}
                              </option>
                            ))}
                          </select>
                          <button type="submit">{t("manualMatchSubmit")}</button>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 ? (
        <nav aria-label={t("pagination")} className="row-actions">
          {page > 1 ? (
            <Link href={href({ page: page - 1 })} scroll={false}>
              {t("previousPage")}
            </Link>
          ) : null}
          <span>{t("pageOf", { page, pages })}</span>
          {page < pages ? (
            <Link href={href({ page: page + 1 })} scroll={false}>
              {t("nextPage")}
            </Link>
          ) : null}
        </nav>
      ) : null}

      <form action={reviewMatchesAction} id="matches-review">
        <input type="hidden" name="importId" value={importId} />
      </form>
      <ActionBar label={t("actionBarLabel")} backHref={importStepHref(importId, previousStep)} backLabel={t("back")}>
        <button type="submit" form="matches-review">
          {t("continue")}
        </button>
      </ActionBar>
    </main>
  );
}
