import Link from "next/link";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import { parisToday, type Locale } from "@symbola/i18n";
import type { TourStep } from "@symbola/ui";
import { createAppConnection } from "@symbola/db/client";
import { hasRealEvents } from "@/modules/events/service";
import { getGreeting } from "@/modules/hello/service";
import { getOrganizationProfile, hasSeenTour, isModuleEnabled } from "@/modules/hub/service";
import { getAuthContext } from "@/lib/auth-context";
import { recordUsage } from "@/lib/usage";
import { UpcomingPaymentsBlock } from "./devis/encaissements/dashboard-block";
import { PrivacyPurgeAlertBlock, PrivacyRequestsAlertBlock } from "./rgpd/dashboard-block";
import { HomeInteractive } from "./home-interactive";
import { AgendaBlock } from "./agenda/agenda-block";
import { UpcomingTasksBlock } from "./taches/upcoming-tasks-block";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ agenda?: string; debut?: string }> }) {
  const auth = await getAuthContext();

  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/mfa");
  // EVT-06 : un marié n'a pas de hub, seulement l'espace de son mariage.
  if (auth.user.role === "client") redirect("/espace");

  // SOC-13, ADR 0016 : collecte brute des compteurs d'usage, au niveau de
  // cette page plutôt que dans lib/auth-context.ts (voir le commentaire
  // de ce fichier — importer next/server y cassait le flux de connexion).
  // after() planifie l'écriture après l'envoi de la réponse.
  if (auth.user.organizationId) {
    const organizationId = auth.user.organizationId;
    after(() => recordUsage(organizationId));
  }

  // Dégradation propre (CLAUDE.md §2.3) : un module désactivé par l'Admin
  // n'affiche jamais d'erreur, juste « indisponible ». L'Admin (pas
  // d'organisation) n'a pas de module à vérifier.
  let helloAvailable = true;
  let eventsAvailable = false;
  let quotesAvailable = false;
  if (auth.user.organizationId) {
    const organizationId = auth.user.organizationId;
    const { sql, db } = createAppConnection();
    try {
      helloAvailable = await isModuleEnabled(db, organizationId, "hello");
      eventsAvailable = await isModuleEnabled(db, organizationId, "events");
      quotesAvailable = await isModuleEnabled(db, organizationId, "quotes");
    } finally {
      await sql.end();
    }
  }
  // AIDE-04 : « créer son premier événement » ; un événement d'essai
  // (AIDE-02) ne compte jamais au tableau de bord.
  const firstEventCreated =
    eventsAvailable && auth.user.organizationId ? await hasRealEvents(auth.user.organizationId) : false;
  const greeting = helloAvailable ? getGreeting() : null;
  const t = await getTranslations("Home");

  // ONB-01 : guide vers le questionnaire sans jamais bloquer l'entrée
  // dans la plateforme (PRD : l'info manquante est demandée au moment
  // de l'action, pas ici).
  let onboardingIncomplete = false;
  if (auth.user.organizationId) {
    const organizationId = auth.user.organizationId;
    const { sql, db } = createAppConnection();
    try {
      const profile = await getOrganizationProfile(db, organizationId);
      onboardingIncomplete = profile.completedAt === null;
    } finally {
      await sql.end();
    }
  }

  // AIDE-01 : la visite ne s'affiche automatiquement qu'à la première
  // ouverture du hub ; AIDE-04 : la liste « premiers pas » n'a de sens que
  // pour un utilisateur d'une organisation (l'Admin n'en a pas).
  const { sql: tourSql, db: tourDb } = createAppConnection();
  let tourInitiallyOpen: boolean;
  try {
    tourInitiallyOpen = !(await hasSeenTour(tourDb, auth.user.id, "hub"));
  } finally {
    await tourSql.end();
  }
  const tTour = await getTranslations("Tour");
  const tHelp = await getTranslations("Help");
  const tFirstSteps = await getTranslations("FirstSteps");
  const tourSteps = tTour.raw("hub") as TourStep[];
  const locale = (await getLocale()) as Locale;
  const today = parisToday();
  const query = await searchParams;
  const organizationId = auth.user.organizationId;

  return (
    <main>
      <div className="page-header">
        <div>
          <p className="eyebrow">{greeting ? greeting.message : t("moduleUnavailable")}</p>
          <h1>{t("welcome")}</h1>
        </div>
      </div>
      {onboardingIncomplete ? (
        <p role="status">
          {t("onboardingIncomplete")} <Link href="/parametres">{t("completeProfile")}</Link>
        </p>
      ) : null}
      {/* RGPD-04 : demandes dont l'échéance approche, titulaire seulement. */}
      {auth.user.role === "owner" && auth.user.organizationId ? <PrivacyRequestsAlertBlock organizationId={auth.user.organizationId} /> : null}
      {auth.user.role === "owner" && auth.user.organizationId ? <PrivacyPurgeAlertBlock organizationId={auth.user.organizationId} /> : null}
      {/* HUB-02 : agenda des mois à venir et tâches de la quinzaine (module Événements). */}
      {eventsAvailable && organizationId ? <AgendaBlock organizationId={organizationId} locale={locale} today={today} query={query} /> : null}
      <div className="home-columns">
        {eventsAvailable && organizationId ? <UpcomingTasksBlock organizationId={organizationId} locale={locale} today={today} /> : null}
        {/* HUB-02 / DEV-03 : absent si le module Devis n'est pas souscrit. */}
        {quotesAvailable && organizationId ? <UpcomingPaymentsBlock organizationId={organizationId} /> : null}
      </div>
      <HomeInteractive
        tourInitiallyOpen={tourInitiallyOpen}
        tourSteps={tourSteps}
        tourSkipLabel={tTour("skip")}
        tourNextLabel={tTour("next")}
        tourFinishLabel={tTour("finish")}
        helpTitle={tHelp("home.title")}
        helpBody={tHelp("home.body")}
        relaunchTourLabel={tHelp("relaunchTour")}
        firstStepsVisible={Boolean(auth.user.organizationId) && !auth.user.firstStepsHidden}
        firstStepsTitle={tFirstSteps("title")}
        firstStepsItems={[
          { key: "completeProfile", label: tFirstSteps("completeProfile"), done: !onboardingIncomplete },
          ...(eventsAvailable
            ? [{ key: "createFirstEvent", label: tFirstSteps("createFirstEvent"), done: firstEventCreated }]
            : []),
        ]}
        firstStepsHideLabel={tFirstSteps("hide")}
      />
    </main>
  );
}
