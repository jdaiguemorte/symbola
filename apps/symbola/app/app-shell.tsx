// Structure d'écran commune (charte graphique, lot 7, ADR 0025) : menu
// latéral pour la planner et l'Admin (au-dessus du contenu sur téléphone),
// en-tête simple pour un marié, écran centré pour la connexion. Les liens
// du menu suivent les modules souscrits (dégradation propre, CLAUDE.md §2.3)
// et le rôle ; ce sont ceux qu'affichait l'accueil jusqu'ici.
import type { ReactNode } from "react";
import {
  CalendarHeart,
  FileText,
  House,
  LifeBuoy,
  PiggyBank,
  Receipt,
  Settings,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
  Wallet,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createAppConnection } from "@symbola/db/client";
import { isModuleEnabled } from "@/modules/hub/service";
import { getAuthContext } from "@/lib/auth-context";
import { AppNavLink } from "./app-nav-link";
import { AppSidebar } from "./app-sidebar";
import { logoutAction } from "./logout-action";

function Logo() {
  return (
    <svg width="32" height="32" viewBox="0 0 56 56" aria-hidden="true">
      <circle cx="28" cy="28" r="26" fill="none" stroke="#4F6B5A" strokeWidth="3" />
      <circle cx="22" cy="28" r="11" fill="none" stroke="#A8553A" strokeWidth="3" />
      <circle cx="34" cy="28" r="11" fill="none" stroke="#4F6B5A" strokeWidth="3" />
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
  if (organizationId) {
    const { sql, db } = createAppConnection();
    try {
      events = await isModuleEnabled(db, organizationId, "events");
      budget = await isModuleEnabled(db, organizationId, "budget");
      quotes = await isModuleEnabled(db, organizationId, "quotes");
    } finally {
      await sql.end();
    }
  }
  const isOwner = auth.user.role === "owner" && Boolean(organizationId);
  const isAdmin = auth.user.role === "admin";

  return (
    <div className="app-shell">
      <AppSidebar brand={<Brand href="/" />} menuLabel={t("menuOpen")} closeLabel={t("menuClose")}>
        <nav aria-label={t("navLabel")}>
          <ul className="app-nav">
            <li>
              <AppNavLink href="/">
                <House {...iconProps} />
                {t("home")}
              </AppNavLink>
            </li>
            {events ? (
              <li>
                <AppNavLink href="/events">
                  <CalendarHeart {...iconProps} />
                  {t("events")}
                </AppNavLink>
              </li>
            ) : null}
            {budget ? (
              <li>
                <AppNavLink href="/budget/parametres">
                  <PiggyBank {...iconProps} />
                  {t("budgetModels")}
                </AppNavLink>
              </li>
            ) : null}
            {quotes ? (
              <>
                <li className="app-nav-group" aria-hidden="true">
                  {t("navQuotesGroup")}
                </li>
                <li>
                  <AppNavLink href="/devis/catalogue">
                    <FileText {...iconProps} />
                    {t("quoteCatalog")}
                  </AppNavLink>
                </li>
                <li>
                  <AppNavLink href="/devis/encaissements">
                    <Wallet {...iconProps} />
                    {t("quotePayments")}
                  </AppNavLink>
                </li>
                <li>
                  <AppNavLink href="/devis/e-reporting">
                    <Receipt {...iconProps} />
                    {t("eReporting")}
                  </AppNavLink>
                </li>
                <li>
                  <AppNavLink href="/devis/parametres">
                    <SlidersHorizontal {...iconProps} />
                    {t("quoteSettings")}
                  </AppNavLink>
                </li>
              </>
            ) : null}
            <li className="app-nav-group" aria-hidden="true">
              {t("navToolsGroup")}
            </li>
            {organizationId && (events || budget || quotes) ? (
              <li>
                <AppNavLink href="/import">
                  <Upload {...iconProps} />
                  {t("importData")}
                </AppNavLink>
              </li>
            ) : null}
            {isOwner ? (
              <li>
                <AppNavLink href="/rgpd">
                  <ShieldCheck {...iconProps} />
                  {t("privacy")}
                </AppNavLink>
              </li>
            ) : null}
            {isAdmin ? (
              <li>
                <AppNavLink href="/admin">
                  <Shield {...iconProps} />
                  {t("administration")}
                </AppNavLink>
              </li>
            ) : null}
            {organizationId ? (
              <li>
                <AppNavLink href="/parametres">
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
        <div className="app-user">
          <span>{t("connectedAs", { email: auth.user.email })}</span>
          <AppNavLink href="/profil">{t("myProfile")}</AppNavLink>
          {logout}
        </div>
      </AppSidebar>
      <div className="app-main">{children}</div>
    </div>
  );
}
