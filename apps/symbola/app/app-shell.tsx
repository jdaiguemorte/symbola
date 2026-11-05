// Structure d'écran commune (charte graphique, lot 7, ADR 0025) : menu
// latéral pour la planner et l'Admin (au-dessus du contenu sur téléphone),
// en-tête simple pour un marié, écran centré pour la connexion. Les liens
// du menu suivent les modules souscrits (dégradation propre, CLAUDE.md §2.3)
// et le rôle ; ce sont ceux qu'affichait l'accueil jusqu'ici.
import type { ReactNode } from "react";
import {
  BookUser,
  CalendarDays,
  CalendarHeart,
  FileText,
  LifeBuoy,
  ListChecks,
  Settings,
  Shield,
  Wallet,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { parisToday } from "@symbola/i18n";
import { createAppConnection } from "@symbola/db/client";
import { getSetupState, isModuleEnabled } from "@/modules/hub/service";
import { listOrganizationTasks } from "@/modules/events/service";
import { getAuthContext } from "@/lib/auth-context";
import { AppNavLink } from "./app-nav-link";
import { AppSidebar } from "./app-sidebar";
import { logoutAction } from "./logout-action";
import { SettingsNav, type SettingsSection } from "./settings-nav";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { Lock, Rocket } from "lucide-react";
import { HelpBar, type TutorialInvite } from "./help-bar";
import { AUTO_TOURS_COOKIE } from "@/lib/help/preferences";
import { SearchBox } from "./search-box";
import { HelpProvider } from "./help-context";
import { getHelpProgress } from "@/modules/hub/service";
import { type HelpModule, TUTORIALS, tutorialHref } from "@/lib/help/catalog";
import { TOUR_TARGETS, type TourKey } from "@/lib/help/tours";

// Lot 12 (AIDE-09) : module de chaque visite, pour ne compter que celles
// des modules souscrits.
const TOUR_MODULES: Record<TourKey, HelpModule> = { hub: "hub", events: "events", event: "events", quotes: "quotes", budget: "budget", vendors: "vendors" };

function Logo() {
  return (
    <svg width="32" height="32" viewBox="0 0 56 56" aria-hidden="true">
      <circle
        cx="28"
        cy="28"
        r="26"
        fill="none"
        stroke="#4F6B5A"
        strokeWidth="3"
      />
      <circle
        cx="22"
        cy="28"
        r="11"
        fill="none"
        stroke="#A8553A"
        strokeWidth="3"
      />
      <circle
        cx="34"
        cy="28"
        r="11"
        fill="none"
        stroke="#4F6B5A"
        strokeWidth="3"
      />
    </svg>
  );
}

function Brand({ href }: { href: string }) {
  return (
    <a href={href} className="app-brand">
      <Logo />
      <span>Symbola</span>
    </a>
  );
}

const iconProps = { size: 18, "aria-hidden": true as const, strokeWidth: 1.75 };

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

  // Un marié n'a que l'espace de son mariage (EVT-06).
  if (auth.user.role === "client") {
    return (
      <div className="app-shell">
        <header className="app-sidebar">
          <Brand href="/espace" />
          <div className="app-user">
            <span>{t("connectedAs", { email: auth.user.email })}</span>
            {logout}
          </div>
        </header>
        <div className="app-main">{children}</div>
      </div>
    );
  }

  const organizationId = auth.user.organizationId;
  let events = false;
  let budget = false;
  let quotes = false;
  let vendors = false;
  if (organizationId) {
    const { sql, db } = createAppConnection();
    try {
      events = await isModuleEnabled(db, organizationId, "events");
      budget = await isModuleEnabled(db, organizationId, "budget");
      quotes = await isModuleEnabled(db, organizationId, "quotes");
      vendors = await isModuleEnabled(db, organizationId, "vendors");
    } finally {
      await sql.end();
    }
  }
  const isOwner = auth.user.role === "owner" && Boolean(organizationId);
  // Lot 12 (ONB-03) — assistant de démarrage bloquant : tant qu'il n'est pas
  // terminé, l'équipe n'a que l'assistant (et l'aide, le profil).
  const teamMember = Boolean(organizationId) && (auth.user.role === "owner" || auth.user.role === "member");
  let setupDone = true;
  if (teamMember && organizationId) {
    const { sql, db } = createAppConnection();
    try {
      setupDone = (await getSetupState(db, organizationId)).completed;
    } finally {
      await sql.end();
    }
    const pathname = (await headers()).get("x-pathname") ?? "/";
    const allowed = ["/demarrage", "/aide", "/profil"].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
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
    tours: { seen: number; total: number };
    tutorial: { title: string; href: string } | null;
    invites: TutorialInvite[];
  } | null = null;
  if (isTeam) {
    const subscribed: Record<HelpModule, boolean> = { hub: true, events, budget, quotes, vendors };
    const available = TUTORIALS.filter((tutorial) => subscribed[tutorial.module]);
    const { sql, db } = createAppConnection();
    let progress;
    try {
      progress = await getHelpProgress(db, auth.user.id);
    } finally {
      await sql.end();
    }
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
      tours: (() => {
        const tours = (Object.keys(TOUR_TARGETS) as TourKey[]).filter((key) => subscribed[TOUR_MODULES[key]]);
        return {
          seen: tours.filter((key) => progress.some((entry) => entry.itemKey === `tour:${key}` && entry.status === "completed")).length,
          total: tours.length,
        };
      })(),
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
  // Pastille « en retard » du menu Tâches (HUB-02).
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

  // Paramètres : une pastille par solution souscrite (HUB-12, lot 11).
  const settingsSections: SettingsSection[] = organizationId
    ? [
        {
          href: "/parametres",
          label: t("settingsOrganization"),
          paths: ["/parametres"],
        },
        ...(events
          ? [
              {
                href: "/events/parametres",
                label: t("events"),
                paths: [
                  "/events/parametres",
                  "/events/modeles",
                  "/events/modeles-programme",
                ],
                children: [
                  {
                    href: "/events/parametres",
                    label: t("settingsEventsLists"),
                  },
                  {
                    href: "/events/modeles",
                    label: t("settingsTaskTemplates"),
                  },
                  {
                    href: "/events/modeles-programme",
                    label: t("settingsProgramTemplates"),
                  },
                ],
              },
            ]
          : []),
        ...(vendors
          ? [
              {
                href: "/prestataires/parametres",
                label: t("vendorBook"),
                paths: ["/prestataires/parametres"],
                children: [
                  { href: "/prestataires/parametres", label: t("settingsVendorTypes") },
                  { href: "/prestataires/parametres/etiquettes", label: t("settingsVendorTags") },
                  { href: "/prestataires/parametres/trajet", label: t("settingsVendorTravel") },
                ],
              },
            ]
          : []),
        ...(budget
          ? [
              {
                href: "/budget/parametres",
                label: t("budgetModels"),
                paths: ["/budget/parametres"],
              },
            ]
          : []),
        ...(quotes
          ? [
              {
                href: "/devis/parametres",
                label: t("navQuotesGroup"),
                paths: [
                  "/devis/parametres",
                  "/devis/catalogue",
                  "/devis/e-reporting",
                ],
                children: [
                  { href: "/devis/parametres", label: t("quoteSettings") },
                  { href: "/devis/catalogue", label: t("quoteCatalog") },
                  { href: "/devis/e-reporting", label: t("eReporting") },
                ],
              },
            ]
          : []),
        ...(events || budget || quotes
          ? [{ href: "/import", label: t("importData"), paths: ["/import"] }]
          : []),
        ...(isOwner
          ? [{ href: "/rgpd", label: t("privacy"), paths: ["/rgpd"] }]
          : []),
        { href: "/profil", label: t("myProfile"), paths: ["/profil"] },
      ]
    : [];

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
                  <AppNavLink href="/devis">
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
            {isAdmin ? (
              <li>
                <AppNavLink href="/admin">
                  <Shield {...iconProps} />
                  {t("administration")}
                </AppNavLink>
              </li>
            ) : null}
          </ul>
          <ul className="app-nav app-nav-secondary">
            {organizationId ? (
              <li>
                <AppNavLink href="/parametres" settings tour="nav-settings">
                  <Settings {...iconProps} />
                  {t("settings")}
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
          {isTeam && setupDone ? <SearchBox /> : null}
          {settingsSections.length > 0 ? (
            <SettingsNav
              sections={settingsSections}
              label={t("settingsSections")}
              subLabel={t("settingsSubSections")}
            />
          ) : null}
          {children}
        </div>
        {helpBar && setupDone ? <HelpBar {...helpBar} /> : null}
      </HelpProvider>
    </div>
  );
}
