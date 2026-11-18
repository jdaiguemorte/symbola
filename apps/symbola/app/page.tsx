import Link from "next/link";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import { formatDateTime, type Locale } from "@symbola/i18n";
import { organizationMailQuota } from "@symbola/mail";
import { appDatabase } from "@symbola/db/client";
import { getOrganizationProfile, getSetupState, isModuleEnabled, recentEmailVariableProblems, SETUP_STEPS } from "@/modules/hub/service";
import { listEventTasks } from "@/modules/events/service";
import { requireSignedIn } from "@/lib/guards";
import { recordUsage } from "@/lib/usage";
import { isActiveEvent, loadTodayItems } from "@/lib/today/load";
import { rankToday } from "@/lib/today/rank";
import { isValidId } from "./events/module-access";
import { PrivacyPurgeAlertBlock, PrivacyRequestsAlertBlock } from "./rgpd/dashboard-block";
import { PageTour } from "./page-tour";
import { loadPageTour } from "@/lib/help/page-tour";
import { longDate, MyEvents, TodayList, todayWords, UnavailableNotice } from "./accueil/today-view";
import { UndoTaskNotice } from "./accueil/today-client";
import { OnboardingChecklist } from "./accueil/onboarding-checklist";
import { loadOnboardingChecklist } from "@/lib/onboarding/checklist";

// Lot 32a (HUB-08, UX-01, UX-06 ; D3) — « Aujourd'hui » : ce qui demande une action, tous
// évènements confondus, trié par urgence, puis les évènements en cours. Les anciens blocs (agenda,
// tâches, encaissements, relances, alertes de liens et de règlements) passent dans la liste ;
// l'agenda passe à « Évènements ». Les alertes du titulaire et le plafond d'envois gardent leur
// bandeau en tête.
export default async function HomePage({ searchParams }: { searchParams: Promise<{ fait?: string; evenement?: string; visite?: string }> }) {
  const auth = await requireSignedIn();
  // Lot 13 (L13-HUB-17) : l'Admin arrive sur la console, pas sur un accueil vide.
  if (auth.user.role === "admin") redirect("/exploitation");
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
  const modules = {
    events: await isModuleEnabled(db, organizationId, "events"),
    quotes: await isModuleEnabled(db, organizationId, "quotes"),
    budget: await isModuleEnabled(db, organizationId, "budget"),
    // Lot 49 (RGP-08) : préavis de purge et oppositions des invités.
    guests: await isModuleEnabled(db, organizationId, "guests"),
    // Lot 46 (HUB-08) : les rendez-vous du jour.
    appointments: await isModuleEnabled(db, organizationId, "appointments"),
  };
  // Lot 33b (HUB-09, PAR-01) : le questionnaire d'accueil se reprend d'ici tant qu'il n'est pas
  // fini (Propriétaire), puis la liste de prise en main guide les premiers pas de l'équipe.
  const setup = await getSetupState(db, organizationId);
  const resumeQuestionnaire = auth.user.role === "owner" && !setup.completed;
  const checklist = await loadOnboardingChecklist(organizationId);
  const tOnboarding = await getTranslations("Onboarding");
  // ONB-01 : guide vers la fiche entreprise sans jamais bloquer l'entrée ; lot 33b (PAR-01, « à
  // éviter ») : seulement une fois le questionnaire fini et l'espace prêt, jamais avant.
  const onboardingIncomplete = setup.completed && (await getOrganizationProfile(db, organizationId)).completedAt === null;
  // Lot 24b (SEC-22, décision D5) : plafond d'e-mails de l'heure atteint.
  const mailQuota = await organizationMailQuota(organizationId);
  // Lot 38a (MSG-01, D5) : des rappels automatiques arrêtés par une variable sans valeur (24 heures).
  const mailProblems = modules.events ? await recentEmailVariableProblems(organizationId) : null;
  const tTemplates = await getTranslations("EmailTemplates");

  const now = new Date();
  const { items, today, events, unavailable } = await loadTodayItems(organizationId, modules, todayWords(t), locale, now);
  const ranked = rankToday(items, today);
  const activeEvents = events.filter((event) => isActiveEvent(event) && !event.isDemo).length;

  // D7 : la tâche cochée l'est déjà ; « Annuler » reste dix secondes. Seule une tâche faite de cet
  // évènement, dans l'organisation, s'annonce.
  let undone: { eventId: string; taskId: string; label: string } | null = null;
  if (modules.events && query.fait && query.evenement && isValidId(query.fait) && isValidId(query.evenement)) {
    const task = (await listEventTasks(organizationId, query.evenement)).find((candidate) => candidate.id === query.fait && candidate.done);
    if (task) undone = { eventId: query.evenement, taskId: task.id, label: task.label };
  }

  return (
    <main>
      <div className="page-header today-header">
        <h1>{t("title")}</h1>
        <p className="today-summary">{t("summary", { date: longDate(now, locale), events: activeEvents, points: ranked.attentionCount })}</p>
      </div>
      {resumeQuestionnaire ? (
        <p className="notice" role="status">
          {tOnboarding("resume", { count: SETUP_STEPS - setup.step + 1 })} <Link href="/demarrage">{tOnboarding("resumeLink")}</Link>
        </p>
      ) : null}
      {onboardingIncomplete ? (
        <p role="status">
          {tHome("onboardingIncomplete")} <Link href="/parametres">{tHome("completeProfile")}</Link>
        </p>
      ) : null}
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
      {undone ? (
        <UndoTaskNotice key={undone.taskId} eventId={undone.eventId} taskId={undone.taskId} message={t("undo.taskDone", { label: undone.label })} undoLabel={t("undo.action")} returnTo="home" />
      ) : null}
      <UnavailableNotice sources={unavailable} />
      <TodayList ranked={ranked} locale={locale} />
      {/* Lot 33b (PAR-01, étape 6) : après ce qui demande une action (UX-01 : la prochaine action d'abord). */}
      {checklist ? <OnboardingChecklist items={checklist} /> : null}
      {modules.events ? <MyEvents events={events} ranked={ranked} today={today} locale={locale} /> : null}
      <PageTour {...tour} helpTitle={tHelp("home.title")} helpBody={tHelp("home.body")} />
    </main>
  );
}
