import Link from "next/link";
import { ImportedFields } from "../../imported-fields";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import {
  formatAmount,
  formatCalendarDate,
  formatDateTime,
  parisToday,
  type Locale,
} from "@symbola/i18n";
import {
  getEvent,
  getEventProgram,
  getTaskRecalculation,
  listEventActivity,
  listEventClientAccesses,
  listEventTasks,
  listEventVendorSlots,
  listVendorCandidates,
  listEventPlaces,
  listTaskTemplates,
  listLossReasons,
  listProgramTemplates,
  listProspectSources,
  summarizeVendorSlots,
} from "@/modules/events/service";
import { getEventBudget, listBudgetLines } from "@/modules/budget/service";
import { confirmEventBudgetAction } from "@/app/budget/[eventId]/actions";
import { listEventQuotes } from "@/modules/quotes/service";
import { createQuoteAction, startQuotesTrialAction } from "@/app/devis/actions";
import { isQuotesModuleEnabled } from "@/app/devis/module-access";
import { QUOTE_STATUS_LABEL_KEYS } from "@/app/devis/quote-display";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled, isValidId } from "../module-access";
import { ChangeStatusForm } from "./change-status-form";
import { endTrialAction } from "../trial-actions";
import { revokeClientAccessAction } from "./client-access-actions";
import { InviteClientForm } from "./client-access-forms";
import { removeProgramItemAction } from "./program-actions";
import {
  AddProgramItemForm,
  ApplyProgramTemplateForm,
  EditProgramItemForm,
} from "./program-forms";
import {
  moveEventTaskAction,
  removeEventTaskAction,
  resolveRecalculationAction,
} from "./task-actions";
import {
  AddEventTaskForm,
  ApplyTaskTemplateForm,
  EditEventTaskForm,
  EventDateForm,
} from "./task-forms";
import { PageTour } from "../../page-tour";
import { loadPageTour } from "@/lib/help/page-tour";
import { GearLink } from "@/app/gear-link";
import { TaskTable } from "@/app/taches/task-table";
import { EVENT_STATUS_CLASSES, STATUS_LABEL_KEYS } from "../event-status";
import { removeVendorSlotAction } from "./vendor-slot-actions";
import { AddVendorSlotForm, VendorSlotForm } from "./vendor-slot-forms";
import { VendorCandidates } from "./vendor-candidates";
import { BudgetLineIcon } from "@/app/budget-line-icon";
import { isBudgetModuleEnabled } from "@/app/budget/module-access";
import { PlannedAmountForm, SlotIconForm } from "./budget-line-forms";
import { AddPlaceForm } from "./place-forms";
import { removePlaceAction } from "./place-actions";
import { Trash2 } from "lucide-react";
import { findVendors } from "@/modules/vendors/service";
import { isVendorsModuleEnabled } from "@/app/prestataires/module-access";
import {
  VENDOR_STATUS_CLASSES,
  VENDOR_STATUS_LABEL_KEYS,
} from "./vendor-slot-status";

const CLIENT_ACCESS_STATUS_KEYS = {
  invited: "clientAccessInvited",
  active: "clientAccessActive",
  expired: "clientAccessExpired",
  revoked: "clientAccessRevoked",
} as const;

// Onglets de la fiche (maquette validée) : un écran par sujet plutôt
// qu'une longue page ; l'onglet actif est dans l'adresse (?onglet=).
const TABS = ["apercu", "budget", "retroplanning", "programme", "devis", "maries"] as const;
type Tab = (typeof TABS)[number];

type SearchParams = { onglet?: string; poste?: string; tache?: string; vue?: string; qui?: string; filtre?: string; visite?: string };

export default async function EventDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const auth = await getPlannerAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/mfa");
  if (auth.status === "forbidden")
    redirect(auth.role === "client" ? "/espace" : "/");
  if (!auth.user.organizationId) redirect("/");
  const organizationId = auth.user.organizationId;

  const { id } = await params;
  const query = await searchParams;
  const t = await getTranslations("Events");
  const tHelp = await getTranslations("Help");

  if (!(await isEventsModuleEnabled(organizationId))) {
    return (
      <main>
        <h1>{t("title")}</h1>
        <p>{t("moduleUnavailable")}</p>
      </main>
    );
  }
  if (!isValidId(id)) notFound();

  const event = await getEvent(organizationId, id);
  if (!event) notFound();
  const [
    reasons,
    sources,
    vendorSlots,
    tasks,
    templates,
    recalculation,
    program,
    programTemplates,
    clientAccesses,
    activity,
  ] = await Promise.all([
    listLossReasons(organizationId),
    listProspectSources(organizationId),
    listEventVendorSlots(organizationId, id),
    listEventTasks(organizationId, id),
    listTaskTemplates(organizationId),
    getTaskRecalculation(organizationId, id),
    getEventProgram(organizationId, id),
    listProgramTemplates(organizationId),
    listEventClientAccesses(organizationId, id),
    listEventActivity(organizationId, id),
  ]);
  const programLabels = new Map(
    program.items.map((item) => [item.id, item.label]),
  );
  const locale = (await getLocale()) as Locale;
  const progress = summarizeVendorSlots(vendorSlots);
  const sourceLabel = sources.find(
    (candidate) => candidate.id === event.prospectSourceId,
  )?.label;

  const clientNames = event.clients.length
    ? event.clients.map((client) => client.firstName).join(" & ")
    : t("noClient");

  // EVT-02 : « étant donné un événement confirmé dont la date est passée,
  // alors l'app propose de le passer en Réalisé ».
  const isPastConfirmed =
    event.status === "confirmed" &&
    event.eventDate !== null &&
    event.eventDate < new Date().toISOString().slice(0, 10);

  // BUD-01/02 : « quand l'événement passe en Confirmé, l'app propose
  // d'en faire le budget prévu » — seulement si une simulation existe et
  // qu'aucune ligne de budget (budget_lines) n'a encore été créée.
  let suggestConfirmBudget = false;
  if (event.status === "confirmed") {
    const [eventBudget, linesView] = await Promise.all([
      getEventBudget(organizationId, id),
      listBudgetLines(organizationId, id),
    ]);
    suggestConfirmBudget = eventBudget !== null && linesView.lines.length === 0;
  }

  // DEV-01 : devis de l'événement, masqués si le module n'est pas souscrit
  // (dégradation propre, CLAUDE.md §2.3).
  const quotesAvailable = await isQuotesModuleEnabled(organizationId);
  const quotes = quotesAvailable
    ? await listEventQuotes(organizationId, id)
    : [];
  const tQuotes = await getTranslations("Quotes");
  const tCandidates = await getTranslations("VendorCandidates");
  const tBudget = await getTranslations("Budget");

  const today = parisToday();
  // Lot 12 (EVT-17) : l'ancien onglet « prestataires » est devenu « budget ».
  const asked = query.onglet === "prestataires" ? "budget" : query.onglet;
  const tab: Tab = TABS.includes(asked as Tab) && (asked !== "devis" || quotesAvailable) ? (asked as Tab) : "apercu";
  const tabHref = (key: Tab, extra: Record<string, string> = {}) =>
    `/events/${event.id}?${new URLSearchParams({ onglet: key, ...extra }).toString()}`;
  const overdueCount = tasks.filter((task) => !task.done && task.dueDate < today).length;
  // Lot 12 (EVT-14 / EVT-15) : icônes des prestataires au programme, lieux saisis une fois.
  const slotIconOf = new Map(vendorSlots.map((slot) => [slot.id, slot.icon]));
  const places = tab === "programme" ? await listEventPlaces(organizationId, id) : [];
  const venueCandidates = tab === "programme" ? (await listVendorCandidates(organizationId, id)).filter((candidate) => candidate.outcome === "selected" && vendorSlots.find((slot) => slot.id === candidate.vendorSlotId)?.icon === "venue") : [];
  const placeSuggestions = [
    ...venueCandidates.map((candidate) => ({ label: candidate.vendorName, vendorId: candidate.vendorId })),
    ...(event.venueName ? [{ label: event.venueName, vendorId: null }] : []),
  ].filter((suggestion, index, all) => !places.some((place) => place.label.toLocaleLowerCase("fr") === suggestion.label.toLocaleLowerCase("fr")) && all.findIndex((other) => other.label === suggestion.label) === index);
  const placeOptions = [...new Set([...places.map((place) => place.label), ...placeSuggestions.map((suggestion) => suggestion.label)])];
  // Lot 12 (EVT-13) : rétroplanning seulement pour un événement confirmé (ou réalisé).
  const retroplanningOpen = event.isDemo || event.status === "confirmed" || event.status === "done";
  const proposeRetroplanning = (event.status === "confirmed") && tasks.length === 0 && templates.length > 0 && !event.isDemo;

  // EVT-03 : postes en tableau, détail du poste choisi dans un panneau.
  const toFind = vendorSlots.filter((slot) => slot.status !== "booked" && slot.status !== "not_required");
  const slotFilter = query.filtre === "a-pourvoir" ? "a-pourvoir" : "tous";
  const shownSlots = slotFilter === "a-pourvoir" ? toFind : vendorSlots;
  const selectedSlot = vendorSlots.find((slot) => slot.id === query.poste) ?? null;
  // Lot 12 (EVT-17) : prévu et réel de chaque ligne, si le module Budget est souscrit.
  const budgetAvailable = tab === "budget" ? await isBudgetModuleEnabled(organizationId) : false;
  const budgetView = budgetAvailable ? await listBudgetLines(organizationId, id) : null;
  const amountsOf = (slotId: string) => budgetView?.lines.find((line) => line.eventVendorSlotId === slotId) ?? null;
  // Lot 11 (EVT-08) : prestataires consultés, et le carnet s'il est souscrit.
  const candidates = tab === "budget" ? await listVendorCandidates(organizationId, id) : [];
  const vendorsAvailable = tab === "budget" ? await isVendorsModuleEnabled(organizationId) : false;
  const bookOptions =
    selectedSlot && vendorsAvailable
      ? (await findVendors({ organizationId })).map((vendor) => ({ id: vendor.id, label: vendor.city ? `${vendor.name} — ${vendor.city}` : vendor.name }))
      : [];
  const candidatesBySlot = (slotId: string) => candidates.filter((candidate) => candidate.vendorSlotId === slotId);

  // EVT-04 : filtres du rétroplanning (vue, responsable), tâche choisie.
  const taskView = query.vue === "a-faire" || query.vue === "en-retard" ? query.vue : "toutes";
  const taskOwner = query.qui === "planner" || query.qui === "clients" ? query.qui : "tous";
  const shownTasks = tasks.filter((task) => {
    if (taskOwner !== "tous" && task.responsible !== taskOwner) return false;
    if (taskView === "a-faire") return !task.done;
    if (taskView === "en-retard") return !task.done && task.dueDate < today;
    return true;
  });
  const selectedTask = tasks.find((task) => task.id === query.tache) ?? null;
  const sameMonth = selectedTask ? tasks.filter((task) => task.dueDate.slice(0, 7) === selectedTask.dueDate.slice(0, 7)) : [];
  const selectedIndex = selectedTask ? sameMonth.findIndex((task) => task.id === selectedTask.id) : -1;
  const retroQuery = (changes: Record<string, string>) => {
    const values: Record<string, string> = { vue: taskView, qui: taskOwner, ...changes };
    return tabHref("retroplanning", values);
  };

  // AIDE-05 : visite focus de la fiche, à la première ouverture.
  const tour = await loadPageTour(auth.user.id, "event", query.visite);
  const tabs: { key: Tab; label: string; href: string; count?: string; alert?: boolean }[] = [
    { key: "apercu", label: t("tabOverview"), href: tabHref("apercu") },
    { key: "budget", label: t("vendorSlotsTitle"), href: tabHref("budget"), count: `${progress.booked}/${progress.required}` },
    {
      key: "retroplanning",
      label: t("tasksTitle"),
      href: tabHref("retroplanning"),
      ...(overdueCount > 0 ? { count: t("tasksOverdueCount", { count: overdueCount }), alert: true } : {}),
    },
    { key: "programme", label: t("programTitle"), href: tabHref("programme") },
    ...(quotesAvailable ? [{ key: "devis" as const, label: tQuotes("eventQuotesTitle"), href: tabHref("devis"), count: String(quotes.length) }] : []),
    { key: "maries", label: t("tabClients"), href: tabHref("maries") },
  ];

  return (
    <main>
      <p>
        <Link href="/events">{t("backToEvents")}</Link>
      </p>
      <div className="page-header">
        <div>
          <div className="title-with-badge">
            <h1>{clientNames}</h1>
            <span className={EVENT_STATUS_CLASSES[event.status]}>{t(STATUS_LABEL_KEYS[event.status])}</span>
          </div>
          <p className="meta">
            <span>
              {t("eventDate")} : {event.eventDate ? formatCalendarDate(event.eventDate, locale) : t("dateUnset")}
            </span>
            <span>
              {t("venueName")} : {event.venueName ?? "—"} {event.venueCity ? `(${event.venueCity})` : ""}
            </span>
            <span>
              {t("source")} : {sourceLabel ?? "—"}
            </span>
          </p>
        </div>
        <PageTour {...tour} helpTitle={tHelp("eventsDetail.title")} helpBody={tHelp("eventsDetail.body")} />
      </div>

      {/* AIDE-02 : bandeau de l'essai guidé, sur données fictives. */}
      {event.isDemo ? (
        <section aria-labelledby="trial-banner-title">
          <h2 id="trial-banner-title">{t("trialBannerTitle")}</h2>
          <p>{t("trialBannerBody")}</p>
          <ol>
            <li>{t("trialStepStatus")}</li>
            <li>{t("trialStepVendor")}</li>
            <li>{t("trialStepTask")}</li>
            <li>{t("trialStepProgram")}</li>
            {quotesAvailable ? <li>{t("trialStepQuote")}</li> : null}
          </ol>
          {quotesAvailable ? (
            <form action={startQuotesTrialAction}>
              <input type="hidden" name="eventId" value={event.id} />
              <button type="submit">{t("trialStartQuote")}</button>
            </form>
          ) : null}
          <form action={endTrialAction}>
            <input type="hidden" name="eventId" value={event.id} />
            <button type="submit">{t("trialEnd")}</button>
          </form>
        </section>
      ) : null}

      {/* Lot 12 (EVT-12) : statut en étapes cliquables, visible sur tous les onglets. */}
      <ChangeStatusForm key={event.status} eventId={event.id} currentStatus={event.status} reasons={reasons} />
      {proposeRetroplanning ? (
        <section className="card" aria-labelledby="propose-retro-title">
          <h2 id="propose-retro-title">{t("proposeRetroplanningTitle")}</h2>
          <p>{event.eventDate ? t("proposeRetroplanningBody") : t("taskTemplateNeedsDate")}</p>
          {event.eventDate ? <ApplyTaskTemplateForm eventId={event.id} templates={templates} /> : null}
        </section>
      ) : null}

      <nav aria-label={t("eventTabsLabel")} className="tabs" data-tour="event-tabs">
        {tabs.map((item) => (
          <Link key={item.key} href={item.href} aria-current={item.key === tab ? "page" : undefined} data-tour={`tab-${item.key}`}>
            {item.label}
            {item.count ? <span className={item.alert ? "tab-count tab-count-alert" : "tab-count"}>{item.count}</span> : null}
          </Link>
        ))}
      </nav>

      {tab === "apercu" ? (
        <>
          <section className="card" aria-labelledby="overview-title" data-tour="event-overview">
            <h2 id="overview-title">{t("tabOverview")}</h2>
            {/* EVT-03 : barre d'avancement en haut de la fiche. */}
            <p id="vendor-progress-label">
              {t("vendorProgress", { booked: progress.booked, required: progress.required })}
            </p>
            <progress aria-labelledby="vendor-progress-label" value={progress.booked} max={Math.max(progress.required, 1)} />
            <EventDateForm eventId={event.id} eventDate={event.eventDate} />
            {isPastConfirmed ? <p role="status">{t("suggestMarkDone")}</p> : null}
            <ImportedFields fields={event.importedFields} />
          </section>
          {suggestConfirmBudget ? (
            <section aria-labelledby="confirm-budget-title">
              <h2 id="confirm-budget-title">{t("confirmBudgetTitle")}</h2>
              <p>{t("confirmBudgetBody")}</p>
              <form action={confirmEventBudgetAction}>
                <input type="hidden" name="eventId" value={event.id} />
                <button type="submit">{t("confirmAsPlanned")}</button>
              </form>
            </section>
          ) : null}
          <section className="card" aria-labelledby="activity-title">
            <h2 id="activity-title">{t("activityTitle")}</h2>
            {activity.length === 0 ? <p>{t("noActivity")}</p> : null}
            <ul aria-label={t("activityTitle")}>
              {activity.map((entry) => (
                <li key={entry.id}>
                  {formatDateTime(new Date(entry.createdAt), locale)} —{" "}
                  {t(entry.kind === "task_done" ? "activityTaskDone" : "activityTaskUndone", {
                    actor: entry.actorEmail ?? t("activityFormerClient"),
                    task: entry.taskLabel,
                  })}
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}

      {tab === "budget" ? (
        <div className="split">
          <section className="card split-main" aria-labelledby="vendor-slots-title">
            <div className="section-head">
              <h2 id="vendor-slots-title">{t("vendorSlotsTitle")}</h2>
              <GearLink href="/events/parametres" label={t("vendorSlotsSettings")} />
            </div>
            <p id="vendor-progress-label">{t("vendorProgress", { booked: progress.booked, required: progress.required })}</p>
            {budgetView ? (
              <p className="meta">
                <span>{t("budgetTotals", { planned: formatAmount(budgetView.totalPlannedCents, locale), actual: formatAmount(budgetView.totalActualCents, locale) })}</span>
                <Link href={`/budget/${event.id}`}>{t("budgetSuggest")}</Link>
              </p>
            ) : null}
            <progress aria-labelledby="vendor-progress-label" value={progress.booked} max={Math.max(progress.required, 1)} />
            <nav aria-label={t("vendorSlotsFilter")} className="pills">
              <Link href={tabHref("budget")} aria-current={slotFilter === "tous" ? "true" : undefined}>
                {t("vendorSlotsAll", { count: vendorSlots.length })}
              </Link>
              <Link href={tabHref("budget", { filtre: "a-pourvoir" })} aria-current={slotFilter === "a-pourvoir" ? "true" : undefined}>
                {t("vendorSlotsToFind", { count: toFind.length })}
              </Link>
            </nav>
            {shownSlots.length === 0 ? <p>{vendorSlots.length === 0 ? t("noVendorSlots") : t("noVendorSlotsToFind")}</p> : null}
            {shownSlots.length > 0 ? (
              <div role="region" aria-label={t("vendorSlotsTable")} tabIndex={0}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">{t("vendorColumnSlot")}</th>
                      <th scope="col">{t("vendorName")}</th>
                      <th scope="col">{t("vendorSlotStatus")}</th>
                      {budgetView ? (
                        <>
                          <th scope="col" className="num">{tBudget("planned")}</th>
                          <th scope="col" className="num">{tBudget("actual")}</th>
                          <th scope="col" className="num">{tBudget("variance")}</th>
                        </>
                      ) : (
                        <th scope="col" className="num">
                          {t("vendorAmount")}
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {shownSlots.map((slot) => (
                      <tr key={slot.id} aria-current={slot.id === selectedSlot?.id ? "true" : undefined}>
                        <th scope="row">
                          <span className="line-cell">
                            <BudgetLineIcon icon={slot.icon} label={slot.label} decorative />
                            <Link href={tabHref("budget", { ...(slotFilter === "a-pourvoir" ? { filtre: "a-pourvoir" } : {}), poste: slot.id })}>
                              {slot.label}
                            </Link>
                          </span>
                        </th>
                        <td>
                          {slot.vendorName ??
                            (candidatesBySlot(slot.id).length > 0 ? tCandidates("consultedCount", { count: candidatesBySlot(slot.id).length }) : "—")}
                        </td>
                        <td>
                          <span className={VENDOR_STATUS_CLASSES[slot.status]}>{t(VENDOR_STATUS_LABEL_KEYS[slot.status])}</span>
                        </td>
                        {budgetView ? (
                          (() => {
                            const amounts = amountsOf(slot.id);
                            const planned = amounts?.plannedAmountCents ?? null;
                            const actual = amounts?.actualAmountCents ?? null;
                            const variance = amounts?.varianceCents ?? null;
                            return (
                              <>
                                <td className="num">{planned !== null ? formatAmount(planned, locale) : "—"}</td>
                                <td className="num">{actual !== null ? formatAmount(actual, locale) : "—"}</td>
                                <td className={variance !== null && variance > 0 ? "num text-overdue" : "num"}>
                                  {variance !== null ? `${variance > 0 ? "+" : ""}${formatAmount(variance, locale)}` : "—"}
                                </td>
                              </>
                            );
                          })()
                        ) : (
                          <td className="num">{slot.amountCents !== null ? formatAmount(slot.amountCents, locale) : "—"}</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            <AddVendorSlotForm eventId={event.id} />
          </section>
          <aside className="split-aside" aria-labelledby="vendor-detail-title">
            {selectedSlot ? (
              <>
                <h2 id="vendor-detail-title">{selectedSlot.label}</h2>
                <VendorSlotForm key={`${selectedSlot.id}-${selectedSlot.selectedCandidateId ?? ""}`} eventId={event.id} slot={selectedSlot} />
                {budgetView ? <PlannedAmountForm key={`planned-${selectedSlot.id}`} eventId={event.id} slotId={selectedSlot.id} label={selectedSlot.label} plannedCents={amountsOf(selectedSlot.id)?.plannedAmountCents ?? null} /> : null}
                <SlotIconForm key={`icon-${selectedSlot.id}-${selectedSlot.icon ?? ""}`} eventId={event.id} slotId={selectedSlot.id} label={selectedSlot.label} icon={selectedSlot.icon} />
                <ImportedFields fields={selectedSlot.importedFields} compact />
                <form action={removeVendorSlotAction}>
                  <input type="hidden" name="eventId" value={event.id} />
                  <input type="hidden" name="vendorSlotId" value={selectedSlot.id} />
                  <button type="submit">{t("removeVendorSlot", { label: selectedSlot.label })}</button>
                </form>
                <Link href={tabHref("budget", slotFilter === "a-pourvoir" ? { filtre: "a-pourvoir" } : {})}>{t("closePanel")}</Link>
              </>
            ) : (
              <>
                <h2 id="vendor-detail-title">{t("vendorDetailTitle")}</h2>
                <p>{t("vendorDetailHint")}</p>
              </>
            )}
          </aside>
        </div>
      ) : null}
      {tab === "budget" && selectedSlot ? (
        <VendorCandidates
          eventId={event.id}
          slot={selectedSlot}
          candidates={candidatesBySlot(selectedSlot.id)}
          bookOptions={bookOptions}
          vendorsAvailable={vendorsAvailable}
          locale={locale}
        />
      ) : null}

      {/* EVT-04 : rétroplanning en tableau. */}
      {tab === "retroplanning" ? (
        <div className="split">
          <section className="card split-main" aria-labelledby="tasks-title">
            <div className="section-head">
              <h2 id="tasks-title">{t("tasksTitle")}</h2>
              <GearLink href="/events/modeles" label={t("taskTemplatesSettings")} />
            </div>
            <p className="meta">
              <span>{t("tasksSummary", { done: tasks.filter((task) => task.done).length, total: tasks.length, overdue: overdueCount })}</span>
            </p>
            {recalculation.pending ? (
              <section aria-labelledby="recalculation-title">
                <h3 id="recalculation-title">{t("recalculationTitle")}</h3>
                <p>
                  {t("recalculationProposal", {
                    days: Math.abs(recalculation.shiftDays),
                    direction: recalculation.shiftDays > 0 ? "later" : "earlier",
                    count: recalculation.undoneTasks,
                  })}
                </p>
                <form action={resolveRecalculationAction}>
                  <input type="hidden" name="eventId" value={event.id} />
                  <button type="submit" name="decision" value="accept">
                    {t("recalculationAccept")}
                  </button>{" "}
                  <button type="submit" name="decision" value="decline">
                    {t("recalculationDecline")}
                  </button>
                </form>
              </section>
            ) : null}
            {/* Lot 12 (EVT-13) : pas de rétroplanning pour un prospect ; il démarre à la confirmation (sauf exemple d'essai ou de tutoriel). */}
            {!retroplanningOpen ? (
              <p className="notice">{t("retroplanningAfterConfirm")}</p>
            ) : !event.eventDate ? (
              <p>{t("taskTemplateNeedsDate")}</p>
            ) : templates.length === 0 ? (
              <p>
                {t("noTaskTemplates")} <Link href="/events/modeles">{t("taskTemplatesLink")}</Link>
              </p>
            ) : !recalculation.pending ? (
              <ApplyTaskTemplateForm eventId={event.id} templates={templates} />
            ) : null}
            <div className="toolbar">
              <nav aria-label={t("tasksViewFilter")} className="pills">
                {(["toutes", "a-faire", "en-retard"] as const).map((view) => (
                  <Link key={view} href={retroQuery({ vue: view })} aria-current={taskView === view ? "true" : undefined}>
                    {t(view === "toutes" ? "tasksViewAll" : view === "a-faire" ? "tasksViewTodo" : "tasksViewOverdue")}
                  </Link>
                ))}
              </nav>
              <nav aria-label={t("tasksOwnerFilter")} className="pills">
                {(["tous", "planner", "clients"] as const).map((owner) => (
                  <Link key={owner} href={retroQuery({ qui: owner })} aria-current={taskOwner === owner ? "true" : undefined}>
                    {t(owner === "tous" ? "tasksOwnerAll" : owner === "planner" ? "responsiblePlanner" : "responsibleClients")}
                  </Link>
                ))}
              </nav>
            </div>
            {tasks.length === 0 ? <p>{t("noTasks")}</p> : shownTasks.length === 0 ? <p>{t("noTasksForFilter")}</p> : null}
            {shownTasks.length > 0 ? (
              <TaskTable
                tasks={shownTasks}
                locale={locale}
                today={today}
                caption={t("tasksTitle")}
                selectedTaskId={selectedTask?.id ?? null}
                editHref={(task) => retroQuery({ tache: task.id })}
              />
            ) : null}
            <AddEventTaskForm eventId={event.id} />
          </section>
          <aside className="split-aside" aria-labelledby="task-detail-title">
            {selectedTask ? (
              <>
                <h2 id="task-detail-title">{selectedTask.label}</h2>
                {/* Clé liée au contenu : après un recalcul, le formulaire repart des nouvelles valeurs. */}
                <EditEventTaskForm
                  key={`${selectedTask.id}-${selectedTask.dueDate}-${selectedTask.label}-${selectedTask.responsible}`}
                  eventId={event.id}
                  task={selectedTask}
                />
                <ImportedFields fields={selectedTask.importedFields} compact />
                <form action={moveEventTaskAction}>
                  <input type="hidden" name="eventId" value={event.id} />
                  <input type="hidden" name="taskId" value={selectedTask.id} />
                  <button type="submit" name="direction" value="up" disabled={selectedIndex <= 0}>
                    {t("moveTaskUp", { label: selectedTask.label })}
                  </button>{" "}
                  <button type="submit" name="direction" value="down" disabled={selectedIndex === sameMonth.length - 1}>
                    {t("moveTaskDown", { label: selectedTask.label })}
                  </button>
                </form>
                <form action={removeEventTaskAction}>
                  <input type="hidden" name="eventId" value={event.id} />
                  <input type="hidden" name="taskId" value={selectedTask.id} />
                  <button type="submit">{t("removeTask", { label: selectedTask.label })}</button>
                </form>
                <Link href={retroQuery({})}>{t("closePanel")}</Link>
              </>
            ) : (
              <>
                <h2 id="task-detail-title">{t("taskDetailTitle")}</h2>
                <p>{t("taskDetailHint")}</p>
              </>
            )}
          </aside>
        </div>
      ) : null}

      {/* EVT-05 : programme du jour J. */}
      {tab === "programme" ? (
        <section className="card" aria-labelledby="program-title">
          <div className="section-head">
            <h2 id="program-title">{t("programTitle")}</h2>
            <GearLink href="/events/modeles-programme" label={t("programTemplatesSettings")} />
          </div>
          <nav aria-label={t("programExports")}>
            <a href={`/events/${event.id}/programme/pdf?variant=couple`} download>
              {t("programExportCouple")}
            </a>
            {" · "}
            <a href={`/events/${event.id}/programme/pdf?variant=vendors`} download>
              {t("programExportVendors")}
            </a>
          </nav>
          {program.overlaps.length > 0 ? (
            <section aria-labelledby="program-overlaps-title">
              <h3 id="program-overlaps-title">{t("programOverlapsTitle")}</h3>
              <ul>
                {program.overlaps.map((overlap) => (
                  <li key={`${overlap.participant}-${overlap.itemIds.join("-")}`}>
                    {t("programOverlap", {
                      participant: overlap.participant,
                      first: programLabels.get(overlap.itemIds[0]) ?? "",
                      second: programLabels.get(overlap.itemIds[1]) ?? "",
                    })}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {programTemplates.length > 0 ? (
            <ApplyProgramTemplateForm eventId={event.id} templates={programTemplates} />
          ) : (
            <p>
              {t("noProgramTemplates")} <Link href="/events/modeles-programme">{t("programTemplatesLink")}</Link>
            </p>
          )}
          {program.items.length === 0 ? <p>{t("noProgramItems")}</p> : null}
          {/* Lot 12 (EVT-14) : une ligne par moment, une icône par prestataire concerné, actions discrètes à droite. */}
          <ul aria-label={t("programTitle")} className="program-list">
            {program.items.map((item) => (
              <li key={item.id} className="program-row">
                <span className="program-time">{item.endTime ? `${item.startTime} – ${item.endTime}` : item.startTime}</span>
                <span className="program-main">
                  <strong>{item.label}</strong>
                  <span className="program-meta">
                    {item.location ? <span>{item.location}</span> : null}
                    {item.participants.length > 0 ? (
                      <span className="line-icons" aria-label={t("programParticipantsList", { names: item.participants.map((participant) => participant.label).join(", ") })}>
                        {item.participants.map((participant) => (
                          <BudgetLineIcon
                            key={`${participant.vendorSlotId ?? "libre"}-${participant.label}`}
                            icon={participant.vendorSlotId ? (slotIconOf.get(participant.vendorSlotId) ?? null) : null}
                            label={participant.label}
                          />
                        ))}
                      </span>
                    ) : null}
                  </span>
                  {item.internalNote ? (
                    <span className="program-note">
                      {t("programInternalNote")} : {item.internalNote}
                    </span>
                  ) : null}
                </span>
                <span className="program-actions">
                  <EditProgramItemForm key={JSON.stringify(item)} eventId={event.id} item={item} vendorSlots={vendorSlots} />
                  <form action={removeProgramItemAction}>
                    <input type="hidden" name="eventId" value={event.id} />
                    <input type="hidden" name="itemId" value={item.id} />
                    <button type="submit" className="icon-button" aria-label={t("removeProgramItem", { label: item.label })} title={t("removeProgramItem", { label: item.label })}>
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
          <datalist id="event-place-options">
            {placeOptions.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
          <AddProgramItemForm eventId={event.id} vendorSlots={vendorSlots} />
          <section aria-labelledby="places-title" className="places">
            <h3 id="places-title">{t("placesTitle")}</h3>
            <p className="muted">{t("placesHint")}</p>
            {places.length === 0 ? <p>{t("noPlaces")}</p> : null}
            <ul className="item-list">
              {places.map((place) => (
                <li key={place.id}>
                  <strong>{place.label}</strong>
                  {place.address ? ` — ${place.address}` : ""}
                  {place.vendorId ? <span className="badge badge-sauge">{t("placeFromBook")}</span> : null}
                  <form action={removePlaceAction} className="inline-form">
                    <input type="hidden" name="eventId" value={event.id} />
                    <input type="hidden" name="placeId" value={place.id} />
                    <button type="submit">{t("removePlace", { place: place.label })}</button>
                  </form>
                </li>
              ))}
            </ul>
            <AddPlaceForm eventId={event.id} suggestions={placeSuggestions} />
          </section>
        </section>
      ) : null}

      {tab === "devis" && quotesAvailable ? (
        <section className="card" aria-labelledby="event-quotes-title">
          <div className="section-head">
            <h2 id="event-quotes-title">{tQuotes("eventQuotesTitle")}</h2>
            <GearLink href="/devis/parametres" label={tQuotes("settingsTitle")} />
          </div>
          {quotes.length === 0 ? <p>{tQuotes("noEventQuotes")}</p> : null}
          <ul className="item-list">
            {quotes.map((quote) => (
              <li key={quote.id}>
                <Link href={`/devis/${quote.id}`}>{quote.number}</Link> — {tQuotes(QUOTE_STATUS_LABEL_KEYS[quote.status])} —{" "}
                {tQuotes("versionLabel", { version: quote.currentVersion })} — {formatAmount(quote.totalTtcCents, locale)}
              </li>
            ))}
          </ul>
          <form action={createQuoteAction} className="primary-action">
            <input type="hidden" name="eventId" value={event.id} />
            <button type="submit">{tQuotes("createQuote")}</button>
          </form>
        </section>
      ) : null}

      {/* EVT-06 : accès des mariés. */}
      {tab === "maries" ? (
        <section className="card" aria-labelledby="client-access-title">
          <h2 id="client-access-title">{t("clientAccessTitle")}</h2>
          <p>{t("clientAccessIntro")}</p>
          {clientAccesses.length === 0 ? <p>{t("noClientAccess")}</p> : null}
          <ul aria-label={t("clientAccessTitle")} className="item-list">
            {clientAccesses.map((access) => (
              <li key={access.id}>
                {access.email} — {t(CLIENT_ACCESS_STATUS_KEYS[access.status])}
                {access.status === "active" || access.status === "invited" ? (
                  <form action={revokeClientAccessAction}>
                    <input type="hidden" name="eventId" value={event.id} />
                    <input type="hidden" name="accessId" value={access.id} />
                    <button type="submit">{t("revokeClientAccess", { email: access.email })}</button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
          {event.isDemo ? <p>{t("trialNoInvite")}</p> : <InviteClientForm eventId={event.id} />}
        </section>
      ) : null}
    </main>
  );
}
