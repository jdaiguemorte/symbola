// Structure d'écran commune (charte graphique, lot 7, ADR 0025) : menu
// latéral pour la planner et l'Admin (au-dessus du contenu sur téléphone),
// en-tête simple pour un marié, écran centré pour la connexion. Les liens
// du menu suivent les modules souscrits (dégradation propre, CLAUDE.md §2.3)
// et le rôle ; ce sont ceux qu'affichait l'accueil jusqu'ici.
import type { ReactNode } from "react";
import {
  Activity,
  Building2,
  HeartPulse,
  LayoutDashboard,
  SlidersHorizontal,
  UserCog,
  Users,
  BookUser,
  CalendarDays,
  CalendarHeart,
  FileText,
  GraduationCap,
  LifeBuoy,
  ListChecks,
  Settings,
  Wallet,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { parisToday } from "@symbola/i18n";
import { appDatabase } from "@symbola/db/client";
import {
  getDocumentHeader,
  getSetupState,
  isModuleEnabled,
  listDueSoonPrivacyRequests,
} from "@/modules/hub/service";
import { listOrganizationTasks } from "@/modules/events/service";
import { getAuthContext } from "@/lib/auth-context";
import { AppNavLink } from "./app-nav-link";
import { AppSidebar } from "./app-sidebar";
import { logoutAction } from "./logout-action";
import { SettingsNav, type SettingsGroup } from "./settings-nav";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { Lock, Rocket } from "lucide-react";
import { HelpBar, type TutorialInvite } from "./help-bar";
import { AUTO_TOURS_COOKIE } from "@/lib/help/preferences";
import { SearchBox } from "./search-box";
import { HelpProvider } from "./help-context";
import { HelpButton } from "./help-button";
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
      <span>Symbola</span>
      {suffix ? <span className="app-brand-suffix">{suffix}</span> : null}
    </a>
  );
}

const iconProps = { size: 20, "aria-hidden": true as const, strokeWidth: 1.5 };

export async function AppShell({ children }: { children: ReactNode }) {
  const auth = await getAuthContext();
  const t = await getTranslations("Home");
  const tAide = await getTranslations("Aide");

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

  const logout = (
    <form action={logoutAction}>
      <button type="submit">{t("logout")}</button>
    </form>
  );

  // Un marié n'a que l'espace de son mariage (PRD-EVT-06).
  if (auth.user.role === "client") {
    // Lot 17 (DEV-08, décision G) : le logo de l'organisation, sinon son nom ;
    // l'image est servie par /logo après contrôle de la session.
    const organization = auth.user.organizationId
      ? await getDocumentHeader(appDatabase(), auth.user.organizationId)
      : null;
    const logoVersion = organization?.logoKey?.split("/").pop() ?? null;
    return (
      <div className="app-shell">
        <header className="app-sidebar">
          <Brand href="/espace" />
          {organization ? (
            <div className="client-organization">
              {logoVersion ? (
                <img
                  className="client-organization-logo"
                  src={`/logo?v=${encodeURIComponent(logoVersion)}`}
                  alt={organization.organizationName}
                />
              ) : (
                <p className="client-organization-name">
                  {organization.organizationName}
                </p>
              )}
            </div>
          ) : null}
          <div className="app-user">
            <span>{t("connectedAs", { email: auth.user.email })}</span>
            {logout}
          </div>
        </header>
        {/* Lot 16 (L16-HUB-19, ADR 0039) : le « ? » au même endroit sur tous les écrans. */}
        <HelpProvider>
          <div className="app-main">
            <section className="app-topbar" aria-label={t("topBar")}>
              <HelpButton />
            </section>
            {children}
          </div>
        </HelpProvider>
      </div>
    );
  }

  const organizationId = auth.user.organizationId;
  let events = false;
  let budget = false;
  let quotes = false;
  let vendors = false;
  if (organizationId) {
    const db = appDatabase();
    events = await isModuleEnabled(db, organizationId, "events");
    budget = await isModuleEnabled(db, organizationId, "budget");
    quotes = await isModuleEnabled(db, organizationId, "quotes");
    vendors = await isModuleEnabled(db, organizationId, "vendors");
  }
  const isOwner = auth.user.role === "owner" && Boolean(organizationId);
  // Lot 18 (RGPD-07, décision D) : demandes RGPD en alerte (échéance proche ou
  // dépassée), signalées au menu ; la titulaire seule les traite.
  const privacyAlerts =
    isOwner && organizationId
      ? (await listDueSoonPrivacyRequests(appDatabase(), organizationId)).length
      : 0;
  // Lot 12 (ONB-03) — assistant de démarrage bloquant : tant qu'il n'est pas
  // terminé, l'équipe n'a que l'assistant (et l'aide, le profil).
  const teamMember =
    Boolean(organizationId) &&
    (auth.user.role === "owner" || auth.user.role === "member");
  let setupDone = true;
  if (teamMember && organizationId) {
    const db = appDatabase();
    setupDone = (await getSetupState(db, organizationId)).completed;
    const pathname = (await headers()).get("x-pathname") ?? "/";
    const allowed = ["/demarrage", "/aide", "/profil"].some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );
    if (!setupDone && !allowed) redirect("/demarrage");
  }
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
  } | null = null;
  if (isTeam) {
    const subscribed: Record<HelpModule, boolean> = {
      hub: true,
      events,
      budget,
      quotes,
      vendors,
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
    helpBar = {
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
  const overdue =
    events && organizationId
      ? (
          await listOrganizationTasks({
            organizationId,
            today: parisToday(),
            horizonDays: 0,
          })
        ).filter((task) => task.overdue).length
      : 0;

  // Paramètres : une pastille par solution souscrite (L11-HUB-12, lot 11).
  // Lot 13 (L13-HUB-16) : une rubrique par sujet, rangées en quatre groupes ;
  // seules apparaissent celles des modules souscrits.
  const tSettings = await getTranslations("SettingsMenu");
  const settingsSections: SettingsGroup[] = organizationId
    ? [
        {
          label: tSettings("groupCompany"),
          icon: "company" as const,
          items: [
            { href: "/parametres", label: tSettings("company") },
            { href: "/profil", label: tSettings("account") },
          ],
        },
        ...(events || budget
          ? [
              {
                label: tSettings("groupEvents"),
                icon: "events" as const,
                items: [
                  ...(events
                    ? [
                        {
                          href: "/events/parametres",
                          label: tSettings("budgetLines"),
                        },
                        {
                          href: "/events/parametres/sources",
                          label: tSettings("sourcesReasons"),
                        },
                        {
                          href: "/events/parametres/types",
                          label: tSettings("eventTypes"),
                        },
                        {
                          href: "/events/modeles",
                          label: tSettings("retroplanning"),
                        },
                        {
                          href: "/events/modeles-programme",
                          label: tSettings("program"),
                        },
                      ]
                    : []),
                  ...(budget
                    ? [
                        {
                          href: "/budget/parametres",
                          label: tSettings("allocation"),
                        },
                      ]
                    : []),
                  {
                    href: "/parametres/relances",
                    label: tSettings("followUp"),
                  },
                ],
              },
            ]
          : []),
        ...(quotes
          ? [
              {
                label: tSettings("groupSales"),
                icon: "sales" as const,
                items: [
                  { href: "/devis/catalogue", label: tSettings("catalog") },
                  { href: "/devis/parametres", label: tSettings("quotes") },
                  {
                    href: "/devis/parametres/documents",
                    label: tSettings("documents"),
                  },
                  {
                    href: "/devis/e-reporting",
                    label: tSettings("eReporting"),
                  },
                ],
              },
            ]
          : []),
        {
          label: tSettings("groupData"),
          icon: "data" as const,
          items: [
            ...(vendors
              ? [
                  {
                    href: "/prestataires/parametres",
                    label: tSettings("vendorTypes"),
                  },
                  {
                    href: "/prestataires/parametres/etiquettes",
                    label: tSettings("vendorTags"),
                  },
                  {
                    href: "/prestataires/parametres/trajet",
                    label: tSettings("vendorTravel"),
                  },
                ]
              : []),
            ...(events || budget || quotes
              ? [{ href: "/import", label: tSettings("import") }]
              : []),
            ...(isOwner
              ? [
                  {
                    href: "/rgpd",
                    label: tSettings("privacy"),
                    ...(privacyAlerts > 0 ? { count: privacyAlerts } : {}),
                  },
                ]
              : []),
          ],
        },
      ].filter((group) => group.items.length > 0)
    : [];

  if (isAdmin) {
    // Lot 13 (L13-HUB-17, ADR 0033) — console d'Administration : son propre menu,
    // sombre ; aucune donnée métier des organisations (ADR 0029).
    const tAdmin = await getTranslations("AdminMenu");
    return (
      <div className="app-shell">
        <AppSidebar
          brand={<Brand href="/admin" suffix={tAdmin("brand")} />}
          menuLabel={t("menuOpen")}
          closeLabel={t("menuClose")}
          admin
        >
          <nav aria-label={tAdmin("label")}>
            <ul className="app-nav">
              <li>
                <AppNavLink href="/admin" exact>
                  <LayoutDashboard {...iconProps} />
                  {tAdmin("overview")}
                </AppNavLink>
              </li>
              <li>
                <AppNavLink href="/admin/organisations">
                  <Building2 {...iconProps} />
                  {tAdmin("organizations")}
                </AppNavLink>
              </li>
              <li>
                <AppNavLink href="/admin/comptes">
                  <Users {...iconProps} />
                  {tAdmin("accounts")}
                </AppNavLink>
              </li>
              <li>
                <AppNavLink href="/admin/prise-en-main">
                  <GraduationCap {...iconProps} />
                  {tAdmin("onboarding")}
                </AppNavLink>
              </li>
              <li>
                <AppNavLink href="/admin/activite">
                  <Activity {...iconProps} />
                  {tAdmin("activity")}
                </AppNavLink>
              </li>
              <li>
                <AppNavLink href="/admin/health">
                  <HeartPulse {...iconProps} />
                  {tAdmin("health")}
                </AppNavLink>
              </li>
            </ul>
            <ul className="app-nav app-nav-secondary">
              <li>
                <AppNavLink href="/admin/parametres">
                  <SlidersHorizontal {...iconProps} />
                  {tAdmin("settings")}
                </AppNavLink>
              </li>
              <li>
                <AppNavLink href="/profil">
                  <UserCog {...iconProps} />
                  {tAdmin("account")}
                </AppNavLink>
              </li>
              <li>
                <AppNavLink href="/aide">
                  <LifeBuoy {...iconProps} />
                  {tAide("link")}
                </AppNavLink>
              </li>
            </ul>
          </nav>
          <div className="app-user">
            <span>{t("connectedAs", { email: auth.user.email })}</span>
            {logout}
          </div>
        </AppSidebar>
        <HelpProvider>
          <div className="app-main">
            <section className="app-topbar" aria-label={t("topBar")}>
              <HelpButton />
            </section>
            {children}
          </div>
        </HelpProvider>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <AppSidebar
        brand={<Brand href="/" />}
        menuLabel={t("menuOpen")}
        closeLabel={t("menuClose")}
      >
        {!setupDone ? (
          <nav aria-label={t("navLabel")}>
            <ul className="app-nav">
              <li>
                <AppNavLink href="/demarrage">
                  <Rocket {...iconProps} />
                  {t("setup")}
                </AppNavLink>
              </li>
              <li>
                <AppNavLink href="/aide">
                  <LifeBuoy {...iconProps} />
                  {tAide("link")}
                </AppNavLink>
              </li>
            </ul>
            <p className="nav-locked">
              <Lock size={16} aria-hidden="true" /> {t("setupLocked")}
            </p>
          </nav>
        ) : (
          <nav aria-label={t("navLabel")}>
            <ul className="app-nav">
              <li>
                <AppNavLink href="/">
                  <CalendarDays {...iconProps} />
                  {t("agenda")}
                </AppNavLink>
              </li>
              {events ? (
                <>
                  <li>
                    <AppNavLink href="/events">
                      <CalendarHeart {...iconProps} />
                      {t("events")}
                    </AppNavLink>
                  </li>
                  <li>
                    <AppNavLink href="/taches">
                      <ListChecks {...iconProps} />
                      {t("tasks")}
                      {overdue > 0 ? (
                        <span className="nav-count">
                          {t("tasksOverdue", { count: overdue })}
                        </span>
                      ) : null}
                    </AppNavLink>
                  </li>
                </>
              ) : null}
              {vendors ? (
                <li>
                  <AppNavLink href="/prestataires" tour="nav-vendors">
                    <BookUser {...iconProps} />
                    {t("vendorBook")}
                  </AppNavLink>
                </li>
              ) : null}
              {quotes ? (
                <>
                  <li>
                    <AppNavLink href="/devis" except={["/devis/encaissements"]}>
                      <FileText {...iconProps} />
                      {t("navQuotesGroup")}
                    </AppNavLink>
                  </li>
                  <li>
                    <AppNavLink href="/devis/encaissements">
                      <Wallet {...iconProps} />
                      {t("quotePayments")}
                    </AppNavLink>
                  </li>
                </>
              ) : null}
            </ul>
            <ul className="app-nav app-nav-secondary">
              {organizationId ? (
                <li>
                  <AppNavLink href="/parametres" settings tour="nav-settings">
                    <Settings {...iconProps} />
                    {t("settings")}
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
                  <AppNavLink href="/tutoriels">
                    <GraduationCap {...iconProps} />
                    {tAide("tutorialsLink")}
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
                <AppNavLink href="/aide">
                  <LifeBuoy {...iconProps} />
                  {tAide("link")}
                </AppNavLink>
              </li>
            </ul>
          </nav>
        )}
        <div className="app-user">
          <span>{t("connectedAs", { email: auth.user.email })}</span>
          {logout}
        </div>
      </AppSidebar>
      <HelpProvider>
        <div className="app-main">
          {/* Lot 16 (L16-HUB-19, ADR 0039) : recherche à gauche, le seul « ? » à droite. */}
          <section className="app-topbar" aria-label={t("topBar")}>
            {isTeam && setupDone ? <SearchBox /> : null}
            <HelpButton />
          </section>
          {settingsSections.length > 0 ? (
            <SettingsNav
              groups={settingsSections}
              label={t("settingsSections")}
            />
          ) : null}
          {/* L'invitation à un tutoriel s'affiche dans la page, plus en surimpression. */}
          {helpBar && setupDone ? (
            <HelpBar tutorial={helpBar.tutorial} invites={helpBar.invites} />
          ) : null}
          {children}
        </div>
      </HelpProvider>
    </div>
  );
}
