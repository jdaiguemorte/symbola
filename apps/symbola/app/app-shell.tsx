// Structure d'écran commune (charte graphique, lot 7, ADR 0025) : menu
// latéral pour la planner et l'Admin (au-dessus du contenu sur téléphone),
// en-tête simple pour un marié, écran centré pour la connexion. Les liens
// du menu suivent les modules souscrits (dégradation propre, CLAUDE.md §2.3)
// et le rôle ; ce sont ceux qu'affichait l'accueil jusqu'ici.
import type { ReactNode } from "react";
import {
  Activity,
  Archive,
  Building2,
  HeartPulse,
  LayoutDashboard,
  SlidersHorizontal,
  UserCog,
  Users,
  BookUser,
  CalendarClock,
  CalendarDays,
  CalendarHeart,
  Contact,
  FileText,
  GraduationCap,
  LayoutGrid,
  LifeBuoy,
  ListChecks,
  Settings,
  ShieldCheck,
  Tags,
  ToggleRight,
  Wallet,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { parisToday } from "@symbola/i18n";
import { isMfaPromptDue, listOrganizations, mfaPromptDismissedAt } from "@symbola/auth";
import { accountCenterUrl } from "@/lib/identity";
import { MfaPromptBanner } from "./securite/mfa-prompt";
import { SubscriptionBanner } from "./subscription-banner";
import { appDatabase } from "@symbola/db/client";
import {
  getDocumentHeader,
  isFeatureEnabled,
  isModuleEnabled,
  listDueSoonPrivacyRequests,
} from "@/modules/hub/service";
import { overdueTaskCount } from "@/lib/task-counts";
import { getDocumentSettings } from "@/modules/quotes/service";
import { portalTheme, portalThemeCss } from "@/lib/portal/theme";
import { getAuthContext } from "@/lib/auth-context";
import { currentLinkAccess } from "@/lib/link-session";
import { AppNavLink } from "./app-nav-link";
import { AppSidebar } from "./app-sidebar";
import { LogoutButton } from "./logout-button";
import { OfflineGuard } from "./offline-guard";
import { SettingsNav, type SettingsGroup } from "./settings-nav";
import { settingsMenu } from "./settings-menu";
import { cookies, headers } from "next/headers";
import { HelpBar, type TutorialInvite } from "./help-bar";
import { AUTO_TOURS_COOKIE } from "@/lib/help/preferences";
import { SIDEBAR_COLLAPSED_COOKIE, isSidebarCollapsed } from "./sidebar-preference";
import { SearchBox } from "./search-box";
import { QuickCreate } from "./creation-rapide/quick-create";
import { HelpProvider } from "./help-context";
import { TutorialPanel, type TutorialSuggestion } from "./tutorial-panel";
import { loadTutorialPanel, type TutorialPanelState } from "@/lib/help/tutorial-panel";
import { journeyStates } from "@/lib/help/journey";
import { UndoNotice } from "./undo-notice";
import { NetworkStatus } from "./ui/network-status";
import { NavigationSkeleton } from "./ui/navigation-skeleton";
import { TaskUndoProvider } from "./taches/task-undo";
import { HelpButton } from "./help-button";
import { NotificationBell } from "./notification-bell";
import { OrganizationSwitcher } from "./organization-switcher";
import { getHelpProgress } from "@/modules/hub/service";
import { type HelpModule, TUTORIALS, tutorialHref } from "@/lib/help/catalog";

function Logo() {
  return (
    <svg width="32" height="32" viewBox="0 0 56 56" aria-hidden="true">
      <circle
        cx="28"
        cy="28"
        r="26"
        fill="none"
        className="stroke-primary"
        strokeWidth="3"
      />
      <circle
        cx="22"
        cy="28"
        r="11"
        fill="none"
        className="stroke-ink"
        strokeWidth="3"
      />
      <circle
        cx="34"
        cy="28"
        r="11"
        fill="none"
        className="stroke-primary"
        strokeWidth="3"
      />
    </svg>
  );
}

function Brand({ href, suffix }: { href: string; suffix?: string }) {
  return (
    <a href={href} className="app-brand">
      <Logo />
      <span className="app-brand-name">Symbola</span>
      {suffix ? <span className="app-brand-suffix">{suffix}</span> : null}
    </a>
  );
}

const iconProps = { size: 20, "aria-hidden": true as const, strokeWidth: 1.5 };

// Lot 26a (UX-11, ADR 0053) : pages d'un lien personnel (/lien, /portail et,
// lot 26b, /prestataire). Elles
// ont leur propre cadre, sans menu ni recherche ni compte : le logo de
// l'organisation du lien (servi par /portail/logo), sinon son nom.
// Lot 37a (DOC-04) : /partage, la page d'un lien de partage de document.
// Lot 46 (RDV-02, RDV-03) : page publique de réservation et lien de gestion d'un rendez-vous, sans menu.
const LINK_PAGE = /^\/(?:lien|portail|prestataire|partage|reserver|rdv)(?:\/|$)/;

// Lot 55 (POR-08, UX-14 ; D4) : aux couleurs de l'organisation du lien (celles de ses documents),
// contraste corrigé ; une feuille de style à nonce (la CSP refuse les styles en ligne).
async function LinkShell({ children }: { children: ReactNode }) {
  const access = await currentLinkAccess();
  const organization = access ? await getDocumentHeader(appDatabase(), access.organizationId) : null;
  const logoVersion = organization?.logoKey?.split("/").pop() ?? null;
  const theme = access ? portalTheme((await getDocumentSettings(access.organizationId)).color) : null;
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <div className={theme?.custom ? "link-shell link-shell-themed" : "link-shell"}>
      {theme ? <style nonce={nonce}>{portalThemeCss(theme)}</style> : null}
      <header className="link-header">
        {organization ? (
          logoVersion ? (
            <img className="client-organization-logo" src={`/portail/logo?v=${encodeURIComponent(logoVersion)}`} alt={organization.organizationName} />
          ) : (
            <p className="client-organization-name">{organization.organizationName}</p>
          )
        ) : (
          <span className="app-brand">
            <Logo />
            <span>Symbola</span>
          </span>
        )}
      </header>
      {children}
    </div>
  );
}

// Lot 29a (ARC-09, ADR 0064) : l'écran du jour J et la page « Hors ligne » ont un cadre
// sans menu, sans recherche ni compte : copiés sur l'appareil, ils doivent se lire sans
// réseau et ne rien garder d'autre que leur contenu.
const DAY_PAGE = /^\/(?:jour-j|hors-ligne)(?:\/|$)/;

function DayShell({ children }: { children: ReactNode }) {
  return (
    <div className="link-shell day-shell">
      <header className="link-header">
        <Brand href="/" />
      </header>
      {children}
    </div>
  );
}

// Lot 44 (CRM-01 ; D1, D2 ; ADR 0084) : le formulaire de contact public (/contact/<adresse>) et sa page
// encadrée, sans menu, sans recherche ni compte, même pour une personne connectée (aperçu des réglages) ;
// le nom de l'organisation est le titre de la page.
const CONTACT_PAGE = /^\/contact\/[^/]+(?:\/cadre)?\/?$/;

function ContactShell({ children, framed }: { children: ReactNode; framed: boolean }) {
  return <div className={framed ? "contact-shell contact-shell-framed" : "link-shell contact-shell"}>{children}</div>;
}

export async function AppShell({ children }: { children: ReactNode }) {
  const requestPath = (await headers()).get("x-pathname") ?? "";
  if (CONTACT_PAGE.test(requestPath)) return <ContactShell framed={requestPath.replace(/\/$/, "").endsWith("/cadre")}>{children}</ContactShell>;
  if (LINK_PAGE.test(requestPath)) return <LinkShell>{children}</LinkShell>;
  if (DAY_PAGE.test(requestPath)) return <DayShell>{children}</DayShell>;
  const auth = await getAuthContext();
  const t = await getTranslations("Home");
  const tAide = await getTranslations("Aide");
  const tLoading = await getTranslations("Loading");
  const tToday = await getTranslations("Today");
  // Lot 65f : libellés du menu, et son état réduit retenu sur l'appareil (lu ici : pas de clignotement).
  const sidebarProps = {
    menuLabel: t("menuOpen"),
    closeLabel: t("menuClose"),
    collapseLabel: t("menuCollapse"),
    expandLabel: t("menuExpand"),
    initialCollapsed: isSidebarCollapsed((await cookies()).get(SIDEBAR_COLLAPSED_COOKIE)?.value),
  };

  // Connexion, double authentification, invitation : pas de menu.
  if (auth.status !== "authenticated") {
    return (
      <div className="auth-shell">
        {/* Repère « bannière » : tout le contenu de l'écran reste dans un repère (axe-core). */}
        <header>
          <Brand href="/login" />
        </header>
        {children}
      </div>
    );
  }

  // Lot 29a (D4) : la déconnexion efface aussi les copies du jour J de l'appareil.
  const logout = (
    <>
      <LogoutButton label={t("logout")} />
      <OfflineGuard userId={auth.user.id} />
    </>
  );

  const organizationId = auth.user.organizationId;
  let events = false;
  let budget = false;
  let quotes = false;
  let vendors = false;
  // Lot 49 : module Invités (réglage de la liste des régimes, dans le groupe Évènements).
  let guests = false;
  let appointments = false;
  if (organizationId) {
    const db = appDatabase();
    events = await isModuleEnabled(db, organizationId, "events");
    budget = await isModuleEnabled(db, organizationId, "budget");
    quotes = await isModuleEnabled(db, organizationId, "quotes");
    vendors = await isModuleEnabled(db, organizationId, "vendors");
    guests = await isModuleEnabled(db, organizationId, "guests");
    appointments = await isModuleEnabled(db, organizationId, "appointments");
  }
  const isOwner = auth.user.role === "owner" && Boolean(organizationId);
  // Lot 54 (NFR-26, HUB-27) : l'abonnement en libre-service, derrière son interrupteur.
  const selfService = organizationId ? await isFeatureEnabled(appDatabase(), organizationId, "subscription_self_service") : false;
  // Lot 39c (HUB-12, D12) : les actions de la palette ⌘K, selon les modules souscrits.
  const tPalette = await getTranslations("Palette");
  const paletteActions = [
    ...(events ? [{ label: tPalette("actions.newEvent"), href: "/events/new" }, { label: tPalette("actions.tasks"), href: "/taches" }] : []),
    { label: tPalette("actions.contacts"), href: "/contacts?nouveau=1" },
    ...(appointments ? [{ label: tPalette("actions.appointments"), href: "/rendez-vous" }] : []),
    ...(vendors ? [{ label: tPalette("actions.newVendor"), href: "/prestataires/nouveau" }] : []),
    ...(quotes ? [{ label: tPalette("actions.quotes"), href: "/devis" }] : []),
    { label: tPalette("actions.today"), href: "/" },
    { label: tPalette("actions.settings"), href: "/parametres" },
    { label: tPalette("actions.trash"), href: "/parametres/corbeille" },
    { label: tPalette("actions.import"), href: "/import" },
    { label: tPalette("actions.help"), href: "/aide" },
  ];
  // Lot 18 (RGPD-07, décision D) : demandes RGPD en alerte (échéance proche ou
  // dépassée), signalées au menu ; la titulaire seule les traite.
  const privacyAlerts =
    isOwner && organizationId
      ? (await listDueSoonPrivacyRequests(appDatabase(), organizationId)).length
      : 0;
  // Lot 33b (PAR-01, D9) : le questionnaire d'accueil ne verrouille plus les menus ; l'accueil
  // propose de le reprendre tant qu'il n'est pas fini (lot 12 : il bloquait l'équipe).
  // Lot 10 (AIDE-07) — barre d'aide de l'équipe : tutoriels des modules
  // souscrits, terminés ou en cours.
  const isTeam =
    Boolean(organizationId) &&
    (auth.user.role === "owner" || auth.user.role === "member");
  let helpBar: {
    completed: number;
    total: number;
    tutorial: { title: string; href: string } | null;
    invites: TutorialInvite[];
    // Lot 63f (HUB-11 ; ADR 0104) : le tutoriel en cours dans son panneau latéral, les titres pour
    // « Tutoriel terminé » sur l'écran de départ, et le tutoriel conseillé ensuite.
    panel: TutorialPanelState | null;
    done: Record<string, string>;
    suggestion: TutorialSuggestion;
  } | null = null;
  if (isTeam) {
    const subscribed: Record<HelpModule, boolean> = {
      hub: true,
      events,
      budget,
      quotes,
      vendors,
      guests: guests && events,
      appointments,
      floorplans: false,
    };
    const available = TUTORIALS.filter(
      (tutorial) => subscribed[tutorial.module],
    );
    const db = appDatabase();
    const progress = await getHelpProgress(db, auth.user.id);
    const tHelpCenter = await getTranslations("HelpCenter");
    const inProgress = progress
      .filter(
        (entry) =>
          entry.status !== "completed" &&
          available.some(
            (tutorial) => `tutorial:${tutorial.key}` === entry.itemKey,
          ),
      )
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
    const inProgressKey = inProgress
      ? available.find(
          (tutorial) => `tutorial:${tutorial.key}` === inProgress.itemKey,
        )!.key
      : null;
    const states = journeyStates(available, progress);
    const suggested = available.find((tutorial) => states.get(tutorial.key) === "next");
    helpBar = {
      panel: await loadTutorialPanel(available, progress),
      done: Object.fromEntries(available.map((tutorial) => [tutorial.key, tHelpCenter(`items.${tutorial.key}.title`)])),
      suggestion: suggested ? { title: tHelpCenter(`items.${suggested.key}.title`), minutes: suggested.minutes, href: tutorialHref(suggested.key) } : null,
      completed: available.filter((tutorial) =>
        progress.some(
          (entry) =>
            entry.itemKey === `tutorial:${tutorial.key}` &&
            entry.status === "completed",
        ),
      ).length,
      total: available.length,
      tutorial: inProgressKey
        ? {
            title: tHelpCenter(`items.${inProgressKey}.title`),
            href: tutorialHref(inProgressKey),
          }
        : null,
      // Préférence « ouvrir automatiquement » (centre d'aide) : vaut aussi
      // pour ces invitations.
      invites:
        (await cookies()).get(AUTO_TOURS_COOKIE)?.value === "0"
          ? []
          : available
              .filter(
                (candidate) =>
                  !progress.some(
                    (entry) => entry.itemKey === `tutorial:${candidate.key}`,
                  ),
              )
              .map((candidate) => ({
                key: candidate.key,
                screen: candidate.screen,
                title: tHelpCenter(`items.${candidate.key}.title`),
                minutes: candidate.minutes,
                href: tutorialHref(candidate.key),
              })),
    };
  }
  const isAdmin = auth.user.role === "admin";
  // Pastille « en retard » du menu Tâches (PRD-HUB-02).
  // Lot 67b (HUB-08, CHR-10 ; R01) : les tâches hors évènement en retard comptent aussi, comme sur
  // « Aujourd'hui » et sur la page Tâches ; les deux lectures partent ensemble.
  const overdue = events && organizationId ? await overdueTaskCount(organizationId, parisToday()) : 0;

  // Paramètres : une pastille par solution souscrite (L11-HUB-12, lot 11).
  // Lot 13 (L13-HUB-16) : une rubrique par sujet, rangées en quatre groupes ;
  // seules apparaissent celles des modules souscrits.
  const tSettings = await getTranslations("SettingsMenu");
  // Lot 61 : la liste des rubriques vit dans settings-menu.ts (source unique, avec settings-paths.ts).
  const settingsSections: SettingsGroup[] = organizationId
    ? settingsMenu({ events, budget, quotes, vendors, guests, appointments, isOwner, selfService }).map((group) => ({
        label: tSettings(group.label),
        icon: group.icon,
        items: group.items.map((item) => ({
          href: item.href,
          label: tSettings(item.label),
          // Lot 18 : demandes RGPD en alerte, repère visuel sur « Données personnelles ».
          ...(item.href === "/rgpd" && privacyAlerts > 0 ? { count: privacyAlerts } : {}),
        })),
      }))
    : [];

  // Lot 52 (HUB-04 ; ADR 0094) — le Comptable : un menu réduit à ses écrans de lecture comptable.
  if (auth.user.role === "accountant") {
    const tAccounting = await getTranslations("Accounting");
    return (
      <div className="app-shell">
        <a className="skip-link" href="#contenu">
          {t("skipToContent")}
        </a>
        <AppSidebar brand={<Brand href="/comptable" />} {...sidebarProps}>
          <nav aria-label={tAccounting("menuLabel")}>
            <ul className="app-nav">
              <li>
                <AppNavLink href="/comptable" exact icon={<FileText {...iconProps} />} label={tAccounting("menu.documents")} />
              </li>
              {quotes ? (
                <>
                  <li>
                    <AppNavLink href="/devis/encaissements" icon={<Wallet {...iconProps} />} label={tAccounting("menu.payments")} />
                  </li>
                  <li>
                    <AppNavLink href="/devis/e-reporting" icon={<Activity {...iconProps} />} label={tAccounting("menu.eReporting")} />
                  </li>
                  {/* Lot 58 (FAC-11) : exports comptables, en lecture. */}
                  <li>
                    <AppNavLink href="/devis/exports-comptables" icon={<FileText {...iconProps} />} label={tAccounting("menu.exports")} />
                  </li>
                  <li>
                    <AppNavLink href="/devis/parametres/archive" icon={<BookUser {...iconProps} />} label={tAccounting("menu.ledger")} />
                  </li>
                </>
              ) : null}
            </ul>
            <ul className="app-nav app-nav-secondary">
              <li>
                <AppNavLink href="/securite" icon={<ShieldCheck {...iconProps} />} label={tAccounting("menu.sessions")} />
              </li>
              <li>
                <AppNavLink href="/profil" icon={<UserCog {...iconProps} />} label={tAccounting("menu.account")} />
              </li>
            </ul>
          </nav>
          <div className="app-user">
            <span className="app-user-email">{t("connectedAs", { email: auth.user.email })}</span>
            {logout}
          </div>
        </AppSidebar>
        <HelpProvider>
          <div className="app-main">
            <NetworkStatus />
            <NavigationSkeleton label={tLoading("label")} />
            <span id="contenu" className="skip-target" tabIndex={-1} />
            {children}
          </div>
        </HelpProvider>
      </div>
    );
  }

  // Lot 52 (SEC-02, D5) : la double authentification proposée à une Planner qui ne l'a pas.
  const showMfaPrompt = isMfaPromptDue({ role: auth.user.role, mfaEnabled: auth.user.mfaEnabled, dismissedAt: auth.user.role === "member" && !auth.user.mfaEnabled ? await mfaPromptDismissedAt(appDatabase(), auth.user.id) : null, now: new Date() });

  if (isAdmin) {
    // Lot 13 (L13-HUB-17, ADR 0033) — console d'Administration : son propre menu,
    // sombre ; aucune donnée métier des organisations (ADR 0029).
    const tAdmin = await getTranslations("AdminMenu");
    return (
      <div className="app-shell">
        {/* Lot 40c (NFR-17, WCAG 2.4.1) : passer le menu au clavier. */}
        <a className="skip-link" href="#contenu">
          {t("skipToContent")}
        </a>
        <AppSidebar
          brand={<Brand href="/exploitation" suffix={tAdmin("brand")} />}
          {...sidebarProps}
          admin
        >
          <nav aria-label={tAdmin("label")}>
            <ul className="app-nav">
              <li>
                <AppNavLink href="/exploitation" exact icon={<LayoutDashboard {...iconProps} />} label={tAdmin("overview")} />
              </li>
              <li>
                <AppNavLink href="/exploitation/organisations" icon={<Building2 {...iconProps} />} label={tAdmin("organizations")} />
              </li>
              <li>
                <AppNavLink href="/exploitation/comptes" icon={<Users {...iconProps} />} label={tAdmin("accounts")} />
              </li>
              <li>
                <AppNavLink href="/exploitation/prise-en-main" icon={<GraduationCap {...iconProps} />} label={tAdmin("onboarding")} />
              </li>
              <li>
                <AppNavLink href="/exploitation/activite" icon={<Activity {...iconProps} />} label={tAdmin("activity")} />
              </li>
              {/* Lot 54 (HUB-27, NFR-26) : catalogue des offres, interrupteurs par fonction. */}
              <li>
                <AppNavLink href="/exploitation/offres" icon={<Tags {...iconProps} />} label={tAdmin("plans")} />
              </li>
              <li>
                <AppNavLink href="/exploitation/interrupteurs" icon={<ToggleRight {...iconProps} />} label={tAdmin("featureFlags")} />
              </li>
              {/* Lot 35c (RGP-11) : trace des fermetures d'espaces, sans donnée personnelle. */}
              <li>
                <AppNavLink href="/exploitation/fermetures" icon={<Archive {...iconProps} />} label={tAdmin("closures")} />
              </li>
              <li>
                <AppNavLink href="/exploitation/health" icon={<HeartPulse {...iconProps} />} label={tAdmin("health")} />
              </li>
            </ul>
            <ul className="app-nav app-nav-secondary">
              <li>
                <AppNavLink href="/exploitation/parametres" icon={<SlidersHorizontal {...iconProps} />} label={tAdmin("settings")} />
              </li>
              <li>
                <AppNavLink href="/profil" icon={<UserCog {...iconProps} />} label={tAdmin("account")} />
              </li>
              <li>
                <AppNavLink href="/aide" icon={<LifeBuoy {...iconProps} />} label={tAide("link")} />
              </li>
            </ul>
          </nav>
          <div className="app-user">
            <span className="app-user-email">{t("connectedAs", { email: auth.user.email })}</span>
            {logout}
          </div>
        </AppSidebar>
        <HelpProvider>
          <div className="app-main">
            <section className="app-topbar" aria-label={t("topBar")}>
              <HelpButton />
            </section>
            {/* Lot 39b (NFR-16) : la coupure réseau est annoncée, la saisie gardée. */}
            <NetworkStatus />
            {/* Lot 39a (UX-07) : « Annuler » pendant dix secondes après une suppression. */}
            <UndoNotice />
            {/* Lot 39c (UX-15) : squelette d'écran au passage d'un écran à l'autre. */}
            <NavigationSkeleton label={tLoading("label")} />
            <span id="contenu" className="skip-target" tabIndex={-1} />
            {children}
          </div>
        </HelpProvider>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {/* Lot 40c (NFR-17, WCAG 2.4.1) : passer le menu au clavier. */}
      <a className="skip-link" href="#contenu">
        {t("skipToContent")}
      </a>
      <AppSidebar
        brand={<Brand href="/" />}
        {...sidebarProps}
      >
          <nav aria-label={t("navLabel")}>
            <ul className="app-nav">
              <li>
                <AppNavLink href="/" icon={<CalendarDays {...iconProps} />} label={t("agenda")} />
              </li>
              {events ? (
                <>
                  <li>
                    <AppNavLink href="/events" icon={<CalendarHeart {...iconProps} />} label={t("events")} />
                  </li>
                  <li>
                    <AppNavLink href="/taches" icon={<ListChecks {...iconProps} />} label={t("tasks")}>
                      {overdue > 0 ? (
                        <span className="nav-count nav-count-alert">
                          {t("tasksOverdue", { count: overdue })}
                        </span>
                      ) : null}
                    </AppNavLink>
                  </li>
                </>
              ) : null}
              {/* Lot 36a (CRM-03, ADR 0069) : les contacts, dans le noyau du hub, pour toute l'équipe. */}
              {organizationId ? (
                <li>
                  <AppNavLink href="/contacts" icon={<Contact {...iconProps} />} label={t("contacts")} />
                </li>
              ) : null}
              {/* Lot 46 (RDV-01 à RDV-04, ADR 0082) : les rendez-vous, juste après les contacts. */}
              {appointments ? (
                <li>
                  <AppNavLink href="/rendez-vous" except={["/rendez-vous/reglages", "/rendez-vous/disponibilites"]} icon={<CalendarClock {...iconProps} />} label={t("appointments")} />
                </li>
              ) : null}
              {vendors ? (
                <li>
                  <AppNavLink href="/prestataires" tour="nav-vendors" icon={<BookUser {...iconProps} />} label={t("vendorBook")} />
                </li>
              ) : null}
              {quotes ? (
                <>
                  <li>
                    <AppNavLink href="/devis" except={["/devis/encaissements"]} icon={<FileText {...iconProps} />} label={t("navQuotesGroup")} />
                  </li>
                  <li>
                    <AppNavLink href="/devis/encaissements" icon={<Wallet {...iconProps} />} label={t("quotePayments")} />
                  </li>
                </>
              ) : null}
            </ul>
            <ul className="app-nav app-nav-secondary">
              {/* Lot 63g (HUB-06, HUB-27, ARC-07 ; ADR 0108) : les apps du catalogue, activées ou non, pour
                  la Propriétaire ; le seul endroit qui nomme une app non activée. */}
              {isOwner ? (
                <li>
                  <AppNavLink href="/apps" icon={<LayoutGrid {...iconProps} />} label={t("apps")} />
                </li>
              ) : null}
              {organizationId ? (
                <li>
                  <AppNavLink href="/parametres" settings tour="nav-settings" icon={<Settings {...iconProps} />} label={t("settings")}>
                    {/* Repère visuel : le nom du lien reste « Paramètres » ; le détail est dans Données personnelles. */}
                    {privacyAlerts > 0 ? (
                      <span
                        className="nav-count nav-count-alert"
                        aria-hidden="true"
                        title={tSettings("privacyAlerts", {
                          count: privacyAlerts,
                        })}
                      >
                        {privacyAlerts}
                      </span>
                    ) : null}
                  </AppNavLink>
                </li>
              ) : null}
              {/* Lot 13 (AIDE-10) : les tutoriels ont leur page, avec leur compteur. */}
              {helpBar ? (
                <li>
                  <AppNavLink href="/tutoriels" icon={<GraduationCap {...iconProps} />} label={tAide("tutorialsLink")}>
                    {/* Repère visuel : le nom du lien reste « Tutoriels ». */}
                    <span
                      className="nav-count"
                      aria-hidden="true"
                      title={tAide("tutorialsCount", {
                        completed: helpBar.completed,
                        total: helpBar.total,
                      })}
                    >
                      {helpBar.completed}/{helpBar.total}
                    </span>
                  </AppNavLink>
                </li>
              ) : null}
              <li>
                <AppNavLink href="/aide" icon={<LifeBuoy {...iconProps} />} label={tAide("link")} />
              </li>
            </ul>
          </nav>
        <div className="app-user">
          <span className="app-user-email">{t("connectedAs", { email: auth.user.email })}</span>
          {/* Lot 33 (HUB-02, D6) : plusieurs organisations, et en créer une autre. */}
          {isTeam ? <OrganizationSwitcher organizations={await listOrganizations(appDatabase(), auth.user.id)} current={organizationId} /> : null}
          {logout}
        </div>
      </AppSidebar>
      <HelpProvider>
        <div className="app-main">
          {/* Lot 16 (L16-HUB-19, ADR 0039) : recherche à gauche, le seul « ? » à droite. */}
          <section className="app-topbar" aria-label={t("topBar")}>
            {isTeam ? <SearchBox actions={paletteActions} /> : null}
            {/* Lot 32b (HUB-07, D9) : création rapide, touche N ; ses entrées suivent les modules. */}
            {isTeam ? <QuickCreate modules={{ events, quotes, budget }} /> : null}
            {/* Lot 53 (HUB-15, UX-16) : la cloche des notifications, avant le « ? ». */}
            {isTeam && organizationId ? <NotificationBell organizationId={organizationId} userId={auth.user.id} /> : null}
            <HelpButton />
          </section>
          {settingsSections.length > 0 ? (
            <SettingsNav
              groups={settingsSections}
              label={t("settingsSections")}
            />
          ) : null}
          {/* L'invitation à un tutoriel s'affiche dans la page, plus en surimpression. */}
          {helpBar ? (
            <HelpBar tutorial={helpBar.tutorial} invites={helpBar.invites} />
          ) : null}
          {helpBar ? <TutorialPanel panel={helpBar.panel} done={helpBar.done} suggestion={helpBar.suggestion} /> : null}
          <NetworkStatus />
          {showMfaPrompt ? <MfaPromptBanner accountCenter={accountCenterUrl()} /> : null}
          {/* Lot 54 (HUB-27, DOC-06) : essai, lecture seule, résiliation, quota de stockage. */}
          {isTeam && organizationId && selfService ? <SubscriptionBanner organizationId={organizationId} isOwner={isOwner} /> : null}
          {/* Lot 39a (UX-07) : « Annuler » pendant dix secondes après une suppression. */}
          <UndoNotice />
          {/* Lot 39c (UX-15) : squelette d'écran au passage d'un écran à l'autre. */}
          <NavigationSkeleton label={tLoading("label")} />
          <span id="contenu" className="skip-target" tabIndex={-1} />
          {/* Lot 39c (UX-07) : « Annuler » pendant dix secondes après une tâche cochée dans un tableau. */}
          <TaskUndoProvider undoLabel={tToday("undo.action")}>{children}</TaskUndoProvider>
        </div>
      </HelpProvider>
    </div>
  );
}
