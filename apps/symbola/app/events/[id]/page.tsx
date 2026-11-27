import Link from "next/link";
import { venueChecksFor } from "@/lib/events/venue-checks";
import { EventNotesForbiddenError, readEventConfidentialNotes } from "@/modules/events/service";
import { VenueCapacityNotice, VenueFindings } from "./venue-findings";
import { listCalendarFeeds, listPreparedEmails } from "@/modules/hub/service";
import { ImportedFields } from "../../imported-fields";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { dateInTimeZone, formatAmount, formatCalendarDate, formatDate, formatDateTimeIn, parisToday, type Locale } from "@symbola/i18n";
import { ENGAGED_CANDIDATE_STATUSES } from "@symbola/contracts";
import { listTeam } from "@symbola/auth";
import { EventAppointments } from "./event-appointments";
import { isFloorplansAvailable } from "@/app/plans-de-salle/access";
import { ProspectExchanges } from "./prospect-exchanges";
import { appDatabase } from "@symbola/db/client";
import { clientTermForEvent, getEvent, getEventProgram, getEventProgramPublication, listProgramRecipients, proposeProgramShift, getEventStatusDates, closingDue, eventNames, getTaskRecalculation, previewTaskRecalculation, getActiveEventsTrial, listEventActivity, getEventProspectRequest, listEventDecisions, listEventDocuments, listEventDayContacts, listDayDocumentChoices, listEventLinks, listLinkProfiles, listEventTasks, periodRange, listEventVendorSlots, listVendorCandidates, listVendorFollowUps, listEventPlaces, listTaskTemplates, listLossReasons, listProgramTemplates, listProspectSources, summarizeVendorSlots, type EventVendorSlot, getEventIdentityState, getDayOfLeadDays, canPostpone } from "@/modules/events/service";
import { getEventBudget, listBudgetLines } from "@/modules/budget/service";
import { confirmEventBudgetAction } from "@/app/budget/[eventId]/actions";
import { listEventQuotes, listQuoteInvoices, listQuoteTemplates } from "@/modules/quotes/service";
import { createQuoteAction, startQuotesTrialAction } from "@/app/devis/actions";
import { isQuotesModuleEnabled } from "@/app/devis/module-access";
import { QUOTE_STATUS_LABEL_KEYS } from "@/app/devis/quote-display";
import { requirePlanner } from "@/lib/guards";
import { taskMemberOptions } from "@/lib/tasks/members";
import { EventTeamCard } from "./team-card";
import { EventBusyCard } from "./busy-card";
import { ensureEventTypes } from "@/lib/events/event-types";
import { isEventsModuleEnabled, isValidId } from "../module-access";
import { StatusTimeline } from "./status-timeline";
import { EventCommands, EventMenuButton } from "./event-commands";
import { EventTabs, type EventTab } from "./event-tabs";
import { EventBack } from "./event-back";
import { eventTimeline, headerAction } from "@/lib/events/event-header";
import { TimeZoneForm } from "./lifecycle-forms";
import { isDayOfOpen } from "@/app/jour-j/[eventId]/day-of-view";
import { DocumentsTab } from "./documents-tab";
import { NextStepBanner } from "./next-step-banner";
import { nextStep } from "./next-step";
import { endTrialAction, removeExampleAction } from "../trial-actions";
import { revokeLinkAction } from "./link-actions";
import { ClientContactForm, EventIdentityForm, EventNotesForm, VenueForm, WantedBudgetForm } from "./client-contact-forms";
import { CreateLinkForm, CreateVendorLinkForm, EditLinkForm, RenewLinkForm, type LinkFormVendor } from "./link-forms";
import { RequestDecisionForm } from "./decision-forms";
import { EditDialog } from "@/app/ui/edit-dialog";
import { commitDecisionExpenseAction, replaceDecisionAction, retainDecisionChoiceAction, withdrawDecisionAction } from "./decision-actions";
import { answerSentence } from "@/app/portail/client-decisions";
import { choiceName, decisionLabel } from "@/app/portail/decision-label";
import { clientFieldLabelsByAudience, requestAudience } from "@/lib/vocabulary";
import { AddClientForm, EventSourceForm } from "./event-origin-forms";
import { ProgramEditor } from "./program-editor";
import { ProgramShiftProposal, type ShiftProposalView } from "./program-shift";
import { durationText } from "@/lib/program-spans";
import { programSpanWords } from "@/lib/program-span-words";
import { ApplyProgramTemplateForm, ProgramNotifyForm, ProgramPublishForm } from "./program-forms";
import { CalendarAddressForm } from "../../calendar-address-form";
import { resolveRecalculationAction } from "./task-actions";
import { ApplyTaskTemplateForm, EventDateForm } from "./task-forms";
import { TaskPanelLoader, panelFromQuery } from "@/app/ui/task-panel-loader";
import { TaskLineBoard } from "@/app/ui/task-line-board";
import { TaskFiltersForm } from "@/app/ui/task-filters-form";
import { buildTaskLines, clientsTerms, engagedVendors, linesByMonth } from "@/lib/tasks/task-lines";
import { nameInitials } from "@/lib/tasks/task-line";
import { filterEventTasks, filterFormValues, filtersQuery, readEventTaskFilters } from "@/lib/tasks/event-task-filters";
import { legacyTaskTabRedirect } from "@/lib/tasks/task-tab";
import { ensureTaskCategories } from "@/lib/events/task-categories";
import { PageTour } from "../../page-tour";
import { loadPageTour } from "@/lib/help/page-tour";
import { SettingsLink } from "@/app/settings-link";
import { removeVendorSlotAction } from "./vendor-slot-actions";
import { AddVendorSlotForm, VendorSlotForm } from "./vendor-slot-forms";
import { VendorCandidates } from "./vendor-candidates";
import { BudgetLineIcon } from "@/app/budget-line-icon";
import { isBudgetModuleEnabled } from "@/app/budget/module-access";
import { PlannedAmountForm, SlotIconForm } from "./budget-line-forms";
import { buildBudgetVendorRows, signedAmount } from "./budget-vendor-rows";
import { BudgetVendorsTable } from "./budget-vendors-table";
import { AddPlaceForm, EditPlaceForm } from "./place-forms";
import { AddDayContactForm } from "./day-contact-forms";
import { removeDayContactAction } from "./day-contact-actions";
import { makeReceptionPlaceAction, removePlaceAction } from "./place-actions";
import { findVendors, getVendor, listVendorTypes } from "@/modules/vendors/service";
import { isVendorsModuleEnabled } from "@/app/prestataires/module-access";
import {
  VENDOR_STATUS_CLASSES,
  VENDOR_STATUS_LABEL_KEYS,
} from "./vendor-slot-status";
import { EventCockpit } from "./cockpit";
import { UndoTaskNotice } from "@/app/accueil/today-client";
import { deleteEventAction } from "./trash-actions";
import { SidePanel } from "@/app/ui/side-panel";
// Lot 49 (EVT-04 premier pas, INV-01 à INV-04) : temps forts sur la synthèse, onglet « Invités ».
import { getDayReport, listKeyMoments } from "@/modules/events/service";
import { getGuestEventSummary, getGuestModuleState } from "@/modules/guests/service";
import { AddKeyMomentForm, EditKeyMomentForm } from "./key-moments";
import { ProgramImportForm } from "./program-import-form";
import { VendorsImportForm } from "./vendors-import-form";
import { DayReminderCard } from "./day-reminder-card";
import { dayReportSections, reportHandovers } from "./bilan/day-report-view";
import { dayReportWords } from "./bilan/report-words";
import { eventDays, isReportReady } from "@/lib/day-of/rules";
import { listDayHandovers } from "@/modules/budget/service";
import { guestsAccess } from "./invites/access";
import { GuestsTab } from "./invites/guests-tab";

// Lot 26a (SEC-15) : état d'un lien personnel.
const LINK_STATUS_KEYS = {
  active: "linkStatus.active",
  expired: "linkStatus.expired",
  revoked: "linkStatus.revoked",
} as const;

// Onglets de la fiche (maquette validée) : un écran par sujet plutôt
// qu'une longue page ; l'onglet actif est dans l'adresse (?onglet=).
// Lot 29b (JRJ-04) : onglet « Documents » (plan de table, plans, plan B).
// Lot 49 (INV-01 à INV-04) : onglet « Invités », si le module est ouvert (ARC-06).
const TABS = ["apercu", "budget", "taches", "programme", "devis", "maries", "documents", "invites"] as const;
type Tab = (typeof TABS)[number];

type SearchParams = { importer?: string; reprendre?: string; reprise?: string; cote?: string; groupe?: string; sansReponse?: string; suppression?: string; exemple?: string; onglet?: string; poste?: string; tache?: string; vue?: string; qui?: string; filtre?: string; visite?: string; decalage?: string; depuis?: string; fait?: string; evenement?: string; modifier?: string; periode?: string; categorie?: string; etat?: string; nouvelle?: string; copie?: string };

// Lot 28a (PRE-02) : postes pourvus (un prestataire retenu) ou non requis.
const SETTLED_SLOT_STATUSES = new Set<string>(["retained", "contract_signed", "paid_off", "not_required"]);

export default async function EventDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;

  const { id } = await params;
  const query = await searchParams;
  const t = await getTranslations("Events");
  const tTrash = await getTranslations("Trash");
  const tHelp = await getTranslations("Help");
  const tCommon = await getTranslations("Common");

  if (!(await isEventsModuleEnabled(organizationId))) {
    return (
      <main>
        <h1>{t("title")}</h1>
        <p>{t("moduleUnavailable")}</p>
      </main>
    );
  }
  if (!isValidId(id)) notFound();
  // Lot 70c (CHR-02 ; C-39) : l'ancien onglet « Rétroplanning » (recherche, notifications, e-mails déjà
  // partis) ouvre l'onglet « Tâches », avec la même tâche.
  const legacy = legacyTaskTabRedirect(id, query);
  if (legacy) redirect(legacy);

  const event = await getEvent(organizationId, id);
  if (!event) notFound();
  // Lot 39b (UX-09, D8) : la version de la fiche, pour l'enregistrement automatique sans écrasement.
  const identityVersion = String((await getEventIdentityState(organizationId, id))?.updatedAt.getTime() ?? 0);
  const [
    reasons,
    sources,
    vendorSlots,
    tasks,
    templates,
    recalculation,
    program,
    programTemplates,
    links,
    activity,
    sentEmails,
    prospectRequest,
  ] = await Promise.all([
    listLossReasons(organizationId),
    listProspectSources(organizationId),
    listEventVendorSlots(organizationId, id),
    listEventTasks(organizationId, id),
    listTaskTemplates(organizationId),
    getTaskRecalculation(organizationId, id),
    getEventProgram(organizationId, id),
    listProgramTemplates(organizationId),
    listEventLinks(organizationId, id),
    listEventActivity(organizationId, id),
    // Lot 65d (MSG-01 ; ADR 0110) : les messages de la relation que la planner a dit avoir envoyés de sa
    // messagerie, dans le fil d'activité (le modèle et la personne de l'équipe, jamais l'adresse).
    listPreparedEmails(organizationId, { eventId: id, status: "sent" }),
    // Lot 44 (CRM-01, D5) : la demande reçue par le formulaire de contact, affichée telle quelle.
    getEventProspectRequest(organizationId, id),
  ]);
  const senders = sentEmails.length > 0 ? new Map((await listTeam(appDatabase(), organizationId)).map((member) => [member.id, member.email])) : new Map<string, string>();
  const tEmailKinds = await getTranslations("EmailTemplates");
  const programLabels = new Map(
    program.items.map((item) => [item.id, item.label]),
  );
  const locale = (await getLocale()) as Locale;
  const eventTypes = await ensureEventTypes(organizationId, locale);
  const progress = summarizeVendorSlots(vendorSlots);

  // Lot 63c (EVT-01, Q43) : un évènement sans client (un shooting photo) prend le nom de son type.
  const clientNames = event.name
    ? event.name
    : event.clients.length
    ? event.clients.map((client) => client.firstName).join(" & ")
    : (eventTypes.find((type) => type.id === event.eventTypeId)?.label ?? t("noClient"));

  // PRD-BUD-01/02 : « quand l'événement passe en Confirmé, l'app propose
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
  // Lot 31a (D3) : modèles de devis, ceux du type de l'événement en tête.
  const quoteTemplates = quotesAvailable
    ? (await listQuoteTemplates(organizationId)).sort((a, b) => Number(b.eventTypeId === event.eventTypeId) - Number(a.eventTypeId === event.eventTypeId))
    : [];
  const tQuotes = await getTranslations("Quotes");
  const tCandidates = await getTranslations("VendorCandidates");
  const tBudget = await getTranslations("Budget");
  const tBudgetVendors = await getTranslations("BudgetVendors");

  const today = parisToday();
  // Lot 34a (ARC-17, D9) : les heures de l'évènement dans son fuseau, nommé s'il n'est pas celui de Paris.
  const eventTime = (instant: Date | string) => {
    const text = formatDateTimeIn(new Date(instant), locale, event.timeZone);
    return event.timeZone === "Europe/Paris" ? text : `${text} (${event.timeZone.replaceAll("_", " ")})`;
  };
  // Lot 12 (L12-EVT-17) : l'ancien onglet « prestataires » est devenu « budget ».
  const asked = query.onglet === "prestataires" ? "budget" : query.onglet;
  // Lot 49 : le module Invités (et l'analyse d'impact) ; sans lui, pas d'onglet ni de chiffre.
  const guests = await guestsAccess();
  // Lot 60 : le module Plans de salle (fermé par défaut) ; sans lui, ni lien ni rubrique.
  const floorplans = await isFloorplansAvailable(organizationId, "events");
  const tab: Tab = TABS.includes(asked as Tab) && (asked !== "devis" || quotesAvailable) && (asked !== "invites" || guests !== null) ? (asked as Tab) : "apercu";
  const tabHref = (key: Tab, extra: Record<string, string> = {}) =>
    `/events/${event.id}?${new URLSearchParams({ onglet: key, ...extra }).toString()}`;
  const overdueCount = tasks.filter((task) => !task.done && task.dueDate < today).length;
  // Lot 12 (L12-EVT-14 / L12-EVT-15) : icônes des prestataires au programme, lieux saisis une fois.
  // Lot 34b (EVT-03) : les lieux nourrissent aussi la fiche d'identité de la synthèse.
  const [places, keyMoments] = tab === "programme" || tab === "apercu" ? await Promise.all([listEventPlaces(organizationId, id), listKeyMoments(organizationId, id)]) : [[], []];
  // Lot 51 (PAR-08, étape 7) : le bilan du lendemain, prêt après le dernier jour (fuseau de l'évènement).
  const lastDay = eventDays(keyMoments, event.eventDate).at(-1) ?? null;
  const dayReport =
    tab === "apercu" && lastDay && isReportReady(lastDay, event.timeZone, new Date())
      ? await getDayReport({ organizationId, eventId: id, handovers: (await isBudgetModuleEnabled(organizationId)) ? reportHandovers(await listDayHandovers(organizationId, id)) : [] })
      : null;
  const tReport = await getTranslations("DayReport");
  const reportTime = (iso: string) => new Intl.DateTimeFormat(locale, { timeZone: event.timeZone, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
  const reportSections = dayReport?.ready
    ? dayReportSections(dayReport, dayReportWords(tReport as never), { time: reportTime, amount: (cents) => new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(cents / 100) })
    : [];
  // Lot 51 (EVT-04 ; D1) : le programme se lit par jour et par temps fort.
  const momentChoices = keyMoments.map((moment) => ({ id: moment.id, label: `${moment.name} — ${formatCalendarDate(moment.date, locale)}` }));
  const guestSummary = tab === "apercu" && guests && (await getGuestModuleState(organizationId)).impactAssessmentConfirmedAt ? await getGuestEventSummary(organizationId, id) : null;
  // Lot 30a (JRJ-03, D4) : contacts du jour J, dans l'annuaire de l'écran du jour J.
  const dayContacts = tab === "programme" ? await listEventDayContacts(organizationId, id) : [];
  const tDayContacts = await getTranslations("DayContacts");
  const venueCandidates = tab === "programme" ? (await listVendorCandidates(organizationId, id)).filter((candidate) => candidate.outcome === "selected" && vendorSlots.find((slot) => slot.id === candidate.vendorSlotId)?.icon === "venue") : [];
  const placeSuggestions = [
    ...venueCandidates.map((candidate) => ({ label: candidate.vendorName, vendorId: candidate.vendorId })),
    ...(event.venueName ? [{ label: event.venueName, vendorId: null }] : []),
  ].filter((suggestion, index, all) => !places.some((place) => place.label.toLocaleLowerCase("fr") === suggestion.label.toLocaleLowerCase("fr")) && all.findIndex((other) => other.label === suggestion.label) === index);
  const placeOptions = [...new Set([...places.map((place) => place.label), ...placeSuggestions.map((suggestion) => suggestion.label)])];
  // Lot 30b (CHR-06, D7 et D8) : durées partout ; après le changement d'une heure de
  // début, la proposition de décaler les séquences suivantes d'autant.
  const spanWords = await programSpanWords();
  // Lot 51 (EVT-04) : un groupe par temps fort (dans l'ordre des jours), puis les séquences sans temps
  // fort ; les durées se calculent dans chaque groupe (la fin d'une séquence sans fin : la suivante).
  const programGroups = [
    ...keyMoments.map((moment) => ({ id: moment.id as string | null, label: `${moment.name} — ${formatCalendarDate(moment.date, locale)}` as string | null, items: program.items.filter((item) => item.keyMomentId === moment.id) })),
    { id: null, label: null, items: program.items.filter((item) => !keyMoments.some((moment) => moment.id === item.keyMomentId)) },
  ].filter((group) => group.items.length > 0);
  const responsibleOptions = [...new Set(program.items.flatMap((item) => (item.responsible ? [item.responsible] : [])))].sort((a, b) => a.localeCompare(b, "fr"));
  // Lot 48a (DAT-08) : notes confidentielles, déchiffrées pour leur auteur et la titulaire seuls.
  const eventConfidentialNotes =
    query.modifier === "infos" && event.notesConfidential
      ? await readEventConfidentialNotes(organizationId, id, { userId: auth.user.id, role: auth.user.role }).catch((error: unknown) => {
          if (error instanceof EventNotesForbiddenError) return null;
          throw error;
        })
      : null;
  const eventNotesReadable = !event.notesConfidential || eventConfidentialNotes !== null;
  // Lot 48a (PRE-06, D4) : contrôles du chrono par le lieu (programme) et capacité (synthèse).
  const venueChecks =
    tab === "programme" || tab === "apercu" ? await venueChecksFor(organizationId, id, program, event.guestsConfirmed ?? event.guestsEstimated) : null;
  const shiftedItem = tab === "programme" && query.decalage && isValidId(query.decalage) ? program.items.find((item) => item.id === query.decalage) : undefined;
  const shiftPlan = shiftedItem && query.depuis && /^([01]\d|2[0-3]):[0-5]\d$/.test(query.depuis) ? proposeProgramShift(program.items, shiftedItem.id, query.depuis, shiftedItem.startTime) : null;
  const shiftProposal: ShiftProposalView | null = shiftPlan ? { ...shiftPlan, duration: durationText(Math.abs(shiftPlan.minutes), spanWords) } : null;
  // Lot 37b (CHR-07, DAT-14 ; D8) : la diffusion du programme — dernière version, ce qui a changé
  // depuis, et les versions diffusées avec leur auteur (adresse de l'équipe).
  // Le client approuve une version diffusée (D10) : l'onglet Mariés propose la décision seulement alors.
  const publication = tab === "programme" || tab === "maries" ? await getEventProgramPublication(organizationId, id) : null;
  // Lot 38a (D9) : qui recevrait la dernière version par e-mail, tant qu'elle n'est pas partie.
  // Lot 38b (HUB-29 ; D11) : l'adresse du programme dans l'agenda de la personne connectée.
  const programFeed = tab === "programme" && !event.isDemo ? ((await listCalendarFeeds(organizationId, auth.user.id)).find((feed) => feed.eventId === id) ?? null) : null;
  const tCalendar = await getTranslations("Calendar");
  const programRecipients =
    tab === "programme" && publication?.latest && !publication.latest.notifiedAt && !event.isDemo ? (await listProgramRecipients(organizationId, id)).length : 0;
  const publishers =
    publication && publication.versions.some((version) => version.publishedByUserId !== null)
      ? new Map((await listTeam(appDatabase(), organizationId)).map((member) => [member.id, member.email]))
      : new Map<string, string>();
  const publisherOf = (userId: string | null) => (userId ? (publishers.get(userId) ?? t("taskCommentFormerMember")) : t("programVersionMigrated"));
  const quoted = (labels: string[]) => labels.join(" ; ");
  // Lot 34a (EVT-01, ADR 0055) : le rétroplanning naît avec l'évènement, Option comprise ; la
  // décision L12-EVT-13 (seulement à la confirmation) est remplacée.

  // PRD-EVT-03 : postes en tableau, détail du poste choisi dans un panneau.
  // Lot 28a (PRE-02) : un poste est pourvu dès qu'un prestataire est retenu.
  const toFind = vendorSlots.filter((slot) => !SETTLED_SLOT_STATUSES.has(slot.status));
  const slotFilter = query.filtre === "a-pourvoir" ? "a-pourvoir" : "tous";
  const shownSlots = slotFilter === "a-pourvoir" ? toFind : vendorSlots;
  const selectedSlot = vendorSlots.find((slot) => slot.id === query.poste) ?? null;
  // Lot 12 (L12-EVT-17) : prévu et réel de chaque ligne, si le module Budget est souscrit.
  // NFR-02 : les lectures de l'onglet « Budget et prestataires » partent ensemble.
  const [budgetAvailable, candidates, vendorsAvailable] =
    tab === "budget" ? await Promise.all([isBudgetModuleEnabled(organizationId), listVendorCandidates(organizationId, id), isVendorsModuleEnabled(organizationId)]) : [false, [], false];
  const bookOptionsWanted = (selectedSlot || (tab === "budget" && budgetAvailable)) && vendorsAvailable;
  const [budgetView, catalogVendors, budgetFollowUps, vendorTypes] = await Promise.all([
    budgetAvailable ? listBudgetLines(organizationId, id) : null,
    bookOptionsWanted ? findVendors({ organizationId }) : [],
    // Lot 65b (M14 B) : les relances du détail des prestataires, montré dans la fenêtre du poste.
    budgetAvailable ? listVendorFollowUps(organizationId, id) : [],
    tab === "budget" && budgetAvailable && vendorsAvailable ? listVendorTypes(organizationId) : [],
  ]);
  // Lot 28b (Q33) : chaque poste est une catégorie du budget, avec ses lignes.
  const categoryOf = (slotId: string) => budgetView?.categories.find((category) => category.eventVendorSlotId === slotId) ?? null;
  // Lot 11 (L11-EVT-10) : prestataires consultés, et le carnet s'il est souscrit.
  const bookOptions = catalogVendors.map((vendor) => ({ id: vendor.id, label: vendor.city ? `${vendor.name} — ${vendor.city}` : vendor.name }));
  const candidatesBySlot = (slotId: string) => candidates.filter((candidate) => candidate.vendorSlotId === slotId);
  // Lot 63c (BUD-01, BUD-03, BUD-04 ; M9) : les lignes de « Budget et prestataires », et les métiers du
  // catalogue pour « + Nouveau prestataire ».
  const budgetRows = budgetView ? buildBudgetVendorRows(vendorSlots, budgetView.categories, today) : null;
  // Lot 65b (M14 B) : les réglages et le détail des prestataires de chaque poste, rendus ici et montrés
  // dans la fenêtre du poste.
  const slotPanels = budgetView
    ? Object.fromEntries(
        vendorSlots.map((slot) => [
          slot.id,
          {
            settings: (
              <div className="stack">
                <VendorSlotForm eventId={event.id} slot={slot} />
                <SlotIconForm key={`icon-${slot.id}-${slot.icon ?? ""}`} eventId={event.id} slotId={slot.id} label={slot.label} icon={slot.icon} />
                <ImportedFields fields={slot.importedFields} compact />
                <form action={removeVendorSlotAction}>
                  <input type="hidden" name="eventId" value={event.id} />
                  <input type="hidden" name="vendorSlotId" value={slot.id} />
                  <button type="submit" className="button-ghost">
                    {t("removeVendorSlot", { label: slot.label })}
                  </button>
                </form>
              </div>
            ),
            details: <VendorCandidates eventId={event.id} slot={slot} candidates={candidatesBySlot(slot.id)} bookOptions={bookOptions} vendorsAvailable={vendorsAvailable} locale={locale} followUps={budgetFollowUps} />,
          },
        ]),
      )
    : {};
  const budgetVendorTypes = budgetView ? vendorTypes.map((type) => ({ id: type.id, label: type.label })) : [];
  // Somme des devis des prestataires retenus d'un poste (null s'il n'y en a aucun connu).
  const retainedQuotesOf = (slot: EventVendorSlot) => {
    const quotes = slot.retainedVendors.map((vendor) => vendor.quoteAmountCents).filter((amount): amount is number => amount !== null);
    return quotes.length > 0 ? quotes.reduce((sum, amount) => sum + amount, 0) : null;
  };

  // Lot 70c (CHR-02, CHR-03, EVT-03 ; A21, C-39) : l'onglet « Tâches » — filtres Qui s'en charge, Période,
  // Catégorie, État (« À faire » par défaut), ligne type sans la colonne Évènement, panneau unique.
  const taskFilters = readEventTaskFilters(query);
  const taskMembers = tab === "taches" ? await taskMemberOptions(organizationId, auth.user.id) : [];
  const taskCategories = tab === "taches" ? await ensureTaskCategories(organizationId, locale) : [];
  const dueTasks = tab === "taches" ? await listEventTasks(organizationId, id, today) : [];
  const shownTasks = filterEventTasks(dueTasks, taskFilters, { today, meId: auth.user.id, periodRange });
  const taskQuery = (changes: Record<string, string>) => tabHref("taches", { ...filtersQuery(taskFilters), ...changes });
  const taskVendors = tab === "taches" ? await engagedVendors(organizationId, [id]) : new Map<string, { candidateId: string; name: string }[]>();
  const taskLines =
    tab === "taches"
      ? await buildTaskLines({
          organizationId,
          locale,
          tasks: shownTasks.map((task) => ({ ...task, event: null })),
          members: taskMembers,
          vendors: taskVendors,
          href: (task) => taskQuery({ tache: task.id }),
        })
      : null;
  const taskPanel = tab === "taches" ? panelFromQuery(query, isValidId, id) : null;
  const tLine = await getTranslations("TaskLine");

  // Lot 26a : personnes et catégories proposées dans les formulaires des liens.
  const linkClients = event.clients.map((client) => ({ id: client.id, name: [client.firstName, client.lastName].filter(Boolean).join(" "), email: client.email ?? null }));
  const linkSlots = vendorSlots.map((slot) => ({ id: slot.id, label: slot.label }));
  const slotLabelById = new Map(linkSlots.map((slot) => [slot.id, slot.label]));
  // Lot 26b (D9) : prestataires de l'événement ; un lien se crée pour un
  // prestataire retenu, prérempli depuis sa fiche du carnet si le module est souscrit.
  const linkCandidates = tab === "maries" ? await listVendorCandidates(organizationId, id) : [];
  const vendorLabelOf = (candidateId: string | null) => {
    const candidate = linkCandidates.find((item) => item.id === candidateId);
    return candidate ? `${candidate.vendorName} — ${slotLabelById.get(candidate.vendorSlotId) ?? ""}` : "";
  };
  const linkVendorCards = tab === "maries" && (await isVendorsModuleEnabled(organizationId));
  // Lot 27b (POR-03, BUD-07, EVT-09) : décisions demandées au client ; ce que la
  // planner peut demander (postes montrant deux options au moins, dépenses
  // chiffrées, programme non vide).
  const decisions = tab === "maries" ? await listEventDecisions(organizationId, id) : [];
  const tDecisions = await getTranslations("Decisions");
  const tCoordination = await getTranslations("VendorCoordination");
  const decisionSlots = vendorSlots
    .map((slot) => ({ id: slot.id, label: slot.label, options: linkCandidates.filter((candidate) => candidate.vendorSlotId === slot.id && candidate.shownToClients).length }))
    .filter((slot) => slot.options >= 2);
  const decisionBudget = tab === "maries" && (await isBudgetModuleEnabled(organizationId)) ? await listBudgetLines(organizationId, id) : null;
  const decisionExpenses = (decisionBudget?.lines ?? []).flatMap((line) => {
    const amount = line.quotedAmountCents ?? line.committedAmountCents ?? line.estimatedAmountCents ?? 0;
    const slotLabel = decisionBudget?.categories.find((category) => category.eventVendorSlotId === line.eventVendorSlotId)?.label ?? "";
    return amount > 0 ? [{ lineId: line.id, label: `${[slotLabel, line.vendorName, line.label].filter((part, index, all) => part && all.indexOf(part) === index).join(" — ")} (${formatAmount(amount, locale)})` }] : [];
  });
  const decisionById = new Map(decisions.map((decision) => [decision.id, decision]));
  const linkVendors: LinkFormVendor[] = await Promise.all(
    linkCandidates
      .filter((candidate) => candidate.outcome === "selected")
      .map(async (candidate) => {
        const card = linkVendorCards && candidate.vendorId ? await getVendor(organizationId, candidate.vendorId) : null;
        return { candidateId: candidate.id, label: vendorLabelOf(candidate.id), personName: card?.contactName || candidate.vendorName, email: card?.email ?? "" };
      }),
  );

  // Lot 13 (L13-EVT-19) : frise datée, prochaine étape, chiffres de la vue d'ensemble.
  const statusDates = await getEventStatusDates(organizationId, id);
  // Lot 34a (EVT-05, CHR-01) : ce que ferait le recalcul (report ou nouvelle date), et les tâches
  // qui tomberaient dans le passé.
  const preview = recalculation.pending || event.status === "postponed" ? await previewTaskRecalculation(organizationId, id, today) : null;
  const invoicesToCredit =
    event.status === "cancelled" && quotesAvailable
      ? (await Promise.all(quotes.map((quote) => listQuoteInvoices(organizationId, quote.id)))).flat().filter((invoice) => !invoice.isDemo && invoice.creditedCents < invoice.amountCents)
      : [];
  const step = nextStep({
    status: event.status,
    isDemo: event.isDemo,
    quotesAvailable,
    hasSentOrSignedQuote: quotes.some((quote) => quote.status !== "draft"),
    taskCount: tasks.length,
    templateCount: templates.length,
    eventDate: event.eventDate,
    programItemCount: program.items.length,
    clientLinkCount: links.filter((link) => link.audience === "client" && link.status !== "revoked").length,
    today,
  });
  // Lot 32a (EVT-02, D5) : compte à rebours, aperçu du portail, « Annuler » après une tâche cochée.
  const clientPreviewLink = links.find((link) => link.audience === "client" && link.status === "active") ?? null;
  // Lot 32b (UX-03), lot 38b (D10) : « Écrire au client » mène au message depuis un modèle ; la
  // messagerie de la planner l'envoie (Symbola n'envoie rien).
  const clientEmails = event.clients.flatMap((client) => (client.email ? [client.email] : []));
  // Lot 33b (HUB-10) : l'évènement fictif en cours (essai ou exemple), pour sa date de suppression
  // et la proposition de le supprimer au premier évènement réel.
  const activeDemo = event.isDemo || query.exemple === "proposer" ? await getActiveEventsTrial(organizationId) : null;
  const undoneTask = query.fait && query.evenement === event.id ? (tasks.find((task) => task.id === query.fait && task.done) ?? null) : null;
  const tToday = await getTranslations("Today");
  const clientTerm = await clientTermForEvent(organizationId, event.id, locale === "en" ? "en" : "fr");

  // AIDE-05 : visite focus de la fiche, à la première ouverture.
  const tour = await loadPageTour(auth.user.id, "event", query.visite);
  // Lot 29b (JRJ-04, D8) : documents de l'événement, et ceux embarqués pour le jour J.
  const eventDocuments = await listEventDocuments(organizationId, id);
  const embeddedDocumentIds =
    tab === "documents" ? new Set((await listDayDocumentChoices(organizationId, id)).filter((choice) => choice.source === "event_document").map((choice) => choice.sourceId)) : new Set<string>();

  // Lot 32a (UX-01, D5) : sur la synthèse, la prochaine action vient d'abord ; le bandeau de la
  // prochaine étape passe juste dessous. Sur les autres onglets, il reste au-dessus des onglets.
  const stepBanner =
    step && !(step === "apply_retroplanning" && tab === "taches") ? (
      <NextStepBanner storageKey={`symbola_prochaine_etape_${event.id}_${step}`} title={t(`nextStep.${step}.title`)} laterLabel={t("nextStepLater")}>
        {step === "apply_retroplanning" ? (
          <>
            <p>{event.eventDate ? t("proposeRetroplanningBody") : t("taskTemplateNeedsDate")}</p>
            {event.eventDate ? <ApplyTaskTemplateForm eventId={event.id} templates={templates} /> : null}
          </>
        ) : (
          <>
            <p>{t(`nextStep.${step}.body`)}</p>
            <Link
              href={tabHref(step === "send_quote" ? "devis" : step === "prepare_program" ? "programme" : "maries")}
              className="button-link button-link-primary"
            >
              {t(`nextStep.${step}.action`)}
            </Link>
          </>
        )}
      </NextStepBanner>
    ) : null;

  // Lot 72d (EVT-02, EVT-05 ; C-22, C-23, C-27 ; E1 à E4, J9 à J12 ; page 15) — l'en-tête de la fiche :
  // retour, nom, une ligne de faits, la frise en lecture, une action et le menu « ⋯ » ; puis les onglets.
  const tHeader = await getTranslations("EventHeader");
  const leadDays = await getDayOfLeadDays(organizationId);
  const dayOfOpen = isDayOfOpen(event);
  const writeLabel = clientTerm.custom ? tHeader("writeToTerm", { term: clientTerm.term, gender: clientTerm.gender, number: clientTerm.number }) : tHeader("writeToClients");
  const write = clientEmails.length > 0 ? { href: `/events/${event.id}/ecrire`, label: writeLabel } : null;
  const dayOf = dayOfOpen ? { href: `/jour-j/${event.id}`, label: tHeader("openDayOf") } : null;
  const shownAction: "write" | "day_of" | null = dayOf && headerAction(event, leadDays) === "day_of" ? "day_of" : write ? "write" : null;
  const archived = Boolean(event.archivedAt);
  const timeline = eventTimeline({ status: event.status, phase: event.phase, dates: statusDates, eventDate: event.eventDate, postponedFromDate: event.postponedFromDate, archived, closingDue: closingDue(event) });
  const typeLabel = eventTypes.find((type) => type.id === event.eventTypeId)?.label ?? null;
  const dateWords = (options: Intl.DateTimeFormatOptions) => (event.eventDate ? new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", { ...options, timeZone: "UTC" }).format(new Date(`${event.eventDate}T00:00:00Z`)) : tHeader("dateUnset"));
  const daysLeft = event.eventDate ? Math.round((Date.parse(`${event.eventDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000) : null;
  const countdownWords = daysLeft === null ? null : daysLeft >= 0 ? tHeader("countdown", { days: daysLeft }) : tHeader("countdownPast", { days: -daysLeft });
  const venueWords = [event.venueName, event.venueCity].filter(Boolean).join(", ");
  const statusWords = timeline.line ? tHeader(`timeline.${timeline.line.kind}`) : timeline.current ? tHeader(`timeline.${timeline.current}`) : "";
  const reasonOf = reasons.find((candidate) => candidate.id === event.lossReasonId);
  const reasonWords = reasonOf ? (reasonOf.isFreeText && event.lossReasonNote ? event.lossReasonNote : reasonOf.label) : null;
  const tasksDone = tasks.filter((task) => task.done).length;
  const guestCounts = guests && (await getGuestModuleState(organizationId)).impactAssessmentConfirmedAt ? (guestSummary ?? (await getGuestEventSummary(organizationId, id))) : null;
  // J11 : le nombre d'un onglet dit ce qui demande attention, avec son mot.
  const tabsView: EventTab[] = [
    { key: "apercu", label: t("tabOverview"), href: tabHref("apercu") },
    {
      key: "budget",
      label: t("vendorSlotsTitle"),
      short: tHeader("tabs.budgetShort"),
      href: tabHref("budget"),
      // « 6 sur 9 » : postes pourvus sur requis ; aucun poste requis, aucun nombre (pas de « 0 sur 0 »).
      ...(progress.required > 0 ? { count: { text: tHeader("tabs.countOf", { done: progress.booked, total: progress.required }), short: tHeader("tabs.countOfShort", { done: progress.booked, total: progress.required }), alert: false } } : {}),
    },
    {
      key: "taches",
      label: tLine("tabTitle"),
      href: tabHref("taches"),
      ...(overdueCount > 0
        ? { count: { text: tHeader("tabs.late", { count: overdueCount }), short: tHeader("tabs.lateShort", { count: overdueCount }), alert: true } }
        : tasks.length > 0
          ? { count: { text: tHeader("tabs.countOf", { done: tasksDone, total: tasks.length }), short: tHeader("tabs.countOfShort", { done: tasksDone, total: tasks.length }), alert: false } }
          : {}),
    },
    { key: "programme", label: tHeader("tabs.program"), href: tabHref("programme") },
    ...(quotesAvailable ? [{ key: "devis", label: tHeader("tabs.quotes"), short: tHeader("tabs.quotesShort"), href: tabHref("devis"), count: { text: String(quotes.length), short: String(quotes.length), alert: false } }] : []),
    // Lot 53 (HUB-24, D8) : le terme réglé pour le type de l'évènement remplace « Mariés » ou « Clients ».
    { key: "maries", label: clientTerm.custom ? clientTerm.term.charAt(0).toLocaleUpperCase(locale) + clientTerm.term.slice(1) : t("tabClients"), href: tabHref("maries") },
    { key: "documents", label: t("tabDocuments"), href: tabHref("documents"), count: { text: String(eventDocuments.length), short: String(eventDocuments.length), alert: false } },
    ...(guests
      ? [{ key: "invites", label: t("tabGuests"), href: tabHref("invites"), ...(guestCounts && guestCounts.households > 0 ? { count: { text: tHeader("tabs.replies", { answered: guestCounts.answered, total: guestCounts.households }), short: tHeader("tabs.repliesShort", { answered: guestCounts.answered, total: guestCounts.households }), alert: false } } : {}) }]
      : []),
  ];

  return (
    <main className="event-sheet">
      <EventCommands
        eventId={event.id}
        names={clientNames}
        headerAction={shownAction}
        write={write}
        dayOf={dayOf}
        messages={{ href: `/events/${event.id}/messages`, label: tHeader("messages") }}
        viewAs={clientPreviewLink ? { href: `/events/${event.id}/liens/${clientPreviewLink.id}/apercu`, label: tHeader("viewAs", { name: clientPreviewLink.personName }) } : null}
        types={archived ? null : { current: event.eventTypeId, options: eventTypes.map((type) => ({ id: type.id, label: type.label })) }}
        canPostpone={!archived && canPostpone(event.status)}
        canCancel={!archived && event.status !== "cancelled" && event.status !== "closed"}
        reasons={reasons}
      >
        <header id="event-header" className="object-header" data-tour="event-header">
          <EventBack names={clientNames} />
          <div className="object-header-row">
            <div className="object-header-main">
              <h1>{clientNames}</h1>
              <p className="object-header-facts">
                {typeLabel ? <span className="object-header-type">{typeLabel}</span> : null}
                <span className="object-header-date-long">{dateWords({ weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
                <span className="object-header-date-short">{dateWords({ day: "numeric", month: "long", year: "numeric" })}</span>
                {countdownWords ? <span className="countdown">{countdownWords}</span> : null}
                {venueWords ? <span className="object-header-venue">{venueWords}</span> : null}
              </p>
              {/* Lot 71f : « Repris le … · Voir la reprise » d'un mariage repris se pose ici, sous la ligne de faits. */}
            </div>
            <div className="object-header-actions">
              {shownAction === "day_of" && dayOf ? (
                // L'écran du jour J est servi hors de l'app (service worker) : un lien plein.
                <a href={dayOf.href} className="button-link object-header-action">
                  {dayOf.label}
                </a>
              ) : shownAction === "write" && write ? (
                // Lot 38b (HUB-21, D10) : le message depuis un modèle ; la messagerie de la planner l'envoie.
                <Link href={write.href} className="button-link object-header-action">
                  {write.label}
                </Link>
              ) : null}
              <EventMenuButton />
            </div>
          </div>
          <StatusTimeline
            eventId={event.id}
            names={eventNames(event.clients, event.name)}
            view={timeline}
            locale={locale}
            today={dateInTimeZone(new Date(), event.timeZone)}
            closingHref={`/events/${event.id}/cloture`}
            editInfoHref={tabHref("apercu", { modifier: "infos" })}
            quotesHref={tabHref("devis")}
            reason={reasonWords}
            postponement={event.status === "postponed" ? { newDate: event.eventDate, moves: preview?.moves.length ?? 0, inThePast: preview?.inThePast.map((task) => ({ taskId: task.taskId, label: task.label, toDate: task.toDate })) ?? [] } : null}
            hasSignedQuote={quotes.some((quote) => quote.status === "signed")}
            invoicesToCredit={invoicesToCredit.map((invoice) => ({ id: invoice.id, number: invoice.number ?? "", amountCents: invoice.amountCents - invoice.creditedCents, quoteId: invoice.quoteId }))}
          />
        </header>
        <EventTabs
          tabs={tabsView}
          current={tab}
          panelId="event-tab-panel"
          summary={{ names: clientNames, date: dateWords({ weekday: "short", day: "numeric", month: "short", year: "numeric" }), status: statusWords }}
        />
      </EventCommands>

      <div id="event-tab-panel" role="tabpanel" aria-labelledby={`event-tab-${tab}`} className="event-tab-panel">
      {undoneTask ? (
        <UndoTaskNotice key={undoneTask.id} eventId={event.id} taskId={undoneTask.id} message={tToday("undo.taskDone", { label: undoneTask.label })} undoLabel={tToday("undo.action")} returnTo="event" />
      ) : null}
      <PageTour {...tour} helpTitle={tHelp("eventsDetail.title")} helpBody={tHelp("eventsDetail.body")} />

      {/* Lot 33b (HUB-10, D10) : la suppression de l'exemple est proposée au premier évènement réel. */}
      {!event.isDemo && query.exemple === "proposer" && activeDemo ? (
        <section className="card notice" aria-labelledby="example-proposal-title">
          <h2 id="example-proposal-title">{t("exampleProposalTitle")}</h2>
          <p>{t("exampleProposalBody")}</p>
          <div className="row-wrap">
            <form action={removeExampleAction}>
              <input type="hidden" name="eventId" value={activeDemo.eventId} />
              <input type="hidden" name="returnTo" value={event.id} />
              <button type="submit">{t("exampleRemove")}</button>
            </form>
            <Link href={`/events/${event.id}`}>{t("exampleKeep")}</Link>
          </div>
        </section>
      ) : null}
      {!event.isDemo && query.exemple === "supprime" ? <p role="status">{t("exampleRemoved")}</p> : null}

      {/* AIDE-02 : bandeau des données fictives (essai guidé ; lot 33b : l'exemple du démarrage). */}
      {event.isDemo ? (
        <section aria-labelledby="trial-banner-title">
          <h2 id="trial-banner-title">{t("trialBannerTitle")}</h2>
          <p>{t("trialBannerBody", { date: activeDemo?.eventId === event.id ? formatDate(new Date(activeDemo.expiresAt), locale) : "—" })}</p>
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

      {tab !== "apercu" ? stepBanner : null}

      {tab === "apercu" ? (
        <>
          {/* Lot 32a (EVT-02, UX-01, UX-06 ; D5) : prochaine action, santé, quatorze prochains jours. */}
          <EventCockpit organizationId={organizationId} eventId={event.id} tasks={tasks} quotesAvailable={quotesAvailable} today={today} locale={locale} afterNextAction={stepBanner} vendorProgress={progress} />
          {/* Lot 52 (EVT-06 ; D2, D3) : l'équipe de l'évènement et ses renforts du jour J. */}
          <EventTeamCard organizationId={organizationId} eventId={event.id} />
          {/* Lot 64 (HUB-29, RDV-02 ; maquette M3) : la plage occupée de l'évènement. */}
          <EventBusyCard organizationId={organizationId} eventId={event.id} eventDate={event.eventDate} eventLabel={eventNames(event.clients)} readOnly={Boolean(event.archivedAt)} />
          {/* Lot 34b (EVT-03, D10, D11) : fiche d'identité — invités, lieux, interlocuteurs, style, notes. */}
          <section className="card" aria-labelledby="identity-title">
            {/* Lot 39c (UX-13, relevé validé le 17/11) : « Modifier les informations » ouvre un panneau. */}
            <div className="section-head">
              <h2 id="identity-title">{t("identityTitle")}</h2>
              <Link className="button-link" href={tabHref("apercu", { modifier: "infos" })} scroll={false}>
                {tToday("cockpit.editInfo")}
              </Link>
            </div>
            <dl className="identity-facts">
              <dt>{t("guestsLabel")}</dt>
              {/* Lot 49 (EVT-03) : avec le module Invités, le nombre confirmé vient des réponses. */}
              <dd>{t("guestsSummary", { estimated: event.guestsEstimated === null ? "—" : String(event.guestsEstimated), confirmed: guestSummary ? String(guestSummary.confirmed) : event.guestsConfirmed === null ? "—" : String(event.guestsConfirmed) })}
                {/* Lot 48a (PRE-06) : invités au-delà de la capacité du lieu de réception. */}
                {venueChecks ? <VenueCapacityNotice finding={venueChecks.capacity} /> : null}
              </dd>
              <dt>{t("placesTitle")}</dt>
              <dd>
                {places.length === 0 ? t("noPlaces") : places.map((place) => (place.startTime ? `${place.label} (${place.startTime})` : place.label)).join(" · ")}{" "}
                <Link href={tabHref("programme")}>{t("placesManage")}</Link>
              </dd>
              <dt>{t("interlocutorsLabel")}</dt>
              <dd>
                {[
                  ...event.clients.map((client) => [client.firstName, client.lastName].filter(Boolean).join(" ")),
                  ...places.filter((place) => place.contactName).map((place) => t("interlocutorOfPlace", { name: place.contactName!, place: place.label })),
                ].join(" · ") || "—"}
              </dd>
              <dt>{t("eventStyle")}</dt>
              <dd>{event.style ?? "—"}</dd>
              <dt>{t("eventNotes")}</dt>
              <dd className="task-comment-body">{event.notes ?? "—"}</dd>
            </dl>
          </section>
          {/* Lot 49 (EVT-04 premier pas, D2) : temps forts de l'évènement ; le RSVP les reprend. */}
          <section className="card stack" aria-labelledby="key-moments-title">
            <h2 id="key-moments-title">{t("keyMomentsTitle")}</h2>
            <p className="muted">{t("keyMomentsHelp")}</p>
            {keyMoments.length === 0 ? <p>{t("keyMomentsEmpty")}</p> : null}
            <ul className="plain-list stack">
              {keyMoments.map((moment) => (
                <li key={moment.id}>
                  <strong>{moment.name}</strong> — {[formatCalendarDate(moment.date, locale), moment.startTime, moment.placeLabel].filter(Boolean).join(" · ")}
                  <EditKeyMomentForm eventId={event.id} moment={moment} places={places} itemCount={program.items.filter((item) => item.keyMomentId === moment.id).length} />
                </li>
              ))}
            </ul>
            <AddKeyMomentForm eventId={event.id} places={places} defaultDate={event.eventDate} />
          </section>
          {/* Lot 51 (PAR-08, étape 7) : le bilan du lendemain, interne à l'organisation. */}
          {dayReport?.ready ? (
            <section className="card stack" aria-labelledby="day-report-title">
              <div className="section-head">
                <h2 id="day-report-title">{tReport("title")}</h2>
                <a href={`/events/${event.id}/bilan`} download>
                  {tReport("download")}
                </a>
              </div>
              <p className="muted">{tReport("internal")}</p>
              {reportSections.map((section) => (
                <section key={section.title} aria-label={section.title}>
                  <h3>{section.title}</h3>
                  {section.lines.length === 0 ? (
                    <p>{section.empty}</p>
                  ) : (
                    <ul>
                      {section.lines.map((line, index) => (
                        <li key={`${index}-${line}`}>{line}</li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </section>
          ) : null}
          {/* D5 : les formulaires de l'ancien aperçu, dans le panneau. */}
          {query.modifier === "infos" ? (
            <SidePanel title={tToday("cockpit.editInfo")} closeHref={tabHref("apercu")} closeLabel={tCommon("closePanel")}>
              <EventDateForm eventId={event.id} eventDate={event.eventDate} />
              <TimeZoneForm eventId={event.id} timeZone={event.timeZone} zones={Intl.supportedValuesOf("timeZone")} />
              <WantedBudgetForm key={`wanted-${event.wantedBudgetCents ?? ""}`} eventId={event.id} wantedBudgetCents={event.wantedBudgetCents} />
              <VenueForm eventId={event.id} venueName={event.venueName} venueCity={event.venueCity} />
              {/* Sans clé liée aux valeurs : l'enregistrement garde son message de confirmation. */}
              <EventIdentityForm eventId={event.id} identity={event} version={identityVersion} confidentialNotes={Boolean(event.notesConfidential)} />
              {/* Lot 48a (DAT-08) : notes confidentielles, lues par leur auteur et la titulaire seuls. */}
              {eventNotesReadable ? (
                <EventNotesForm eventId={event.id} notes={event.notesConfidential ? eventConfidentialNotes : event.notes} confidential={Boolean(event.notesConfidential)} />
              ) : (
                <p className="muted">{t("eventNotesConfidentialHidden")}</p>
              )}
            </SidePanel>
          ) : null}
          <ImportedFields fields={event.importedFields} />
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
          {/* Lot 46 (EVT-10, D8) : rendez-vous et comptes rendus, si le module Rendez-vous est ouvert. */}
          <EventAppointments organizationId={organizationId} eventId={event.id} locale={locale} />
          {prospectRequest ? (
            <section className="card" aria-labelledby="prospect-request-title">
              <h2 id="prospect-request-title">{t("prospectRequestTitle")}</h2>
              <p className="meta">{t("prospectRequestReceived", { date: eventTime(prospectRequest.receivedAt) })}</p>
              {prospectRequest.period ? <p>{t("prospectRequestPeriod", { period: prospectRequest.period })}</p> : null}
              {prospectRequest.budgetRange ? <p>{t("prospectRequestBudget", { budget: prospectRequest.budgetRange })}</p> : null}
              {/* Le message du prospect, en texte : jamais interprété (balises affichées telles quelles). */}
              {prospectRequest.message ? <p className="pipeline-message">{prospectRequest.message}</p> : <p className="meta">{t("prospectRequestNoMessage")}</p>}
            </section>
          ) : null}
          {/* Lot 45 (CRM-05, CRM-06, POR-07) : réponses, relances, questionnaires et historique. */}
          <ProspectExchanges organizationId={organizationId} eventId={event.id} isOption={event.status === "option"} locale={locale === "en" ? "en" : "fr"} />
          <section className="card" aria-labelledby="activity-title">
            <h2 id="activity-title">{t("activityTitle")}</h2>
            {activity.length === 0 && sentEmails.length === 0 ? <p>{t("noActivity")}</p> : null}
            <ul aria-label={t("activityTitle")}>
              {[
                ...activity.map((entry) => ({
                  id: entry.id,
                  at: entry.createdAt,
                  text: t(entry.kind === "task_done" ? "activityTaskDone" : entry.kind === "decision_made" ? "activityDecisionMade" : entry.kind === "vendor_reminded" ? "activityVendorReminded" : entry.kind === "document_link_opened" ? "activityDocumentLinkOpened" : entry.kind === "stage_changed" ? "activityStageChanged" : "activityTaskUndone", {
                    actor: entry.actorName ?? t("activityFormerClient"),
                    task: entry.taskLabel || (entry.kind === "vendor_reminded" ? t("activityVendorRemoved") : tDecisions("programLabel")),
                  }),
                })),
                ...sentEmails.map((email) => ({
                  id: email.id,
                  at: email.sentAt ?? email.createdAt,
                  text: t("activityEmailSent", { actor: (email.sentByUserId ? senders.get(email.sentByUserId) : null) ?? t("activityFormerMember"), kind: tEmailKinds(`kinds.${email.kind}.title`) }),
                })),
              ]
                .sort((left, right) => right.at.localeCompare(left.at))
                .map((entry) => (
                  <li key={entry.id}>
                    {eventTime(entry.at)} — {entry.text}
                  </li>
                ))}
            </ul>
          </section>
        </>
      ) : null}

      {/* Lot 63c (BUD-01, BUD-03, BUD-04 ; Q42, M9) : avec le module Budget, une seule vue par poste
          (prévu, réel, écart, réglé, reste, prochaine échéance, échéancier). Lot 65b (M14, ADR 0111) :
          tout le poste (prestataires, montants, échéancier, documents, réglages) est dans sa fenêtre ;
          plus de bloc en bas de page. */}
      {tab === "budget" && budgetView ? (
        <>
          <section className="card" aria-labelledby="vendor-slots-title">
            <div className="section-head">
              <h2 id="vendor-slots-title">{t("vendorSlotsTitle")}</h2>
              <div className="row-wrap">
                <Link href={`/budget/${event.id}/detail`} className="button-link">
                  {tBudgetVendors("detailLink")}
                </Link>
                {/* Lot 63b (HUB-14) : importer un budget depuis l'écran. */}
                {budgetAvailable ? (
                  <Link className="button-link" href={`/import?type=budget_lines&evenement=${event.id}#import-form`}>
                    {t("importHere")}
                  </Link>
                ) : null}
                <SettingsLink href="/events/parametres" back="event" label={t("vendorSlotsSettings")} />
              </div>
            </div>
            {/* Lot 67c (BUD-02 ; recette du 24/11/2026, R06) : les totaux en tête, sans descendre au pied
                d'un tableau de vingt lignes (qui les garde). */}
            {budgetRows && vendorSlots.length > 0 ? (
              <dl className="health-tiles budget-totals" aria-label={tBudgetVendors("totalsLabel")}>
                <div>
                  <dt>{tBudgetVendors("columnPlanned")}</dt>
                  <dd>{formatAmount(budgetRows.totals.plannedCents, locale)}</dd>
                </div>
                <div>
                  <dt>{tBudgetVendors("columnActual")}</dt>
                  <dd>{formatAmount(budgetRows.totals.actualCents, locale)}</dd>
                  <dd className="health-detail">{tBudgetVendors("engagedDetail", { amount: formatAmount(budgetRows.totals.engagedCents, locale) })}</dd>
                </div>
                <div>
                  <dt>{tBudgetVendors("columnVariance")}</dt>
                  <dd>{signedAmount(budgetRows.totals.varianceCents, (cents) => formatAmount(cents, locale))}</dd>
                </div>
                <div>
                  <dt>{tBudgetVendors("columnPaid")}</dt>
                  <dd>{formatAmount(budgetRows.totals.paidCents, locale)}</dd>
                </div>
                <div>
                  <dt>{tBudgetVendors("columnRemaining")}</dt>
                  <dd>{formatAmount(budgetRows.totals.remainingCents, locale)}</dd>
                </div>
              </dl>
            ) : null}
            <p id="vendor-progress-label">{t("vendorProgress", { booked: progress.booked, required: progress.required })}</p>
            {/* Lot 28a (BUD-02) : le dépassement du seuil d'alerte, en haut du budget. */}
            {budgetView.envelope?.exceeded ? (
              <p role="alert" className="notice notice-attention">
                {tBudget("envelopeExceeded", {
                  amount: formatAmount(budgetView.totalCommittedCents - budgetView.envelope.thresholdCents, locale),
                  percent: budgetView.envelope.thresholdPercent,
                })}
              </p>
            ) : null}
            <progress aria-labelledby="vendor-progress-label" value={progress.booked} max={Math.max(progress.required, 1)} />
            {/* Lot 67e (HUB-14, PRE-02 ; R07) : reprendre d'un PDF les prestataires retenus de l'évènement. */}
            {vendorsAvailable ? <VendorsImportForm eventId={event.id} open={query.reprendre === "1"} takeoverId={query.reprise && isValidId(query.reprise) ? query.reprise : null} /> : null}
            {vendorSlots.length === 0 ? <p>{t("noVendorSlots")}</p> : null}
            {vendorSlots.length > 0 ? (
              <BudgetVendorsTable
                eventId={event.id}
                rows={budgetRows!.rows}
                totals={budgetRows!.totals}
                locale={locale}
                initialSlotId={selectedSlot?.id ?? null}
                slotPanels={slotPanels}
                choices={Object.fromEntries(
                  vendorSlots.map((slot) => {
                    const inTheRunning = candidatesBySlot(slot.id).filter((candidate) => candidate.status !== "dismissed" && !ENGAGED_CANDIDATE_STATUSES.includes(candidate.status));
                    // La comparaison de la fenêtre se relit quand un prestataire du poste change (statut, devis).
                    const signature = candidatesBySlot(slot.id).map((candidate) => `${candidate.id}:${candidate.status}:${candidate.quoteAmountCents ?? ""}:${candidate.hasQuoteFile ? 1 : 0}:${candidate.notes.length}`).join("|");
                    return [slot.id, { comparing: inTheRunning.length, quotes: inTheRunning.filter((candidate) => candidate.quoteAmountCents !== null || candidate.hasQuoteFile).length, signature }];
                  }),
                )}
                catalogHrefs={Object.fromEntries(vendorSlots.map((slot) => [slot.id, `/prestataires?evenement=${event.id}&poste=${slot.id}`]))}
                consultationHrefs={Object.fromEntries(vendorSlots.map((slot) => [slot.id, `/events/${event.id}/consultation/${slot.id}`]))}
                vendorsAvailable={vendorsAvailable}
                vendorTypes={budgetVendorTypes}
                slotVendors={Object.fromEntries(vendorSlots.map((slot) => [slot.id, candidatesBySlot(slot.id).filter((candidate) => candidate.status !== "dismissed").map((candidate) => ({ id: candidate.id, name: candidate.vendorName }))]))}
                statusLabels={Object.fromEntries(Object.entries(VENDOR_STATUS_LABEL_KEYS).map(([status, key]) => [status, t(key)]))}
                statusClasses={VENDOR_STATUS_CLASSES}
              />
            ) : null}
            <AddVendorSlotForm eventId={event.id} />
          </section>
        </>
      ) : null}
      {tab === "budget" && !budgetView ? (
        <div className="split">
          <section className="card split-main" aria-labelledby="vendor-slots-title">
            <div className="section-head">
              <h2 id="vendor-slots-title">{t("vendorSlotsTitle")}</h2>
              <SettingsLink href="/events/parametres" back="event" label={t("vendorSlotsSettings")} />
            </div>
            <p id="vendor-progress-label">{t("vendorProgress", { booked: progress.booked, required: progress.required })}</p>
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
                      <th scope="col" className="num">
                        {t("vendorAmount")}
                      </th>
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
                          {slot.retainedVendors.length > 0
                            ? slot.retainedVendors.map((vendor) => vendor.vendorName).join(", ")
                            : candidatesBySlot(slot.id).length > 0
                              ? tCandidates("consultedCount", { count: candidatesBySlot(slot.id).length })
                              : "—"}
                        </td>
                        <td>
                          <span className={VENDOR_STATUS_CLASSES[slot.status]}>{t(VENDOR_STATUS_LABEL_KEYS[slot.status])}</span>
                        </td>
                        <td className="num">{retainedQuotesOf(slot) !== null ? formatAmount(retainedQuotesOf(slot)!, locale) : "—"}</td>
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
                <VendorSlotForm key={selectedSlot.id} eventId={event.id} slot={selectedSlot} />
                {/* Lot 28b (Q33) : l'estimé d'une catégorie à une seule ligne se saisit ici ; au-delà, sur le budget. */}
                {budgetView && (categoryOf(selectedSlot.id)?.lines.length ?? 0) <= 1 ? (
                  <PlannedAmountForm key={`planned-${selectedSlot.id}`} eventId={event.id} slotId={selectedSlot.id} label={selectedSlot.label} plannedCents={categoryOf(selectedSlot.id)?.lines[0]?.estimatedAmountCents ?? null} />
                ) : null}
                {budgetView && (categoryOf(selectedSlot.id)?.lines.length ?? 0) > 1 ? (
                  <p>
                    <Link href={`/budget/${event.id}/detail#categorie-${selectedSlot.id}`}>{t("budgetLinesDetail", { count: categoryOf(selectedSlot.id)?.lines.length ?? 0, line: selectedSlot.label })}</Link>
                  </p>
                ) : null}
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
      {tab === "budget" && !budgetView && selectedSlot ? (
        <VendorCandidates
          eventId={event.id}
          slot={selectedSlot}
          candidates={candidatesBySlot(selectedSlot.id)}
          bookOptions={bookOptions}
          vendorsAvailable={vendorsAvailable}
          locale={locale}
          followUps={await listVendorFollowUps(organizationId, event.id)}
        />
      ) : null}

      {/* PRD-EVT-04 ; lot 70c (CHR-02, CHR-03, EVT-03 ; C-33, C-38, C-39, A21) : l'onglet « Tâches » (le
          rétroplanning est ce qui les fabrique, cité sous le titre) ; « Nouvelle tâche » en haut, les filtres,
          la ligne type sans la colonne Évènement, et le panneau unique de la tâche. */}
      {tab === "taches" ? (
        <>
          <section className="card" aria-labelledby="tasks-title">
            <div className="section-head">
              <h2 id="tasks-title">{tLine("tabTitle")}</h2>
              {/* L'action principale de l'onglet, sauf quand le bandeau « Prochaine étape » en propose déjà une. */}
              <Link href={taskQuery({ nouvelle: "1" })} scroll={false} className={stepBanner ? "button-link" : "button-link button-link-primary"}>
                {tLine("newTask")}
              </Link>
            </div>
            <p className="meta">
              {tLine("tabSummary", { done: tasks.filter((task) => task.done).length, total: tasks.length, late: overdueCount })}
              {event.eventDate ? ` · ${tLine("tabCounted", { date: formatCalendarDate(event.eventDate, locale) })}` : ""} · <Link href="/events/modeles">{tLine("tabTemplates")}</Link>
            </p>
            {/* Lot 34a (D4) : pendant un report, les échéances suivent à la confirmation du report. */}
            {recalculation.pending && event.status !== "postponed" ? (
              <section aria-labelledby="recalculation-title">
                <h3 id="recalculation-title">{t("recalculationTitle")}</h3>
                <p>
                  {t("recalculationProposal", {
                    days: Math.abs(recalculation.shiftDays),
                    direction: recalculation.shiftDays > 0 ? "later" : "earlier",
                    count: recalculation.undoneTasks,
                  })}
                </p>
                {/* Lot 34a (EVT-05) : les tâches qui tomberaient dans le passé, avant de choisir. */}
                {preview && preview.inThePast.length > 0 ? (
                  <>
                    <p>{t("recalculationPastTitle", { count: preview.inThePast.length })}</p>
                    <ul>
                      {preview.inThePast.map((task) => (
                        <li key={task.taskId}>{t("postponementPastItem", { label: task.label, date: formatCalendarDate(task.toDate, locale) })}</li>
                      ))}
                    </ul>
                  </>
                ) : null}
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
            {!event.eventDate ? (
              <p>{t("taskTemplateNeedsDate")}</p>
            ) : templates.length === 0 ? (
              // Lot 69 (CHR-01 ; C-39) : la phrase n'a de sens que s'il n'y a encore aucune tâche.
              tasks.length === 0 ? (
                <p>
                  {t("noTaskTemplates")} <Link href="/events/modeles">{t("taskTemplatesLink")}</Link>
                </p>
              ) : null
            ) : !recalculation.pending ? (
              <ApplyTaskTemplateForm eventId={event.id} templates={templates} />
            ) : null}
            <TaskFiltersForm
              action={`/events/${event.id}`}
              hidden={{ onglet: "taches" }}
              filters={filterFormValues(taskFilters)}
              who={[
                { value: "moi", label: tLine("you") },
                ...taskMembers.filter((member) => !member.me && !member.removed).map((member) => ({ value: `member:${member.id}`, label: member.name })),
                { value: "clients", label: (await clientsTerms(organizationId, locale))(event.id) },
                { value: "prestataires", label: tLine("filterVendors") },
              ]}
              categories={taskCategories.map((category) => ({ value: category.id, label: category.label }))}
            />
            {tasks.length === 0 ? <p>{tLine("emptyEvent")}</p> : shownTasks.length === 0 ? <p>{tLine("emptyFiltered")}</p> : null}
            {taskLines && shownTasks.length > 0 ? (
              <TaskLineBoard
                groups={linesByMonth(taskLines.lines, locale)}
                form="event"
                label={tLine("tabTitle")}
                shortcuts={taskLines.shortcuts}
                assignOptions={taskLines.assignOptions}
                categories={taskCategories.map((category) => ({ value: category.id, label: category.label }))}
                members={taskMembers.filter((member) => !member.removed).map((member) => ({ value: `member:${member.id}`, label: member.me ? tLine("you") : member.name, initials: member.initials ?? nameInitials(member.name) }))}
                clientsLabel={(await clientsTerms(organizationId, locale))(event.id)}
              />
            ) : null}
          </section>
          {taskPanel ? (
            <TaskPanelLoader
              organizationId={organizationId}
              userId={auth.user.id}
              role={auth.user.role}
              locale={locale}
              today={today}
              open={taskPanel}
              closeHref={taskQuery({})}
              backLabel={eventNames(event.clients, event.name)}
              screenHref={(params) => taskQuery(params)}
            />
          ) : null}
        </>
      ) : null}

      {/* PRD-EVT-05 : programme du jour J. */}
      {tab === "programme" ? (
        <section className="card" aria-labelledby="program-title">
          <div className="section-head">
            <h2 id="program-title">{t("programTitle")}</h2>
            {/* Lot 63b (HUB-14) : importer depuis l'écran (tableur ou PDF de l'ancien logiciel). */}
            <Link className="button-link" href={`${tabHref("programme")}&importer=1#importer-programme`} scroll={false}>
              {t("importHere")}
            </Link>
            <SettingsLink href="/events/modeles-programme" back="event" label={t("programTemplatesSettings")} />
          </div>
          <ProgramShiftProposal eventId={event.id} proposal={shiftProposal} />
          {/* Lot 65g (CHR-08 ; recette staging du 22/11/2026) : « Importer » ouvre l'import en tête de la
              carte, au-dessus de la diffusion, au lieu de le déplier plus bas. */}
          {query.importer === "1" ? <ProgramImportForm eventId={event.id} open takeoverId={query.reprise && isValidId(query.reprise) ? query.reprise : null} /> : null}
          {/* Lot 62c (UX-13) : en tête de la carte, la diffusion à gauche, les PDF et l'agenda à droite. */}
          <div className="program-head">
          {/* Lot 37b (CHR-07, DAT-14 ; D8, D10) : clients et prestataires lisent la dernière version diffusée. */}
          {publication ? (
            <section aria-labelledby="program-publication-title" className="program-publication">
              <h3 id="program-publication-title">{t("programPublicationTitle")}</h3>
              {publication.latest ? (
                <p>
                  {t("programLatestVersion", {
                    number: publication.latest.number,
                    date: eventTime(publication.latest.publishedAt),
                    author: publisherOf(publication.latest.publishedByUserId),
                  })}
                </p>
              ) : (
                <p>{t("programNeverPublished")}</p>
              )}
              {publication.latest?.notifiedAt ? (
                <p>{t("programNotifiedLine", { number: publication.latest.number, date: eventTime(publication.latest.notifiedAt), count: publication.latest.notifiedCount ?? 0 })}</p>
              ) : publication.latest && !event.isDemo ? (
                programRecipients > 0 ? (
                  <ProgramNotifyForm eventId={event.id} number={publication.latest.number} recipients={programRecipients} />
                ) : (
                  <p className="muted">{t("programNotifyNoRecipients")}</p>
                )
              ) : null}
              {publication.latest ? (
                publication.canPublish ? (
                  <ul aria-label={t("programChangesTitle", { number: publication.latest.number })}>
                    {publication.changes.added.length > 0 ? <li>{t("programChangesAdded", { labels: quoted(publication.changes.added) })}</li> : null}
                    {publication.changes.changed.length > 0 ? <li>{t("programChangesChanged", { labels: quoted(publication.changes.changed) })}</li> : null}
                    {publication.changes.removed.length > 0 ? <li>{t("programChangesRemoved", { labels: quoted(publication.changes.removed) })}</li> : null}
                  </ul>
                ) : (
                  <p className="muted">{program.items.length === 0 ? t("programPublishEmpty") : t("programNoChanges")}</p>
                )
              ) : null}
              <ProgramPublishForm eventId={event.id} nextNumber={(publication.latest?.number ?? 0) + 1} canPublish={publication.canPublish} />
              {publication.versions.length > 0 ? (
                <details className="program-versions">
                  <summary>{t("programVersionsTitle", { count: publication.versions.length })}</summary>
                  <ul aria-label={t("programVersionsList")}>
                    {publication.versions.map((version) => (
                      <li key={version.number}>
                        {t("programVersionLine", { number: version.number, date: eventTime(version.publishedAt), author: publisherOf(version.publishedByUserId) })}
                        {" — "}
                        <a href={`/events/${event.id}/programme/pdf?version=${version.number}&apercu=1`} target="_blank" rel="noopener">
                          {t("programVersionPreview", { number: version.number })}
                        </a>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </section>
          ) : null}
          <div className="program-tools">
          <nav aria-label={t("programExports")} className="row-wrap">
            <a href={`/events/${event.id}/programme/pdf?variant=couple`} className="button-link" download>
              {t("programExportCouple")}
            </a>
            <a href={`/events/${event.id}/programme/pdf?variant=vendors`} className="button-link" download>
              {t("programExportVendors")}
            </a>
          </nav>
          {/* Lot 38b (HUB-29 ; D11) : le programme, séquence par séquence, dans l'agenda de la personne. */}
          {!event.isDemo ? (
            <section aria-labelledby="program-calendar-title" className="stack">
              <h3 id="program-calendar-title">{tCalendar("title")}</h3>
              <p className="meta">
                {programFeed ? tCalendar("programFollowed", { date: eventTime(programFeed.createdAt) }) : tCalendar("programAddHint")}
              </p>
              <CalendarAddressForm eventId={event.id} hasActive={programFeed !== null} quiet labels={{ create: tCalendar("programAdd"), renew: tCalendar("programRenew"), revoke: tCalendar("programRevoke"), form: tCalendar("programAdd") }} />
            </section>
          ) : null}
          </div>
          </div>
          {/* Lot 48a (PRE-06, D4) : contraintes du lieu, signalées, jamais bloquantes. */}
          {venueChecks ? <VenueFindings findings={venueChecks.findings} labels={programLabels} headingId="program-venue-title" /> : null}
          {program.overlaps.length > 0 ? (
            <section aria-labelledby="program-overlaps-title" className="notice notice-attention program-overlaps">
              <h3 id="program-overlaps-title">{t("programOverlapsTitle")}</h3>
              <ul>
                {/* Lot 67d (CHR-06 ; R09) : une ligne par intervenant, ses chevauchements à la suite. */}
                {[...new Set(program.overlaps.map((overlap) => overlap.participant))].map((participant) => (
                  <li key={participant}>
                    {t("programOverlapsOf", {
                      participant,
                      pairs: program.overlaps
                        .filter((overlap) => overlap.participant === participant)
                        .map((overlap) => t("programOverlapPair", { first: programLabels.get(overlap.itemIds[0]) ?? "", second: programLabels.get(overlap.itemIds[1]) ?? "" }))
                        .join(t("programOverlapPairSeparator")),
                    })}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <div className="program-sources">
            {programTemplates.length > 0 ? (
              <ApplyProgramTemplateForm eventId={event.id} templates={programTemplates} />
            ) : (
              <p>
                {t("noProgramTemplates")} <Link href="/events/modeles-programme">{t("programTemplatesLink")}</Link>
              </p>
            )}
            {/* Lot 51 (EVT-04, CHR-08) : un chrono importé d'un tableur, avec son écran de contrôle. */}
            {query.importer === "1" ? null : <ProgramImportForm eventId={event.id} open={false} />}
          </div>
          {program.items.length === 0 ? <p>{t("noProgramItems")}</p> : null}
          <datalist id="program-responsible-options">
            {responsibleOptions.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
          <datalist id="event-place-options">
            {placeOptions.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
          {/* Lot 62c (UX-13, UX-05 ; D1) : une ligne par séquence, « Modifier » ouvre la ligne en place, un seul « Enregistrer le programme ». */}
          <ProgramEditor eventId={event.id} title={t("programTitle")} groups={programGroups} vendorSlots={vendorSlots} moments={momentChoices} />
          <section aria-labelledby="places-title" className="places">
            <h3 id="places-title">{t("placesTitle")}</h3>
            <p className="muted">{t("placesHint")}</p>
            {places.length === 0 ? <p>{t("noPlaces")}</p> : null}
            <ul className="item-list">
              {places.map((place, index) => (
                <li key={place.id} className="stack">
                  <div className="row-wrap">
                    <strong>{place.label}</strong>
                    {/* Lot 34b (EVT-03, D10) : le premier lieu est le lieu de réception. */}
                    {index === 0 ? <span className="badge badge-sauge">{t("placeReception")}</span> : null}
                    {place.vendorId ? <span className="badge badge-sauge">{t("placeFromBook")}</span> : null}
                  </div>
                  {place.address || place.city ? <p className="muted">{[place.address, place.city].filter(Boolean).join(", ")}</p> : null}
                  {place.startTime ? <p className="muted">{place.endTime ? t("placeHours", { start: place.startTime, end: place.endTime }) : t("placeFrom", { start: place.startTime })}</p> : null}
                  {place.contactName || place.contactPhone || place.contactEmail ? (
                    <p className="muted">{t("placeContact", { contact: [place.contactName, place.contactPhone, place.contactEmail].filter(Boolean).join(" · ") })}</p>
                  ) : null}
                  <div className="row-wrap">
                    <EditPlaceForm eventId={event.id} place={place} />
                    {index > 0 ? (
                      <form action={makeReceptionPlaceAction} className="inline-form">
                        <input type="hidden" name="eventId" value={event.id} />
                        <input type="hidden" name="placeId" value={place.id} />
                        <button type="submit" className="button-ghost">
                          {t("makeReceptionPlace", { place: place.label })}
                        </button>
                      </form>
                    ) : null}
                    <form action={removePlaceAction} className="inline-form">
                      <input type="hidden" name="eventId" value={event.id} />
                      <input type="hidden" name="placeId" value={place.id} />
                      <button type="submit" className="button-ghost">{t("removePlace", { place: place.label })}</button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
            <AddPlaceForm eventId={event.id} suggestions={placeSuggestions} />
            {/* Lot 60 (L60-PLA-04) : le plan de salle de l'évènement, si le module est ouvert (ARC-07). */}
            {floorplans ? (
              <p>
                <Link href={`/events/${event.id}/plan-de-salle`}>{t("floorplanLink")}</Link>
              </p>
            ) : null}
          </section>
          <section aria-labelledby="day-contacts-title" className="places">
            <h3 id="day-contacts-title">{tDayContacts("title")}</h3>
            <p className="muted">{tDayContacts("intro")}</p>
            {dayContacts.length === 0 ? <p>{tDayContacts("empty")}</p> : null}
            <ul className="item-list">
              {dayContacts.map((contact) => (
                <li key={contact.id}>
                  <strong>{contact.name}</strong>
                  {[contact.role, contact.phone].filter(Boolean).map((part) => ` — ${part}`).join("")}
                  <form action={removeDayContactAction} className="inline-form">
                    <input type="hidden" name="eventId" value={event.id} />
                    <input type="hidden" name="contactId" value={contact.id} />
                    <button type="submit" className="button-ghost" aria-label={tDayContacts("removeLabel", { name: contact.name })}>
                      {tDayContacts("remove")}
                    </button>
                  </form>
                </li>
              ))}
            </ul>
            <AddDayContactForm eventId={event.id} />
          </section>
          {/* Lot 66b (JRJ-01 ; M18) : le rappel du jour J de cet évènement. */}
          <DayReminderCard organizationId={organizationId} eventId={event.id} />
        </section>
      ) : null}

      {tab === "devis" && quotesAvailable ? (
        <section className="card" aria-labelledby="event-quotes-title">
          <div className="section-head">
            <h2 id="event-quotes-title">{tQuotes("eventQuotesTitle")}</h2>
            <SettingsLink href="/devis/parametres" back="event" label={tQuotes("settingsTitle")} />
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
            {/* Lot 31a (FAC-01, HUB-21, D3) : un devis type part d'un modèle, ceux du type de l'événement d'abord. */}
            {quoteTemplates.length > 0 ? (
              <label>
                {tQuotes("fromTemplate")}
                <select name="templateId" defaultValue={quoteTemplates[0]?.eventTypeId === event.eventTypeId ? quoteTemplates[0]!.id : ""}>
                  <option value="">{tQuotes("noTemplate")}</option>
                  {quoteTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <button type="submit">{tQuotes("createQuote")}</button>
          </form>
          <p className="meta">
            <Link href="/devis/modeles">{tQuotes("templatesLink")}</Link>
          </p>
        </section>
      ) : null}

      {/* Lot 70e (A14) : la source et un client de plus, que « Nouvel évènement » ne demande plus. */}
      {tab === "maries" && !event.archivedAt ? (
        <section className="card" aria-labelledby="event-origin-title">
          <h2 id="event-origin-title">{t("originTitle")}</h2>
          <EventSourceForm eventId={event.id} sources={sources.map((candidate) => ({ id: candidate.id, label: candidate.label }))} current={event.prospectSourceId} />
          {event.clients.length < 2 ? (
            <AddClientForm
              eventId={event.id}
              labels={{
                firstName: clientFieldLabelsByAudience(locale)[eventTypes.find((type) => type.id === event.eventTypeId)?.audience ?? "couple"][event.clients.length === 0 ? "client1FirstName" : "client2FirstName"],
                lastName: clientFieldLabelsByAudience(locale)[eventTypes.find((type) => type.id === event.eventTypeId)?.audience ?? "couple"][event.clients.length === 0 ? "client1LastName" : "client2LastName"],
              }}
            />
          ) : null}
        </section>
      ) : null}

      {/* PRD-EVT-06 : accès des mariés. */}
      {tab === "maries" && event.clients.length > 0 ? (
        <section className="card" aria-labelledby="client-contact-title">
          <h2 id="client-contact-title">{t("clientContactTitle")}</h2>
          {/* Lot 62c (UX-12) : une personne par colonne, ses coordonnées en grille. */}
          <div className="client-contacts">
            {event.clients.map((client) => (
              <ClientContactForm key={client.id} eventId={event.id} client={client} />
            ))}
          </div>
        </section>
      ) : null}
      {/* Lot 26a (UX-11, POR-01, POR-10, SEC-14, SEC-15 ; ADR 0053) : liens personnels. */}
      {tab === "maries" ? (
        <section className="card" aria-labelledby="links-title">
          <h2 id="links-title">{t("linksTitle")}</h2>
          <p>{t("linksIntro")}</p>
          {links.length === 0 ? <p>{t("noLinks")}</p> : null}
          <ul aria-label={t("linksTitle")} className="item-list">
            {links.map((link) => {
              const sees = link.audience === "vendor" ? [t("linkSeesVendor", { vendor: vendorLabelOf(link.vendorCandidateId) })] : link.rights.rubrics.map((rubric) =>
                rubric === "budget" && link.rights.budgetScope === "selected"
                  ? t("linkBudgetSlots", { slots: link.rights.sharedSlotIds.map((slotId) => slotLabelById.get(slotId) ?? "").filter(Boolean).join(", ") })
                  : t(`linkRubric.${rubric}`),
              );
              return (
                <li key={link.id} className="link-row">
                  {/* Lot 62c (UX-13) : la personne et ce qu'elle voit à gauche, ses actions à droite, en libellés courts
                      (le nom reste dans le nom accessible). */}
                  <div className="link-main">
                  <p>
                    <strong>{link.personName}</strong> — {link.email} — {t(LINK_STATUS_KEYS[link.status])}
                    {link.status !== "revoked" ? ` — ${t("linkValidUntil", { date: formatCalendarDate(link.expiresOn, locale) })}` : ""}
                  </p>
                  <p className="muted">
                    {link.audience === "vendor" ? sees[0] : sees.length > 0 ? t("linkSees", { items: sees.join(", ") }) : t("linkSeesNothing")}
                    {link.otpRequired ? ` — ${t("linkOtpOn")}` : ""}
                    {link.audience === "client" && !link.taskReminders ? ` — ${t("linkRemindersOff")}` : ""}
                    {" — "}
                    {link.lastOpenedAt ? t("linkOpenedOn", { date: eventTime(link.lastOpenedAt) }) : t("linkNeverOpened")}
                  </p>
                  {link.renewalRequestedAt ? (
                    <p className="badge-warning">{t("linkRenewalRequested", { date: eventTime(link.renewalRequestedAt) })}</p>
                  ) : null}
                  </div>
                  {link.status !== "revoked" ? (
                    <div className="link-actions">
                      {/* Lot 27a (POR-09, D8) : ce que voit exactement cette personne. */}
                      <Link href={`/events/${event.id}/liens/${link.id}/apercu`} className="button-link">
                        {t("linkPreview", { name: link.personName })}
                      </Link>
                      {event.isDemo ? null : (
                      <>
                      <RenewLinkForm eventId={event.id} linkId={link.id} personName={link.personName} />
                      <details>
                        <summary>
                          {t("linkEditShort")}
                          <span className="sr-only">{t("linkOfName", { name: link.personName })}</span>
                        </summary>
                        <EditLinkForm
                          eventId={event.id}
                          link={{
                            id: link.id,
                            audience: link.audience,
                            otpRequired: link.otpRequired,
                            taskReminders: link.taskReminders,
                            personName: link.personName,
                            email: link.email,
                            eventClientId: link.eventClientId,
                            rubrics: link.rights.rubrics,
                            budgetScope: link.rights.budgetScope,
                            sharedSlotIds: link.rights.sharedSlotIds,
                            customExpiresOn: link.customExpiresOn,
                          }}
                          clients={linkClients}
                          slots={linkSlots}
                          guestsRubric={guests !== null}
                          floorplanRubric={floorplans}
                        />
                      </details>
                      <details>
                        <summary>
                          {t("linkRevokeShort")}
                          <span className="sr-only">{t("linkOfName", { name: link.personName })}</span>
                        </summary>
                        <form action={revokeLinkAction}>
                          <input type="hidden" name="eventId" value={event.id} />
                          <input type="hidden" name="linkId" value={link.id} />
                          <button type="submit" className="button-danger">
                            {t("revokeLinkConfirm", { name: link.personName })}
                          </button>
                        </form>
                      </details>
                      </>
                      )}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {/* Lot 62c (UX-12) : créer un lien, en grille ; le lien d'un prestataire, plus rare, s'ouvre à la demande. */}
          <div className="link-create">
          {event.isDemo ? (
            <p>{t("trialNoInvite")}</p>
          ) : (
            <CreateLinkForm
              eventId={event.id}
              clients={linkClients}
              slots={linkSlots}
              profiles={listLinkProfiles(locale === "en" ? "en" : "fr", await requestAudience(organizationId)).map((profile) => ({ key: profile.key, label: profile.label, budgetScope: profile.budgetScope }))}
            />
          )}
          {event.isDemo ? null : (
            <details className="disclosure-form">
              <summary>{t("createVendorLinkTitle")}</summary>
              <CreateVendorLinkForm eventId={event.id} vendors={linkVendors} />
            </details>
          )}
          </div>
        </section>
      ) : null}
      {/* Lot 27b (POR-03, BUD-07, EVT-09 ; D9, D10) : décisions demandées au client, lisibles des deux côtés. */}
      {tab === "maries" ? (
        <section className="card" aria-labelledby="decisions-title">
          <h2 id="decisions-title">{tDecisions("planTitle")}</h2>
          <p>{tDecisions("planIntro")}</p>
          {decisions.length === 0 ? <p>{tDecisions("noDecisions")}</p> : null}
          <ul aria-label={tDecisions("planTitle")} className="item-list">
            {decisions.map((decision) => {
              const label = decisionLabel(tDecisions, decision, locale);
              const chosen = decision.choiceId ? linkCandidates.find((candidate) => candidate.id === decision.choiceId) : undefined;
              return (
                <li key={decision.id} className="link-row">
                  <p>
                    <strong>{label}</strong>
                  </p>
                  <p className={decision.status === "pending" ? "badge-warning" : "muted"}>
                    {decision.status === "pending"
                      ? tDecisions("statusPending", { date: eventTime(decision.requestedAt) })
                      : decision.status === "withdrawn"
                        ? tDecisions("statusWithdrawn")
                        : answerSentence(tDecisions, decision, label, locale)}
                  </p>
                  {decision.comment ? <p className="muted">{tDecisions("answeredComment", { comment: decision.comment })}</p> : null}
                  {decision.programChanged ? <p className="badge-warning">{tDecisions("programChangedPlanner")}</p> : null}
                  {decision.replacesDecisionId && decisionById.has(decision.replacesDecisionId) ? <p className="meta">{tDecisions("replaces")}</p> : null}
                  {decision.replacedById ? <p className="meta">{tDecisions("replaced")}</p> : null}
                  {!event.isDemo ? (
                    <div className="link-actions">
                      {decision.status === "pending" ? (
                        <form action={withdrawDecisionAction}>
                          <input type="hidden" name="eventId" value={event.id} />
                          <input type="hidden" name="decisionId" value={decision.id} />
                          <button type="submit">{tDecisions("withdraw", { label })}</button>
                        </form>
                      ) : null}
                      {decision.status === "approved" && decision.kind === "option" && chosen && chosen.outcome !== "selected" ? (
                        <form action={retainDecisionChoiceAction}>
                          <input type="hidden" name="eventId" value={event.id} />
                          <input type="hidden" name="decisionId" value={decision.id} />
                          <button type="submit" className="primary">
                            {tDecisions("retainChoice", { vendor: choiceName(decision) ?? "" })}
                          </button>
                        </form>
                      ) : null}
                      {/* Lot 47 (D6 révisée) : le choix du client a retenu le prestataire ; la planner le
                          modifie à tout moment depuis l'écran du poste. */}
                      {decision.status === "approved" && decision.kind === "option" && decision.engagedAt && decision.slotId ? (
                        <Link href={`/events/${event.id}/consultation/${decision.slotId}`} className="button-link">
                          {tCoordination("retained.submit")}
                        </Link>
                      ) : null}
                      {decision.status === "approved" && decision.snapshot.kind === "expense" ? (
                        <form action={commitDecisionExpenseAction}>
                          <input type="hidden" name="eventId" value={event.id} />
                          <input type="hidden" name="decisionId" value={decision.id} />
                          <button type="submit">{tDecisions("commitExpense", { amount: formatAmount(decision.snapshot.amountCents, locale) })}</button>
                        </form>
                      ) : null}
                      {(decision.status === "approved" || decision.status === "declined") && !decision.replacedById ? (
                        <form action={replaceDecisionAction}>
                          <input type="hidden" name="eventId" value={event.id} />
                          <input type="hidden" name="decisionId" value={decision.id} />
                          <button type="submit">{tDecisions("replace", { label })}</button>
                        </form>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {/* Lot 62c (UX-12) : la demande s'ouvre à la demande ; la liste des décisions reste en vue. */}
          {event.isDemo ? null : (
            // Lot 63d (PRE-02, UX-13, #36) : la demande s'ouvre dans une fenêtre, sans quitter la liste.
            <EditDialog title={tDecisions("requestTitle")} trigger={{ label: tDecisions("requestTitle") }}>
              <RequestDecisionForm eventId={event.id} slots={decisionSlots} expenses={decisionExpenses} hasProgram={Boolean(publication?.latest)} />
            </EditDialog>
          )}
        </section>
      ) : null}

      {/* Lot 29b (JRJ-04, D8) ; lot 37a (DOC-01, DOC-04, POR-10) : l'espace documents de l'évènement. */}
      {tab === "documents" ? (
        <DocumentsTab eventId={event.id} organizationId={organizationId} locale={locale} documents={eventDocuments} embeddedDocumentIds={embeddedDocumentIds} dayOfOpen={isDayOfOpen(event)} />
      ) : null}

      {/* Lot 49 (INV-01 à INV-04, INV-07, RGP-06 à RGP-08) : l'onglet « Invités ». */}
      {tab === "invites" && guests ? (
        <GuestsTab
          access={guests}
          eventId={event.id}
          clients={event.clients.map((client) => ({ id: client.id, name: [client.firstName, client.lastName].filter(Boolean).join(" ") }))}
          locale={locale}
          query={{ cote: query.cote, groupe: query.groupe, sansReponse: query.sansReponse }}
          hrefFor={(extra) => (extra.onglet === "apercu" ? tabHref("apercu") : tabHref("invites", extra))}
        />
      ) : null}

      {/* Lot 39a (HUB-17, D4 ; ADR 0073) : supprimer l'évènement le met à la corbeille avec tout son contenu ; refusé s'il porte une pièce à conserver. */}
      {tab === "apercu" && !event.isDemo ? (
        <section className="card" aria-labelledby="delete-event-title">
          <h2 id="delete-event-title">{tTrash("deleteEvent")}</h2>
          {query.suppression === "refusee" ? <p role="alert">{tTrash("eventRefused")}</p> : query.suppression === "assistant" ? <p role="alert">{tTrash("eventAssistant")}</p> : <p>{tTrash("deleteEventHint")}</p>}
          <form action={deleteEventAction}>
            <input type="hidden" name="eventId" value={event.id} />
            <button type="submit" className="button-ghost">
              {tTrash("deleteEvent")}
            </button>
          </form>
        </section>
      ) : null}
      </div>
    </main>
  );
}
