import Link from "next/link";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import { parisToday, type Locale } from "@symbola/i18n";
import { appDatabase } from "@symbola/db/client";
import { getOrganizationProfile, isModuleEnabled } from "@/modules/hub/service";
import { requireSignedIn } from "@/lib/guards";
import { recordUsage } from "@/lib/usage";
import { UpcomingPaymentsBlock } from "./devis/encaissements/dashboard-block";
import { PrivacyPurgeAlertBlock, PrivacyRequestsAlertBlock } from "./rgpd/dashboard-block";
import { PageTour } from "./page-tour";
import { loadPageTour } from "@/lib/help/page-tour";
import { AgendaBlock } from "./agenda/agenda-block";
import { UpcomingTasksBlock } from "./taches/upcoming-tasks-block";
import { FollowUpBlock } from "./accueil/follow-up-block";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ agenda?: string; debut?: string; visite?: string }> }) {
  const auth = await requireSignedIn();
  // EVT-06 : un marié n'a pas de hub, seulement l'espace de son mariage.
  if (auth.user.role === "client") redirect("/espace");
  // Lot 13 (HUB-17) : l'Admin arrive sur la console, pas sur un agenda vide.
  if (auth.user.role === "admin") redirect("/admin");

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
  let eventsAvailable = false;
  let quotesAvailable = false;
  if (auth.user.organizationId) {
    const organizationId = auth.user.organizationId;
    const db = appDatabase();
    eventsAvailable = await isModuleEnabled(db, organizationId, "events");
    quotesAvailable = await isModuleEnabled(db, organizationId, "quotes");
  }
  const t = await getTranslations("Home");

  // ONB-01 : guide vers le questionnaire sans jamais bloquer l'entrée
  // dans la plateforme (PRD : l'info manquante est demandée au moment
  // de l'action, pas ici).
  let onboardingIncomplete = false;
  if (auth.user.organizationId) {
    const organizationId = auth.user.organizationId;
    const db = appDatabase();
    const profile = await getOrganizationProfile(db, organizationId);
    onboardingIncomplete = profile.completedAt === null;
  }

  // AIDE-01 : la visite ne s'affiche automatiquement qu'à la première
  // ouverture du hub. Lot 13 (HUB-15) : plus de liste « premiers pas »,
  // l'assistant de démarrage (lot 12) s'en charge.
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) as Locale;
  const today = parisToday();
  const query = await searchParams;
  const tour = await loadPageTour(auth.user.id, "hub", query.visite);
  const organizationId = auth.user.organizationId;

  return (
    <main>
      <div className="page-header">
        <h1>{t("welcome")}</h1>
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
      {/* Lot 20 (décision 4) : blocs empilés, en-tête commun, trois lignes ;
          un bloc qui a du retard passe en premier (data-urgent). */}
      <div className="home-blocks">
        {/* HUB-15 : devis à relancer et prospects sans nouvelle. */}
        {(eventsAvailable || quotesAvailable) && organizationId ? <FollowUpBlock organizationId={organizationId} modules={{ events: eventsAvailable, quotes: quotesAvailable }} /> : null}
        {eventsAvailable && organizationId ? <UpcomingTasksBlock organizationId={organizationId} locale={locale} today={today} /> : null}
        {/* HUB-02 / DEV-03 : absent si le module Devis n'est pas souscrit. */}
        {quotesAvailable && organizationId ? <UpcomingPaymentsBlock organizationId={organizationId} /> : null}
      </div>
      <PageTour {...tour} helpTitle={tHelp("home.title")} helpBody={tHelp("home.body")} />
    </main>
  );
}
