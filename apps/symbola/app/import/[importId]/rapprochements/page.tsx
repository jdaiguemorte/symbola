import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { formatCalendarDate, type Locale } from "@symbola/i18n";
import { HelpButton } from "@symbola/ui";
import type { ImportValue, PersonName } from "@symbola/import-engine";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { getImportMatchesView, rowEventReference, type MatchesRowView } from "@/lib/import/matching";
import type { EventCandidate } from "@/lib/import/candidates";
import { isValidId } from "../../access";
import { ImportSteps } from "../../import-steps";
import { decideMatchesAction, manualMatchAction } from "./actions";

function names(clients: PersonName[]): string {
  return clients.map((client) => `${client.firstName} ${client.lastName ?? ""}`.trim()).join(" & ");
}

// IMP-03 — étape « rapprochements » : chaque ligne qui ressemble à un
// élément existant est proposée au rapprochement (mise à jour au lieu d'un
// doublon), avec le niveau de ressemblance.
export default async function ImportMatchesPage({ params }: { params: Promise<{ importId: string }> }) {
  const auth = await getPlannerAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/mfa");
  if (auth.status === "forbidden") redirect(auth.role === "client" ? "/espace" : "/");
  if (!auth.user.organizationId) redirect("/");

  const { importId } = await params;
  if (!isValidId(importId)) notFound();
  const view = await getImportMatchesView(auth.user.organizationId, importId);
  if (!view) notFound();

  const t = await getTranslations("Import");
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) as Locale;

  const eventTitle = (event: EventCandidate | { eventDate: string | null; clients: PersonName[] }) => {
    const who = names(event.clients) || t("eventWithoutClients");
    return event.eventDate ? t("eventTitle", { clients: who, date: formatCalendarDate(event.eventDate, locale) }) : who;
  };
  const rowTitle = (values: Record<string, ImportValue>) => {
    if (view.entityType === "events") return eventTitle(rowEventReference(values));
    const label = view.entityType === "budget_lines" ? values.slotLabel : values.label;
    return typeof label === "string" ? label : t("rowWithoutLabel");
  };
  const optionTitle = (option: MatchesRowView["options"][number]) => (option.event ? eventTitle(option.event) : (option.label ?? ""));

  const proposedCount = view.rows.filter((row) => row.match?.status === "proposed").length;
  const valid = view.rows.filter((row) => row.errors.length === 0);
  const rejectedCount = view.rows.length - valid.length;

  return (
    <main>
      <h1>{t("matchesTitle", { fileName: view.fileName })}</h1>
      <HelpButton title={tHelp("importMatches.title")} body={tHelp("importMatches.body")} />
      <ImportSteps current={2} />
      <p>{t("matchesIntro")}</p>
      {rejectedCount > 0 ? <p>{t("matchesRejectedNotice", { count: rejectedCount })}</p> : null}

      {proposedCount > 0 ? (
        <form action={decideMatchesAction}>
          <input type="hidden" name="importId" value={view.importId} />
          <input type="hidden" name="decision" value="accept_all" />
          <button type="submit">{t("acceptAllMatches", { count: proposedCount })}</button>
        </form>
      ) : null}

      <form action={decideMatchesAction} id="bulk-matches">
        <input type="hidden" name="importId" value={view.importId} />
      </form>
      <ul>
        {valid.map((row) => {
          const title = rowTitle(row.values);
          const checkboxId = `match-${row.rowIndex}`;
          return (
            <li key={row.rowIndex}>
              <h2>{t("rowHeading", { line: row.lineNumber, title })}</h2>
              {row.event ? (
                <p>
                  {row.event.candidate
                    ? t("rowEvent", { event: eventTitle(row.event.candidate), score: row.event.score })
                    : t("rowEventNotFound")}
                </p>
              ) : null}
              {row.match ? (
                <>
                  <p>
                    {t("rowMatch", {
                      element: row.match.event ? eventTitle(row.match.event) : (row.match.label ?? ""),
                      score: row.match.score,
                    })}{" "}
                    — {t(`matchStatus.${row.match.status}`)}
                    {row.match.manual ? ` (${t("matchManual")})` : null}
                  </p>
                  {row.match.status === "proposed" ? (
                    <label htmlFor={checkboxId}>
                      <input type="checkbox" id={checkboxId} name="rowIndex" value={row.rowIndex} form="bulk-matches" />
                      {t("selectMatch", { title })}
                    </label>
                  ) : null}
                  <p>{row.match.status === "refused" ? t("rowWillCreate") : t("rowWillUpdate")}</p>
                </>
              ) : (
                <p>{row.event && !row.event.candidate ? t("rowWillBeRejected") : t("rowWillCreate")}</p>
              )}
              {row.options.length > 0 ? (
                <form action={manualMatchAction}>
                  <input type="hidden" name="importId" value={view.importId} />
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
            </li>
          );
        })}
      </ul>
      {proposedCount > 0 ? (
        <p>
          <button type="submit" form="bulk-matches" name="decision" value="accept">
            {t("acceptSelectedMatches")}
          </button>{" "}
          <button type="submit" form="bulk-matches" name="decision" value="refuse">
            {t("refuseSelectedMatches")}
          </button>
        </p>
      ) : null}
      <p>{t("nextStepsComing")}</p>
      <p>
        <Link href={`/import/${view.importId}`}>{t("backToDraft")}</Link>
      </p>
    </main>
  );
}
