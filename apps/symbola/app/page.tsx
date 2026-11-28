import Link from "next/link";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import { formatDateTime, parisToday, type Locale } from "@symbola/i18n";
import { TODAY_HORIZON_DAYS } from "@symbola/contracts";
import { organizationMailQuota } from "@symbola/mail";
import { appDatabase } from "@symbola/db/client";
import { getOrganizationProfile, getSetupState, isModuleEnabled, recentEmailVariableProblems } from "@/modules/hub/service";
import { getTaskSoonDays, listAgencyOverview, listEventLeads, listEventTasks, listEvents, listOrganizationTasks, listStandaloneTasks } from "@/modules/events/service";
import { buildTaskLines } from "@/lib/tasks/task-lines";
import { taskMemberOptions } from "@/lib/tasks/members";
import { TaskPanelLoader } from "./ui/task-panel-loader";
import { requireSignedIn } from "@/lib/guards";
import { taskListViewer, visibleEventScope, withinScope } from "@/lib/event-visibility";
import { agencyView, HOME_SCOPE_COOKIE, HOME_SCOPE_WORDS, homeScope, meEvents } from "@/lib/today/agency";
import { meScope } from "@/lib/today/scope";
import { AgencyView } from "./accueil/agency-view";
import { RememberHomeScope } from "./accueil/agency-client";
import { recordUsage } from "@/lib/usage";
import { isActiveEvent, loadTodayItems } from "@/lib/today/load";
import { rankToday } from "@/lib/today/rank";
import { isValidId } from "./events/module-access";
import { PrivacyPurgeAlertBlock, PrivacyRequestsAlertBlock } from "./rgpd/dashboard-block";
import { PageTour } from "./page-tour";
import { loadPageTour } from "@/lib/help/page-tour";
import { todayWords, UnavailableNotice } from "./accueil/today-view";
import { TakeoversInProgress } from "./accueil/takeovers-in-progress";
import { EmptyHome, FirstStepsView, MyEventsView, TodayCardView, TodayHeader } from "./accueil/home-view";
import { UndoTaskNotice } from "./accueil/today-client";
import { TodayScrollKeeper } from "./accueil/today-card-client";
import { NamesPrompt } from "./accueil/names-prompt";
import { SetupNotReadyLine } from "./accueil/setup-line";
import { resumedThisSession } from "@/lib/onboarding/resume";
import { loadOnboardingChecklist } from "@/lib/onboarding/checklist";
import { firstStepsLine } from "@/lib/onboarding/first-steps";
import { homeState, todayCard } from "@/lib/today/home";
import { onboardingSuggestsTakeover } from "@symbola/starter-templates";
import { TodayCalendar } from "./accueil/today-calendar";
import { isCalendarView, isMonthKey, isWeekKey, mondayOf, type CalendarView } from "@/lib/today/calendar";
import { ensureTaskCategories } from "@/lib/events/task-categories";

// Lot 32a (HUB-08, UX-01, UX-06 ; D3) — « Aujourd'hui » : ce qui demande une action, tous
// évènements confondus, trié par urgence, puis les évènements en cours. Les anciens blocs (agenda,
// tâches, encaissements, relances, alertes de liens et de règlements) passent dans la liste ;
// l'agenda passe à « Évènements ». Les alertes du titulaire et le plafond d'envois gardent leur
// bandeau en tête.
export default async function HomePage({ searchParams }: { searchParams: Promise<{ fait?: string; evenement?: string; visite?: string; mois?: string; vue?: string; semaine?: string; tache?: string; tout?: string; planner?: string; "a-jour"?: string; personnes?: string }> }) {
  const auth = await requireSignedIn();
  // Lot 13 (L13-HUB-17) : l'Admin arrive sur la console, pas sur un accueil vide.
  if (auth.user.role === "admin") redirect("/exploitation");
  // Lot 52 : le Comptable a son accueil de lecture comptable.
  if (auth.user.role === "accountant") redirect("/comptable");
  const organizationId = auth.user.organizationId;

  // SOC-13, ADR 0016 : collecte brute des compteurs d'usage, au niveau de cette page plutôt que
  // dans lib/auth-context.ts (importer next/server y cassait le flux de connexion). after()
  // planifie l'écriture après l'envoi de la réponse.
  if (organizationId) after(() => recordUsage(organizationId));

  const t = await getTranslations("Today");
  const tHome = await getTranslations("Home");
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) as Locale;
  const query = await searchParams;
  const tour = await loadPageTour(auth.user.id, "hub", query.visite);

  if (!organizationId) {
    return (
      <main>
        <h1>{t("title")}</h1>
      </main>
    );
  }

  // Dégradation propre (ARC-06) : un module non souscrit n'apporte rien à la liste.
  const db = appDatabase();
  // NFR-02 : les lectures indépendantes de l'accueil partent ensemble.
  const [eventsEnabled, quotes, budget, guests, appointments, vendors, setup, checklist, mailQuota] = await Promise.all([
    isModuleEnabled(db, organizationId, "events"),
    isModuleEnabled(db, organizationId, "quotes"),
    isModuleEnabled(db, organizationId, "budget"),
    // Lot 49 (RGP-08) : préavis de purge et oppositions des invités.
    isModuleEnabled(db, organizationId, "guests"),
    // Lot 46 (HUB-08) : les rendez-vous du jour.
    isModuleEnabled(db, organizationId, "appointments"),
    // Lot 48a (PRE-05, PRE-10) : pièces et IBAN des prestataires.
    isModuleEnabled(db, organizationId, "vendors"),
    // Lot 33b (HUB-09, PAR-01) : le questionnaire d'accueil se reprend d'ici tant qu'il n'est pas
    // fini (Propriétaire), puis la liste de prise en main guide les premiers pas de l'équipe.
    getSetupState(db, organizationId),
    loadOnboardingChecklist(organizationId),
    // Lot 24b (SEC-22, décision D5) : plafond d'e-mails de l'heure atteint.
    organizationMailQuota(organizationId),
  ]);
  const modules = { events: eventsEnabled, quotes, budget, guests, appointments, vendors };
  const resumeQuestionnaire = auth.user.role === "owner" && !setup.completed;
  // Lot 74a (HUB-09, PAR-01 ; C-68 ; critères 1 et 2) : l'assistant d'abord. Pas encore commencé, la titulaire y
  // est menée à chaque fois ; commencé, une fois par session (puis la ligne « pas tout à fait prêt »).
  if (resumeQuestionnaire && (setup.step === 1 || !(await resumedThisSession()))) redirect(setup.step === 1 ? "/demarrage" : "/demarrage/reprendre");
  // Lot 72b (C-18) : le bandeau « fiche entreprise » quitte le haut de l'accueil ; l'étape est dans « Pour bien
  // démarrer ». Le profil dit aussi quelle voie l'état vide propose d'abord (R3, I5 du lot 71).
  const profile = await getOrganizationProfile(db, organizationId);
  // Lot 38a (MSG-01, D5) : des rappels automatiques arrêtés par une variable sans valeur (24 heures).
  const mailProblems = modules.events ? await recentEmailVariableProblems(organizationId) : null;
  const tTemplates = await getTranslations("EmailTemplates");
  const tRisk = await getTranslations("RiskRadar");

  // Lot 72b (C-18) : seules les alertes qui bloquent un envoi ou une obligation passent avant la liste (puis
  // « Votre espace n'est pas tout à fait prêt » (lot 74a), le message de retour et « Une partie des urgences ne répond pas ») ; lot 72c :
  // dans les deux vues de la bascule.
  const blockingAlerts = (
    <>
      {mailQuota?.reached && mailQuota.resumesAt ? (
        <p className="notice" role="alert">
          {tHome("mailQuotaReached", { sent: mailQuota.sent, cap: mailQuota.cap, time: formatDateTime(mailQuota.resumesAt, locale) })}
        </p>
      ) : null}
      {mailProblems ? (
        <p className="notice" role="alert">
          {tTemplates("todayBanner", { count: mailProblems.events, template: tTemplates(`kinds.${mailProblems.kind}.title`) })}{" "}
          <Link href={`/parametres/emails/${mailProblems.kind}?langue=${mailProblems.locale}`}>{tTemplates("todayBannerLink")}</Link>
        </p>
      ) : null}
      {/* RGPD-04 : demandes dont l'échéance approche et purges annoncées, titulaire seulement. */}
      {auth.user.role === "owner" ? <PrivacyRequestsAlertBlock organizationId={organizationId} /> : null}
      {auth.user.role === "owner" ? <PrivacyPurgeAlertBlock organizationId={organizationId} /> : null}
      {resumeQuestionnaire ? <SetupNotReadyLine organizationId={organizationId} step={setup.step} /> : null}
      {/* Lot 70a (A1) : le prénom, pour que l'équipe reconnaisse la personne. */}
      <NamesPrompt userId={auth.user.id} />
    </>
  );

  // Lot 72c (PAR-10, HUB-03 ; J4) : « Moi · L'agence » n'existe que dans une agence (plus d'un membre actif),
  // décidé ici, côté serveur : `?vue=agence` sur l'espace d'une personne rend la vue « Moi », sans erreur.
  const members = modules.events ? await taskMemberOptions(organizationId, auth.user.id) : [];
  const activeMembers = members.filter((member) => !member.removed).length;
  const choice = homeScope({ vue: query.vue, cookie: (await cookies()).get(HOME_SCOPE_COOKIE)?.value, activeMembers });
  const remember = choice.remember ? <RememberHomeScope cookie={HOME_SCOPE_COOKIE} value={HOME_SCOPE_WORDS[choice.remember]} /> : null;
  // Lot 52 (EVT-06, D2) : seulement les évènements visibles de la personne (réglage de visibilité).
  const viewerAuth = { user: { id: auth.user.id, role: auth.user.role, organizationId } };
  const scope = auth.user.role === "member" ? await visibleEventScope(viewerAuth) : null;

  if (choice.scope === "agency") {
    // La vue d'agence ne lit que ses comptes groupés et la liste des évènements : ni les sources de l'accueil,
    // ni le calendrier. Ce que la personne ne voit pas (lot 52, A20) n'y entre jamais, ni ligne ni nombre.
    const agencyNow = new Date();
    const agencyToday = parisToday(agencyNow);
    const [overview, listed] = await Promise.all([
      taskListViewer(viewerAuth).then((viewer) => listAgencyOverview({ organizationId, viewer, today: agencyToday, horizonDays: TODAY_HORIZON_DAYS })),
      listEvents({ organizationId, archived: "exclude" }),
    ]);
    const visible = withinScope(scope, listed, (event) => event.id);
    // Un espace sans évènement garde son état vide et sa seule action (72b) : pas de vue d'agence.
    if (homeState({ eventsEnabled: true, events: visible, points: 0 }).kind !== "empty") {
      const agencyEvents = visible.filter((event) => isActiveEvent(event) && !event.isDemo);
      const leads = await listEventLeads(organizationId, agencyEvents.map((event) => event.id));
      const view = agencyView({ overview, members, events: agencyEvents, leads, plannerFilter: query.planner ?? null, showUpToDate: query["a-jour"] === "1" });
      return (
        <main data-state="agency">
          <TodayHeader now={agencyNow} locale={locale} activeEvents={agencyEvents.length} ranked={rankToday([], agencyToday)} state={{ kind: "filled" }} scope="agency" agency={{ late: view.late, events: view.lateEvents }} />
          {blockingAlerts}
          <AgencyView view={view} locale={locale} today={agencyToday} allPeople={query.personnes === "toutes"} />
          {remember}
          <PageTour {...tour} helpTitle={tHelp("home.title")} helpBody={tHelp("home.body")} />
        </main>
      );
    }
  }

  const now = new Date();
  const loaded = await loadTodayItems(organizationId, modules, {
      ...todayWords(t),
      emailToSend: (kind) => t("words.emailToSend", { kind: tTemplates(`kinds.${kind}.title`) }),
      // Lot 72a (HUB-08, GC-02 ; critère 6) : le radar devient des lignes « À regarder », filtrées par la
      // visibilité comme les autres (la section « Risques » à part n'existe plus).
      watch: (alert) => ({ title: tRisk(`rules.${alert.rule}.label`), detail: tRisk(`rules.${alert.rule}.alert`, { ...alert.facts, threshold: alert.thresholdDays }) }),
    }, locale, now);
  const { today, unavailable } = loaded;
  // Lot 72c (HUB-08, J3) : dans une agence, « Moi » garde ce dont la personne s'occupe (portée du lot 72a) :
  // ses tâches, les lignes des évènements dont elle est planner principale ou sans planner principal.
  const visibleEvents = withinScope(scope, loaded.events, (event) => event.id);
  const meInput = { userId: auth.user.id, activeMembers, leads: choice.toggle ? await listEventLeads(organizationId, visibleEvents.map((event) => event.id)) : new Map<string, string>() };
  const items = meScope(withinScope(scope, loaded.items, (item) => item.eventId), meInput);
  const events = meEvents(visibleEvents, meInput, items);
  const ranked = rankToday(items, today);
  const activeEvents = events.filter((event) => isActiveEvent(event) && !event.isDemo).length;
  // Lot 63d : le calendrier vit des évènements, des rendez-vous ou du budget ; sans aucun, il n'apparaît pas.
  const showCalendar = modules.events || modules.budget || modules.appointments;
  const calendarMonth = isMonthKey(query.mois) ? query.mois : today.slice(0, 7);
  // Lot 65c (M15) : la vue du calendrier et la semaine montrée.
  const calendarView: CalendarView = isCalendarView(query.vue) ? query.vue : "mois";
  const calendarWeek = isWeekKey(query.semaine) ? query.semaine : mondayOf(today);
  const calendarHref = ({ view, month, week }: { view: CalendarView; month: string; week: string }) => {
    const params = new URLSearchParams();
    if (view !== "mois") params.set("vue", view);
    if (view === "semaine") {
      if (week !== mondayOf(today)) params.set("semaine", week);
    } else if (month !== today.slice(0, 7)) params.set("mois", month);
    const search = params.toString();
    return search ? `/?${search}#calendrier` : "/#calendrier";
  };
  const taskCategories = modules.events ? await ensureTaskCategories(organizationId, locale) : [];

  // D7 : la tâche cochée l'est déjà ; « Annuler » reste dix secondes. Seule une tâche faite de cet
  // évènement, dans l'organisation, s'annonce.
  let undone: { eventId: string; taskId: string; label: string } | null = null;
  if (modules.events && query.fait && query.evenement && isValidId(query.fait) && isValidId(query.evenement)) {
    const task = (await listEventTasks(organizationId, query.evenement)).find((candidate) => candidate.id === query.fait && candidate.done);
    if (task) undone = { eventId: query.evenement, taskId: task.id, label: task.label };
  }

  // Lot 70c (CHR-02, HUB-08 ; D1, D3, M4) : la ligne type des tâches (le titre ouvre le panneau sur
  // « Aujourd'hui »), et « N tâches faites aujourd'hui · Les revoir ».
  const taskSources = ranked.all.flatMap((item) => (item.task ? [item.task] : []));
  const taskLines =
    modules.events && taskSources.length > 0
      ? Object.fromEntries(
          (await buildTaskLines({ organizationId, locale, tasks: taskSources, members, href: (task) => (query.tout === "1" ? `/?tout=1&tache=${task.id}` : `/?tache=${task.id}`) })).lines.map((line) => [line.id, line]),
        )
      : {};
  const parisDay = (instant: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(instant));
  const doneToday = modules.events
    ? withinScope(scope, await listOrganizationTasks({ organizationId, today, horizonDays: null, includeDone: true }), (task) => task.eventId).filter((task) => task.doneAt && parisDay(task.doneAt) === today).length +
      (await listStandaloneTasks(organizationId, { includeDone: true })).filter((task) => task.doneAt && parisDay(task.doneAt) === today).length
    : 0;
  const openTask = modules.events && query.tache && isValidId(query.tache) ? query.tache : null;

  // Lot 72b (HUB-08, UX-01 ; § 5.2) : l'état de l'accueil, la carte entière (les sept lignes et le reste), la
  // ligne « Pour bien démarrer » de la personne.
  const state = homeState({ eventsEnabled: modules.events, events, points: ranked.points });
  const card = todayCard(ranked, { quotes: modules.quotes, events: modules.events });
  const firstSteps = firstStepsLine(checklist, auth.user.firstStepsHidden);
  const soonDays = modules.events ? await getTaskSoonDays(organizationId) : 7;
  // « Tout afficher » ouvert, ou une tâche du reste ouverte depuis la carte allongée : la carte reste entière
  // derrière le panneau, et « Fermer » la rend telle quelle (critère 3).
  const expanded = query.tout === "1" || (openTask !== null && card.parts.some((part) => part.lines.some((line) => line.rest && line.item.task?.id === openTask)));
  const closeHref = expanded ? "/?tout=1" : "/";
  return (
    <main data-state={state.kind}>
      <TodayHeader now={now} locale={locale} activeEvents={state.kind === "empty" ? null : activeEvents} ranked={ranked} state={state} scope={choice.toggle && state.kind !== "empty" ? "me" : null} />
      {blockingAlerts}
      {state.kind === "empty" ? null : remember}
      {undone ? (
        <UndoTaskNotice key={undone.taskId} eventId={undone.eventId} taskId={undone.taskId} message={t("undo.taskDone", { label: undone.label })} undoLabel={t("undo.action")} returnTo="home" />
      ) : null}
      <UnavailableNotice sources={unavailable} />
      {/* Lot 71f (HUB-08 ; maquette 09) : les reprises en cours, entre les alertes et « À traiter en premier », hors du compteur des points (C-20). */}
      {modules.events ? <TakeoversInProgress organizationId={organizationId} viewer={await taskListViewer(viewerAuth)} locale={locale} today={today} /> : null}
      {state.kind === "empty" ? (
        <>
          <EmptyHome takeoverFirst={onboardingSuggestsTakeover(profile.replacedTools)} />
          {firstSteps && checklist ? <FirstStepsView line={firstSteps} items={checklist} listed /> : null}
        </>
      ) : (
        <>
          <TodayCardView
            card={card}
            ranked={ranked}
            locale={locale}
            today={today}
            soonDays={soonDays}
            taskLines={taskLines}
            doneToday={doneToday}
            expanded={expanded}
            quiet={state.kind === "quiet" ? { eventId: state.withoutTasks[0]! } : null}
          />
          {modules.events ? <MyEventsView events={events} ranked={ranked} today={today} locale={locale} /> : null}
          {showCalendar ? (
            <div id="calendrier">
              <TodayCalendar
                organizationId={organizationId}
                modules={{ events: modules.events, budget: modules.budget, appointments: modules.appointments }}
                month={calendarMonth}
                today={today}
                locale={locale}
                scope={scope}
                categories={taskCategories}
                view={calendarView}
                week={calendarWeek}
                href={calendarHref}
              />
            </div>
          ) : null}
          {firstSteps && checklist ? <FirstStepsView line={firstSteps} items={checklist} listed={false} /> : null}
        </>
      )}
      {openTask ? (
        <TaskPanelLoader
          organizationId={organizationId}
          userId={auth.user.id}
          role={auth.user.role}
          locale={locale}
          today={today}
          open={{ kind: "edit", taskId: openTask }}
          closeHref={closeHref}
          backLabel={t("title")}
          screenHref={(params) => `/taches?${new URLSearchParams(params).toString()}`}
        />
      ) : null}
      {state.kind === "empty" ? null : <TodayScrollKeeper panelOpen={openTask !== null} />}
      <PageTour {...tour} helpTitle={tHelp("home.title")} helpBody={tHelp("home.body")} />
    </main>
  );
}
