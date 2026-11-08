// Lot 9 (ADR 0029) — état des comptes d'équipe et des invitations, par
// organisation, avec les actions d'assistance. Aucune donnée métier, aucun
// compte marié (seulement des nombres, sur l'écran Activité).
import { getLocale, getTranslations } from "next-intl/server";
import { ScreenHelp } from "@/app/screen-help";
import { formatDateTime, type Locale } from "@symbola/i18n";
import { appDatabase } from "@symbola/db/client";
import { listOrganizationsSupport } from "@/modules/hub/service";
import { requireAdmin } from "@/lib/guards";
import { uniqueLabels } from "../unique-labels";
import { AdminListPagination, AdminListSearch, filterByName } from "../admin-list";
import { paginate } from "@/app/ui/pagination";
import { resendInvitationAction, resetMfaAction } from "./actions";

const RESULTS = ["invitation-envoyee", "double-authentification-reinitialisee", "e-mail-non-envoye", "confirmation-requise", "erreur"] as const;
const RESULT_KEYS = {
  "invitation-envoyee": "resultInvitationSent",
  "double-authentification-reinitialisee": "resultMfaReset",
  "e-mail-non-envoye": "resultMailFailed",
  "confirmation-requise": "resultConfirmationRequired",
  erreur: "resultError",
} as const;

export default async function AdminAccountsPage({ searchParams }: { searchParams: Promise<{ resultat?: string; q?: string; page?: string }> }) {
  await requireAdmin();
  const t = await getTranslations("AdminAccounts");
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) as Locale;
  const { resultat, q, page: pageParam } = await searchParams;
  const result = RESULTS.find((candidate) => candidate === resultat);
  const now = new Date();

  const db = appDatabase();
  const organizations = await listOrganizationsSupport(db, now);

  const page = paginate(filterByName(organizations, q), pageParam);
  const labels = uniqueLabels(page.items.map((organization) => organization.name));

  return (
    <main>
      <h1>{t("title")}</h1>
      <ScreenHelp title={tHelp("adminAccounts.title")} body={tHelp("adminAccounts.body")} />
      <p>{t("intro")}</p>
      <AdminListSearch q={q} total={page.total} />
      {result ? (
        <p role={result === "erreur" || result === "e-mail-non-envoye" || result === "confirmation-requise" ? "alert" : "status"}>
          {t(RESULT_KEYS[result])}
        </p>
      ) : null}

      {page.items.map((organization, position) => (
        <div key={organization.id} className="card">
          <h2>{organization.name}</h2>
          {organization.accounts.length === 0 && organization.pendingInvitations.length === 0 ? <p>{t("noAccount")}</p> : null}
          {organization.accounts.length > 0 ? (
            <div role="region" aria-label={t("accountsTable", { organization: labels[position]! })} tabIndex={0}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">{t("email")}</th>
                    <th scope="col">{t("role")}</th>
                    <th scope="col">{t("mfa")}</th>
                    <th scope="col">{t("lastLogin")}</th>
                    <th scope="col">{t("actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {organization.accounts.map((account) => {
                    const locked = account.lockedUntil !== null && account.lockedUntil.getTime() > now.getTime();
                    return (
                      <tr key={account.userId}>
                        <th scope="row">{account.email}</th>
                        <td>{t(account.role === "owner" ? "roleOwner" : "roleMember")}</td>
                        <td>
                          {t(account.mfaConfigured ? "mfaConfigured" : "mfaPending")}
                          {locked ? ` · ${t("lockedUntil", { date: formatDateTime(account.lockedUntil!, locale) })}` : ""}
                        </td>
                        <td>{account.lastLoginAt ? formatDateTime(account.lastLoginAt, locale) : t("never")}</td>
                        <td>
                          {account.mfaConfigured ? (
                            <form action={resetMfaAction} className="inline-form">
                              <input type="hidden" name="userId" value={account.userId} />
                              <input type="hidden" name="q" value={q ?? ""} />
                              <input type="hidden" name="page" value={String(page.page)} />
                              <label>
                                <input type="checkbox" name="confirm" required /> {t("resetMfaConfirm", { email: account.email })}
                              </label>
                              <button type="submit">{t("resetMfa")}</button>
                            </form>
                          ) : (
                            t("mfaPendingHint")
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
          {organization.pendingInvitations.length > 0 ? (
            <>
              <h3>{t("pendingInvitations")}</h3>
              <ul className="item-list" aria-label={t("pendingInvitationsOf", { organization: labels[position]! })}>
                {organization.pendingInvitations.map((invitation) => (
                  <li key={invitation.id}>
                    <span>
                      {invitation.email} —{" "}
                      {invitation.expired
                        ? t("invitationExpired", { date: formatDateTime(invitation.expiresAt, locale) })
                        : t("invitationValidUntil", { date: formatDateTime(invitation.expiresAt, locale) })}
                    </span>
                    <form action={resendInvitationAction} className="inline-form">
                      <input type="hidden" name="invitationId" value={invitation.id} />
                      <input type="hidden" name="q" value={q ?? ""} />
                      <input type="hidden" name="page" value={String(page.page)} />
                      <button type="submit">{t("resendInvitation", { email: invitation.email })}</button>
                    </form>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ))}
      <AdminListPagination page={page} basePath="/admin/comptes" q={q} />
    </main>
  );
}
