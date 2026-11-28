// Structure d'écran commune (charte graphique, lot 7, ADR 0025) : menu
// latéral pour la planner et l'Admin (au-dessus du contenu sur téléphone),
// en-tête simple pour un marié, écran centré pour la connexion. Les liens
// du menu suivent les modules souscrits (dégradation propre, CLAUDE.md §2.3)
// et le rôle ; ce sont ceux qu'affichait l'accueil jusqu'ici.
import { Suspense, type ReactNode } from "react";
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
  Database,
  LayoutGrid,
  LifeBuoy,
  ListChecks,
  Settings,
  ShieldCheck,
  Tags,
  ToggleRight,
  UserRound,
  Wallet,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { parisToday } from "@symbola/i18n";
import { getUserNames, isMfaPromptDue, listOrganizations, mfaPromptDismissedAt, personFullName, personInitials, personShortName } from "@symbola/auth";
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
import { phoneTabs, type PhoneEntry } from "./phone-tabs";
import { PhoneScreenTitle, PhoneTitleProvider, type PhoneScreen } from "./phone-screen-title";
import { NavigationOrigin } from "./navigation-origin";
import { LogoutButton } from "./logout-button";
import { OfflineGuard } from "./offline-guard";
import { SettingsNav, type SettingsGroup } from "./settings-nav";
import { CLOSURE_PATH, YOUR_DATA_PATH, settingsMenu, showsClosure, yourDataLines } from "./settings-menu";
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
import { FeedbackProvider } from "./ui/feedback";
import { NetworkStatus } from "./ui/network-status";
import { NavigationSkeleton } from "./ui/navigation-skeleton";
import { TaskUndoProvider } from "./taches/task-undo";
import { HelpButton } from "./help-button";
import { NotificationBell } from "./notification-bell";
import { OrganizationSwitcher } from "./organization-switcher";
import { AccountMenu } from "./account-menu";
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
    // Lot 71b (HUB-14, PAR-01) : « Reprendre un mariage en cours », par la recherche.
    ...(events ? [{ label: tPalette("actions.takeover"), href: "/reprise" }] : []),
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
  // Lot 70e (M7) : le compte quitte le bas du menu latéral pour la barre du haut (sous le prénom).
  const organizationsOfUser = isTeam ? await listOrganizations(appDatabase(), auth.user.id) : [];
  const accountPerson = isTeam ? { email: auth.user.email, ...(await getUserNames(appDatabase(), auth.user.id)) } : null;
  const tAccount = await getTranslations("Account");
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

  // Lot 74g (G1, G7) : le menu du groupe d'une rubrique ouverte, et « Vos données » comme un groupe ; la
  // liste des rubriques vit dans settings-menu.ts (source unique, avec settings-paths.ts).
  const tSettings = await getTranslations("SettingsMenu");
  const settingsFlags = { events, budget, quotes, vendors, guests, appointments, isOwner, selfService };
  const settingsSections: SettingsGroup[] = organizationId
    ? settingsMenu(settingsFlags).map((group) => ({
        key: group.key,
        label: tSettings(group.label),
        items: group.items.map((item) => ({ href: item.href, label: tSettings(item.label), paths: item.paths })),
      }))
    : [];
  const yourDataSection: SettingsGroup | null = organizationId
    ? {
        key: "data",
        label: tSettings("yourData"),
        ...(privacyAlerts > 0 ? { count: privacyAlerts } : {}),
        items: [
          ...yourDataLines(settingsFlags).flatMap((line) => [
            // Lot 18 : demandes RGPD en alerte, repère visuel sur leur ligne.
            { href: line.href, label: tSettings(line.label), ...(line.key === "privacy" && privacyAlerts > 0 ? { count: privacyAlerts } : {}) },
            ...line.secondary.map((other) => ({ href: other.href, label: tSettings(other.label) })),
          ]),
          ...(showsClosure(settingsFlags) ? [{ href: CLOSURE_PATH, label: tSettings("closureTitle") }] : []),
        ],
      }
    : null;
  // Le repère des demandes en alerte, sur « Vos données » (menu du compte, « Plus »).
  const privacyBadge =
    privacyAlerts > 0 ? (
      <span className="nav-count nav-count-alert" title={tSettings("privacyAlerts", { count: privacyAlerts })}>
        <span aria-hidden="true">{privacyAlerts}</span>
        <span className="sr-only">{tSettings("privacyAlerts", { count: privacyAlerts })}</span>
      </span>
    ) : null;

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
            {/* Lot 70b (UX-07, M5) : le message de retour unique, en bas à gauche du contenu. */}
            <FeedbackProvider>
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
            </FeedbackProvider>
          </div>
        </HelpProvider>
      </div>
    );
  }

  // Lot 70f (UX-05, ARC-06 ; D4, A17) : sur téléphone, la barre du bas (quatre entrées et « Plus ») ; une
  // entrée non souscrite laisse sa place à la première de « Plus » (phone-tabs.ts). Les entrées de la barre
  // ne se répètent pas dans « Plus » (`app-nav-tabbed`, masquées sur téléphone seulement).
  const phone = phoneTabs({ events, vendors, appointments, quotes });
  const tabbed = (entry: PhoneEntry) => (phone.tabs.includes(entry) ? "app-nav-tabbed" : undefined);
  const tabIcon = { size: 22, "aria-hidden": true as const, strokeWidth: 1.75 };
  const tabEntries: Record<PhoneEntry, { href: string; label: string; icon: ReactNode; except?: string[] }> = {
    today: { href: "/", label: t("agenda"), icon: <CalendarDays {...tabIcon} /> },
    events: { href: "/events", label: t("events"), icon: <CalendarHeart {...tabIcon} /> },
    tasks: { href: "/taches", label: t("tasks"), icon: <ListChecks {...tabIcon} /> },
    vendors: { href: "/prestataires", label: t("vendorBook"), icon: <BookUser {...tabIcon} /> },
    contacts: { href: "/contacts", label: t("contacts"), icon: <Contact {...tabIcon} /> },
    appointments: { href: "/rendez-vous", label: t("appointments"), icon: <CalendarClock {...tabIcon} />, except: ["/rendez-vous/reglages", "/rendez-vous/disponibilites"] },
    quotes: { href: "/devis", label: t("navQuotesGroup"), icon: <FileText {...tabIcon} />, except: ["/devis/encaissements"] },
    payments: { href: "/devis/encaissements", label: t("quotePayments"), icon: <Wallet {...tabIcon} /> },
  };
  const tabs = phone.tabs.map((entry) => {
    const item = tabEntries[entry];
    return (
      <li key={entry}>
        <AppNavLink href={item.href} icon={item.icon} label={item.label} {...(item.except ? { except: item.except } : {})}>
          {entry === "tasks" && overdue > 0 ? (
            <>
              <span className="app-tabbar-badge" aria-hidden="true">
                {overdue}
              </span>
              <span className="sr-only"> {t("tasksOverdue", { count: overdue })}</span>
            </>
          ) : null}
        </AppNavLink>
      </li>
    );
  });
  // Le nom de l'écran dans la barre du haut du téléphone : celui de son entrée du menu.
  const phoneScreens: PhoneScreen[] = [
    ...Object.values(tabEntries).map((item) => ({ href: item.href, label: item.label, ...(item.except ? { except: item.except } : {}) })),
    // Lot 74g : « Vos données » a son nom ; « Tous les modules » (/apps) est sous « Paramètres ».
    { href: YOUR_DATA_PATH, label: tSettings("yourData") },
    { href: "/parametres", label: t("settings"), settings: true },
    { href: "/tutoriels", label: tAide("tutorialsLink") },
    { href: "/aide", label: tAide("link") },
    { href: "/profil", label: tAccount("profile") },
  ];
  const currentOrganizationName = organizationsOfUser.find((organization) => organization.organizationId === organizationId)?.name ?? "";
  // Le compte, en bas de « Plus » : « Camille · Atelier Roussel » (Mon compte), changer d'organisation
  // (replié), puis à part « Se déconnecter », en encre.
  const phoneAccount =
    isTeam && accountPerson ? (
      <>
        <ul className="app-nav app-sheet-identity">
          <li>
            <AppNavLink href="/profil" icon={<UserRound {...iconProps} />} label={currentOrganizationName ? tAccount("phoneIdentity", { name: personShortName(accountPerson), organization: currentOrganizationName }) : personShortName(accountPerson)} />
          </li>
          {/* Lot 74g (G5) : « Vos données », avec le repère des demandes en alerte. */}
          {organizationId ? (
            <li>
              <AppNavLink href={YOUR_DATA_PATH} icon={<Database {...iconProps} />} label={tSettings("yourData")}>
                {privacyBadge}
              </AppNavLink>
            </li>
          ) : null}
          {/* Lot 74g (G11) : « Tous les modules », pour la titulaire, comme dans le menu du compte. */}
          {isOwner ? (
            <li>
              <AppNavLink href="/apps" icon={<LayoutGrid {...iconProps} />} label={tSettings("allModules")} />
            </li>
          ) : null}
        </ul>
        <details className="app-sheet-switch">
          <summary>
            <span>{tAccount("switch")}</span>
            <span className="meta">{tAccount("switchHint")}</span>
          </summary>
          <OrganizationSwitcher organizations={organizationsOfUser} current={organizationId} />
        </details>
        <div className="app-sheet-logout">
          <LogoutButton label={t("logout")} menu />
        </div>
      </>
    ) : null;

  return (
    <div className="app-shell has-tabbar">
      {/* Lot 40c (NFR-17, WCAG 2.4.1) : passer le menu au clavier. */}
      <a className="skip-link" href="#contenu">
        {t("skipToContent")}
      </a>
      <AppSidebar
        brand={<Brand href="/" />}
        {...sidebarProps}
        tabs={tabs}
        tabsLabel={t("tabBarLabel")}
        moreLabel={t("more")}
        account={phoneAccount}
      >
          <nav aria-label={t("navLabel")} className="app-nav-main">
            <ul className="app-nav">
              <li className={tabbed("today")}>
                <AppNavLink href="/" icon={<CalendarDays {...iconProps} />} label={t("agenda")} />
              </li>
              {events ? (
                <>
                  <li className={tabbed("events")}>
                    <AppNavLink href="/events" icon={<CalendarHeart {...iconProps} />} label={t("events")} />
                  </li>
                  <li className={tabbed("tasks")}>
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
                <li className={tabbed("contacts")}>
                  <AppNavLink href="/contacts" icon={<Contact {...iconProps} />} label={t("contacts")} />
                </li>
              ) : null}
              {/* Lot 46 (RDV-01 à RDV-04, ADR 0082) : les rendez-vous, juste après les contacts. */}
              {appointments ? (
                <li className={tabbed("appointments")}>
                  <AppNavLink href="/rendez-vous" except={["/rendez-vous/reglages", "/rendez-vous/disponibilites"]} icon={<CalendarClock {...iconProps} />} label={t("appointments")} />
                </li>
              ) : null}
              {vendors ? (
                <li className={tabbed("vendors")}>
                  <AppNavLink href="/prestataires" tour="nav-vendors" icon={<BookUser {...iconProps} />} label={t("vendorBook")} />
                </li>
              ) : null}
              {quotes ? (
                <>
                  <li className={tabbed("quotes")}>
                    <AppNavLink href="/devis" except={["/devis/encaissements"]} icon={<FileText {...iconProps} />} label={t("navQuotesGroup")} />
                  </li>
                  <li className={tabbed("payments")}>
                    <AppNavLink href="/devis/encaissements" icon={<Wallet {...iconProps} />} label={t("quotePayments")} />
                  </li>
                </>
              ) : null}
            </ul>
            {/* Lot 74g (G11) : « Paramètres » et « Aide » tenus en bas ; la liste des modules défile seule si
                besoin. « Tous les modules » est dans « Abonnement et modules » et le menu du compte, « Tutoriels »
                dans « Aide », le repère des demandes en alerte sur « Vos données ». */}
            <ul className="app-nav app-nav-secondary app-nav-footer">
              {organizationId ? (
                <li>
                  <AppNavLink href="/parametres" settings tour="nav-settings" icon={<Settings {...iconProps} />} label={t("settings")} />
                </li>
              ) : null}
              <li>
                <AppNavLink href="/aide" icon={<LifeBuoy {...iconProps} />} label={tAide("link")} />
              </li>
            </ul>
          </nav>
        {/* Lot 70e (M7) : le bloc du compte est dans la barre du haut ; sans équipe, il reste ici. */}
        {isTeam ? (
          <OfflineGuard userId={auth.user.id} />
        ) : (
          <div className="app-user">
            <span className="app-user-email">{t("connectedAs", { email: auth.user.email })}</span>
            {logout}
          </div>
        )}
      </AppSidebar>
      <HelpProvider>
        <div className="app-main">
          {/* Lot 70b (UX-07, M5) : le message de retour unique, en bas à gauche du contenu ; le fournisseur
              n'ajoute aucun élément : la zone du message est le dernier enfant de « app-main ». */}
          <FeedbackProvider>
            {/* Lot 72d (P-12) : l'écran d'avant, pour le « ← » d'une fiche ; une fiche remplace le nom de
                l'écran de la barre du haut du téléphone par « ← » et son nom. */}
            <Suspense fallback={null}>
              <NavigationOrigin />
            </Suspense>
            <PhoneTitleProvider>
            {/* Lot 16 (L16-HUB-19, ADR 0039) : recherche à gauche, le seul « ? » à droite. */}
            <section className="app-topbar" aria-label={t("topBar")}>
              {/* Lot 70f : sur téléphone, le nom de l'écran ouvre la barre de 60 px. */}
              <PhoneScreenTitle screens={phoneScreens} />
              {isTeam ? <SearchBox actions={paletteActions} /> : null}
              {/* Lot 32b (HUB-07, D9) : création rapide, touche N ; ses entrées suivent les modules. */}
              {isTeam ? <QuickCreate modules={{ events, quotes, budget, vendors }} /> : null}
              {/* Lot 53 (HUB-15, UX-16) : la cloche des notifications, avant le « ? ». */}
              {isTeam && organizationId ? <NotificationBell organizationId={organizationId} userId={auth.user.id} /> : null}
              <HelpButton />
              {isTeam && accountPerson ? (
                <AccountMenu
                  initials={personInitials(accountPerson)}
                  shortName={personShortName(accountPerson)}
                  fullName={personFullName(accountPerson)}
                  email={auth.user.email}
                  organization={organizationsOfUser.length > 1 ? (organizationsOfUser.find((organization) => organization.organizationId === organizationId)?.name ?? null) : null}
                  context={tAccount("organizationRole", {
                    organization: organizationsOfUser.find((organization) => organization.organizationId === organizationId)?.name ?? "",
                    role: tAccount(auth.user.role === "owner" ? "role.owner" : "role.member"),
                  })}
                  labels={{ menu: tAccount("menu"), profile: tAccount("profile"), profileHint: tAccount("profileHint"), switch: tAccount("switch"), switchHint: tAccount("switchHint") }}
                  // Lot 74g (G5, G11) : « Vos données » (avec le repère des demandes en alerte) et, pour la
                  // titulaire, « Tous les modules ».
                  links={[
                    ...(organizationId ? [{ href: YOUR_DATA_PATH, label: tSettings("yourData"), hint: tSettings("yourDataMenuHint"), badge: privacyBadge }] : []),
                    ...(isOwner ? [{ href: "/apps", label: tSettings("allModules"), hint: tSettings("allModulesHint") }] : []),
                  ]}
                  switcher={<OrganizationSwitcher organizations={organizationsOfUser} current={organizationId} />}
                  logout={<LogoutButton label={t("logout")} menu />}
                />
              ) : null}
            </section>
            {settingsSections.length > 0 ? (
              <SettingsNav
                groups={settingsSections}
                data={yourDataSection}
                labels={{ nav: t("settingsSections"), all: tSettings("allSettings"), others: tSettings("otherGroups"), back: tSettings("back"), groupMenu: tSettings("groupMenu", { group: "{group}" }) }}
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
            </PhoneTitleProvider>
          </FeedbackProvider>
        </div>
      </HelpProvider>
    </div>
  );
}
