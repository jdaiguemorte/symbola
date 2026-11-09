import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import { formatCalendarDate, formatDateTime, type Locale } from "@symbola/i18n";
import { starterRequestResponse } from "@symbola/starter-templates";
import { ScreenHelp } from "@/app/screen-help";
import { PageHeader } from "@/app/ui/page-header";
import { requireOwner } from "@/lib/guards";
import {
  getDocumentHeader,
  getPrivacyCase,
  getPrivacyErasure,
  PRIVACY_CASE_STEPS,
  PrivacyRequestNotFoundError,
  type PrivacyCaseStep,
  type PrivacyCaseView,
} from "@/modules/hub/service";
import { CopyButton } from "../../copy-button";
import { deadlineBadge } from "../../deadline";
import { buildErasureProof } from "../../oublis/proof";
import { fillTemplate } from "../../oublis/proof-model";
import { PrivacyTabs } from "../../privacy-tabs";
import { SearchForm } from "../../search-form";
import { closeRequestAction, markActionDoneAction, markResponseSentAction } from "../actions";
import { ExtendRequestForm } from "../request-forms";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Lot 18 (RGPD-07, ADR 0047) — dossier d'une demande, suivi de bout en bout :
// 1 enregistrée, 2 données retrouvées (recherche déjà remplie avec la
// personne), 3 effacement, export ou action menée à la main, 4 réponse à la
// personne (modèle prêt à copier, preuve), 5 clôture. L'échéance reste en
// tête ; un journal retrace les jalons. Titulaire du compte seulement.
export default async function PrivacyCasePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ etape?: string }>;
}) {
  const auth = await requireOwner();
  const t = await getTranslations("Privacy");
  const tHelp = await getTranslations("Help");
  if (!auth) {
    return (
      <main>
        <h1>{t("title")}</h1>
        <p>{t("ownerOnly")}</p>
      </main>
    );
  }
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const organizationId = auth.user.organizationId;
  const db = appDatabase();
  let view: PrivacyCaseView;
  try {
    view = await getPrivacyCase(db, organizationId, id);
  } catch (error) {
    if (error instanceof PrivacyRequestNotFoundError) notFound();
    throw error;
  }
  const locale = (await getLocale()) as Locale;
  const date = (value: string) => formatCalendarDate(value, locale);
  const when = (value: Date) => formatDateTime(value, locale);
  // L'étape affichée est toujours dans l'adresse : une action qui recharge la
  // page (export, prolongation) ne fait pas sauter le dossier à une autre étape.
  const asked = (await searchParams).etape;
  if (!PRIVACY_CASE_STEPS.includes(asked as PrivacyCaseStep)) redirect(`/rgpd/demandes/${id}?etape=${view.current}`);
  const step = asked as PrivacyCaseStep;
  const { request } = view;
  const closed = request.status === "closed";
  const badge = deadlineBadge(request, t, locale);

  // Modèle de réponse : celui de l'oubli (avec les données conservées et
  // leur motif légal), sinon celui du type de demande.
  let response: { subject: string; body: string } | null = null;
  if (view.actionDone) {
    if (view.actionKind === "erasure" && view.erasure) {
      response = (await buildErasureProof(organizationId, await getPrivacyErasure(db, organizationId, view.erasure.id))).response;
    } else if (request.type !== "erasure") {
      const template = starterRequestResponse(request.type, locale === "en" ? "en" : "fr");
      const completedAt = view.actionKind === "export" ? (view.exports[0]?.createdAt ?? null) : request.actionDoneAt;
      response = {
        subject: template.subject,
        body: fillTemplate(template.body, {
          person: request.personLabel,
          receivedOn: date(request.receivedOn),
          completedOn: completedAt ? formatCalendarDate(completedAt.toISOString().slice(0, 10), locale) : "—",
          organization: (await getDocumentHeader(db, organizationId))?.organizationName ?? "",
        }),
      };
    }
  }

  const journal: { at: Date; label: string }[] = [
    { at: request.createdAt, label: t("journalCreated") },
    ...(request.extendedAt ? [{ at: request.extendedAt, label: t("journalExtended") }] : []),
    ...(view.erasure ? [{ at: view.erasure.createdAt, label: t("journalErasureStarted") }] : []),
    ...(view.erasure?.completedAt ? [{ at: view.erasure.completedAt, label: t("journalErasureCompleted") }] : []),
    ...view.exports.map((item) => ({ at: item.createdAt, label: t("journalExport", { count: item.recordCount }) })),
    ...(request.actionDoneAt ? [{ at: request.actionDoneAt, label: t("journalActionDone") }] : []),
    ...(request.responseSentAt ? [{ at: request.responseSentAt, label: t("journalResponseSent") }] : []),
    ...(request.closedAt ? [{ at: request.closedAt, label: t("journalClosed") }] : []),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  const toStep = (target: PrivacyCaseStep) => `/rgpd/demandes/${request.id}?etape=${target}`;

  return (
    <main>
      <PageHeader
        title={t("caseTitle", { type: t(`requestType.${request.type}`), person: request.personLabel })}
        badge={<span className={badge.className}>{badge.label}</span>}
        subtitle={t("caseFacts", { received: date(request.receivedOn), due: date(request.dueOn) })}
      />
      <ScreenHelp title={tHelp("privacyCase.title")} body={tHelp("privacyCase.body")} />
      <PrivacyTabs />
      <p>
        <Link href="/rgpd">{t("backToRequests")}</Link>
      </p>

      <div className="case-layout">
        <nav aria-label={t("caseStepsLabel")}>
          <ol className="case-steps">
            {PRIVACY_CASE_STEPS.map((item, index) => (
              <li key={item} className={`case-step-${view.steps[item]}`}>
                <Link href={toStep(item)} aria-current={item === step ? "step" : undefined}>
                  <span>{t("caseStepItem", { number: index + 1, label: t(`caseStep.${item}`) })}</span>
                  <small>{t(`caseState.${view.steps[item]}`)}</small>
                </Link>
              </li>
            ))}
          </ol>
        </nav>

        <section className="case-panel card" aria-labelledby="case-step-title">
          <h2 id="case-step-title">{t(`caseStep.${step}`)}</h2>

          {step === "registered" ? (
            <>
              <dl className="case-facts">
                <dt>{t("requestTypeLabel")}</dt>
                <dd>{t(`requestType.${request.type}`)}</dd>
                <dt>{t("personLabel")}</dt>
                <dd>{request.personLabel}</dd>
                <dt>{t("receivedOnLabel")}</dt>
                <dd>{date(request.receivedOn)}</dd>
                <dt>{t("dueOnLabel")}</dt>
                <dd>{date(request.dueOn)}</dd>
              </dl>
              {request.extensionReason ? <p>{t("extensionReasonValue", { reason: request.extensionReason })}</p> : null}
              {request.status === "open" ? (
                <>
                  <h3>{t("extendTitle")}</h3>
                  <p className="meta">{t("extendHint")}</p>
                  <ExtendRequestForm requestId={request.id} personLabel={request.personLabel} />
                </>
              ) : null}
              <p>
                <Link href={toStep("found")}>{t("caseNext")}</Link>
              </p>
            </>
          ) : null}

          {step === "found" ? (
            closed ? (
              <p>{t("caseClosedNoAction")}</p>
            ) : (
              <>
                <p>{t(`caseFoundIntro.${view.actionKind}`)}</p>
                <SearchForm request={{ id: request.id, type: request.type, personLabel: request.personLabel }} />
              </>
            )
          ) : null}

          {step === "action" ? (
            <>
              {view.actionKind === "erasure" ? (
                view.erasure ? (
                  <>
                    <p>{t(`caseErasureStatus.${view.erasure.status}`, { date: when(view.erasure.completedAt ?? view.erasure.createdAt) })}</p>
                    <p>
                      <Link href={`/rgpd/oublis/${view.erasure.id}`}>{t("caseErasureDetail")}</Link>
                    </p>
                  </>
                ) : (
                  <p>
                    {t("caseActionNeedsSearch")} <Link href={toStep("found")}>{t("caseGoToSearch")}</Link>
                  </p>
                )
              ) : null}

              {view.actionKind === "export" ? (
                view.exports.length > 0 ? (
                  <>
                    <p>{t("caseExportsIntro")}</p>
                    <ul>
                      {view.exports.map((item) => (
                        <li key={item.id}>
                          {t("exportSummary", { date: when(item.createdAt), count: item.recordCount })}{" "}
                          {item.available ? (
                            <>
                              <a href={`/rgpd/exports/${item.id}/pdf`}>{t("downloadPdf")}</a> · <a href={`/rgpd/exports/${item.id}/archive`}>{t("downloadArchive")}</a>
                            </>
                          ) : (
                            <small>{t("exportExpired")}</small>
                          )}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p>
                    {t("caseActionNeedsSearch")} <Link href={toStep("found")}>{t("caseGoToSearch")}</Link>
                  </p>
                )
              ) : null}

              {view.actionKind === "manual" ? (
                request.actionDoneAt ? (
                  <p>{t("caseActionDoneOn", { date: when(request.actionDoneAt) })}</p>
                ) : closed ? null : (
                  <>
                    <p>{t(`caseManualIntro.${request.type}`)}</p>
                    <form action={markActionDoneAction}>
                      <input type="hidden" name="requestId" value={request.id} />
                      <button type="submit">{t("caseMarkActionDone")}</button>
                    </form>
                  </>
                )
              ) : null}
            </>
          ) : null}

          {step === "response" ? (
            response ? (
              <>
                <p className="strong">{response.subject}</p>
                <p className="case-reply">{response.body}</p>
                <div className="row-actions">
                  <CopyButton text={`${response.subject}\n\n${response.body}`} />
                  {view.actionKind === "erasure" && view.erasure ? <a href={`/rgpd/oublis/${view.erasure.id}/preuve`}>{t("downloadProof")}</a> : null}
                </div>
                {request.responseSentAt ? (
                  <p>{t("caseResponseSentOn", { date: when(request.responseSentAt) })}</p>
                ) : closed ? null : (
                  <form action={markResponseSentAction}>
                    <input type="hidden" name="requestId" value={request.id} />
                    <button type="submit">{t("caseMarkResponseSent")}</button>
                  </form>
                )}
              </>
            ) : (
              <p>
                {t("caseResponseAfterAction")} <Link href={toStep("action")}>{t("caseGoToAction")}</Link>
              </p>
            )
          ) : null}

          {step === "closed" ? (
            closed ? (
              <p>{t("caseClosedOn", { date: request.closedAt ? when(request.closedAt) : "—" })}</p>
            ) : view.canClose ? (
              <>
                <p>{t("caseReadyToClose")}</p>
                <form action={closeRequestAction}>
                  <input type="hidden" name="requestId" value={request.id} />
                  <button type="submit">{t("closeRequest", { person: request.personLabel })}</button>
                </form>
              </>
            ) : (
              <>
                <p>{t("caseNotReady")}</p>
                <ul>
                  {!view.actionDone ? <li>{t(`caseMissingAction.${view.actionKind}`)}</li> : null}
                  {request.responseSentAt === null ? <li>{t("caseMissingResponse")}</li> : null}
                </ul>
              </>
            )
          ) : null}
        </section>
      </div>

      <section aria-labelledby="case-journal" className="settings-block">
        <h2 id="case-journal">{t("journalTitle")}</h2>
        <ul className="case-journal">
          {journal.map((entry) => (
            <li key={`${entry.at.getTime()}-${entry.label}`}>
              <small>{when(entry.at)}</small> · {entry.label}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
