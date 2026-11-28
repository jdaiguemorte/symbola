import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { findPendingOwnershipTransfer, listTeam } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { formatDate, formatDateTime, type Locale } from "@symbola/i18n";
import { ScreenHelp } from "@/app/screen-help";
import { PageHeader } from "@/app/ui/page-header";
import { requireOwner } from "@/lib/guards";
import { cancelOwnershipTransferAction, removeMemberAction, requestOwnershipTransferAction, setEventVisibilityAction } from "./actions";
import { InviteMemberForm } from "./invite-form";
import { getEventVisibility, listPendingTeamInvitations } from "@/modules/hub/service";

type Query = { retirer?: string; retire?: string; transferer?: string; transfert?: string; visibilite?: string };

const TRANSFER_OUTCOMES = ["sent", "cancelled", "mfa_missing", "not_planner", "not_owner", "send_failed"] as const;

// Lot 24b (SEC-06, décision D3) — équipe de l'organisation : la titulaire voit
// les comptes de l'équipe et retire l'accès d'un collaborateur, après une
// confirmation. Titulaire seulement. Lot 33b (HUB-03, D12) : elle invite une
// Planner. Lot 52 (HUB-04, EVT-06 ; D1, D2 ; ADR 0094) : elle invite aussi un Comptable (lecture
// seule) ; le retrait ferme aussi les sessions du fournisseur ; elle transfère la propriété à une
// Planner qui a la double authentification ; elle règle la visibilité des évènements.
export default async function TeamPage({ searchParams }: { searchParams: Promise<Query> }) {
  const auth = await requireOwner();
  const t = await getTranslations("Team");
  const tMenu = await getTranslations("SettingsMenu");
  const tHelp = await getTranslations("Help");
  if (!auth) {
    return (
      <main>
        <h1>{tMenu("rubrics.team.label")}</h1>
        <p>{t("ownerOnly")}</p>
      </main>
    );
  }
  const locale = (await getLocale()) as Locale;
  const query = await searchParams;
  const members = await listTeam(appDatabase(), auth.user.organizationId);
  const pending = await listPendingTeamInvitations(appDatabase(), auth.user.organizationId);
  const removable = (member: (typeof members)[number]) => (member.role === "member" || member.role === "accountant") && !member.disabledAt;
  const confirming = members.find((member) => member.id === query.retirer && removable(member));
  const transferring = members.find((member) => member.id === query.transferer && member.role === "member" && !member.disabledAt);
  const pendingTransfer = await findPendingOwnershipTransfer(appDatabase(), auth.user.organizationId);
  const pendingTransferTo = pendingTransfer ? members.find((member) => member.id === pendingTransfer.toUserId) : null;
  const visibility = await getEventVisibility(appDatabase(), auth.user.organizationId);
  const transferOutcome = TRANSFER_OUTCOMES.find((outcome) => outcome === query.transfert);

  return (
    <main>
      <PageHeader title={tMenu("rubrics.team.label")} subtitle={t("subtitle")} />
      <ScreenHelp title={tHelp("team.title")} body={tHelp("team.body")} />
      {query.retire === "1" ? <p role="status">{t("removed")}</p> : null}
      {transferOutcome ? <p role={transferOutcome === "sent" || transferOutcome === "cancelled" ? "status" : "alert"}>{t(`transferOutcome.${transferOutcome}`)}</p> : null}
      {query.visibilite === "1" ? <p role="status">{t("visibilitySaved")}</p> : null}

      {transferring ? (
        <section className="card" aria-labelledby="transfer-title">
          <h2 id="transfer-title">{t("transferConfirmTitle", { email: transferring.email })}</h2>
          <p>{t("transferConfirmBody")}</p>
          <div className="row-wrap">
            <form action={requestOwnershipTransferAction}>
              <input type="hidden" name="userId" value={transferring.id} />
              <button type="submit">{t("transferConfirm")}</button>
            </form>
            <Link href="/parametres/equipe">{t("cancel")}</Link>
          </div>
        </section>
      ) : null}

      {confirming ? (
        <section className="card" aria-labelledby="confirm-title">
          <h2 id="confirm-title">{t("confirmTitle", { email: confirming.email })}</h2>
          <p>{t("confirmBody")}</p>
          <div className="row-wrap">
            <form action={removeMemberAction}>
              <input type="hidden" name="userId" value={confirming.id} />
              <button type="submit">{t("confirmRemove")}</button>
            </form>
            <Link href="/parametres/equipe">{t("cancel")}</Link>
          </div>
        </section>
      ) : null}

      <div className="list-table-wrap" role="region" aria-labelledby="team-title" tabIndex={0}>
        <table className="list-table team-table">
          <caption id="team-title">{t("listTitle")}</caption>
          <thead>
            <tr>
              <th scope="col">{t("columnEmail")}</th>
              <th scope="col">{t("columnRole")}</th>
              <th scope="col">{t("columnLastLogin")}</th>
              <th scope="col">{t("columnAccess")}</th>
              <th scope="col">
                <span className="sr-only">{t("columnActions")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id}>
                <th scope="row">{member.email}</th>
                <td>{t(`roles.${member.role}`)}</td>
                <td className="num">{member.lastLoginAt ? formatDateTime(member.lastLoginAt, locale) : "—"}</td>
                <td>{member.disabledAt ? t("accessRemoved", { date: formatDateTime(member.disabledAt, locale) }) : t("accessActive")}</td>
                <td>
                  <div className="row-wrap">
                    {removable(member) ? <Link href={`/parametres/equipe?retirer=${member.id}`}>{t("remove", { email: member.email })}</Link> : null}
                    {member.role === "member" && !member.disabledAt && !pendingTransfer ? <Link href={`/parametres/equipe?transferer=${member.id}`}>{t("transfer", { email: member.email })}</Link> : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pendingTransfer ? (
        <section className="card" aria-labelledby="pending-transfer-title">
          <h2 id="pending-transfer-title">{t("transferPendingTitle")}</h2>
          <p>{t("transferPendingBody", { email: pendingTransferTo?.email ?? "—", date: formatDate(pendingTransfer.expiresAt, locale) })}</p>
          <form action={cancelOwnershipTransferAction}>
            <button type="submit" className="button-ghost">
              {t("transferCancel")}
            </button>
          </form>
        </section>
      ) : null}

      <section className="card" aria-labelledby="visibility-title">
        <h2 id="visibility-title">{t("visibilityTitle")}</h2>
        <form action={setEventVisibilityAction} className="stack">
          <label className="checkbox">
            <input type="checkbox" name="allPlannersSeeAll" defaultChecked={visibility.allPlannersSeeAll} />
            {t("visibilityLabel")}
          </label>
          <p className="muted">{t("visibilityHint")}</p>
          <button type="submit" className="button-ghost">
            {t("visibilitySave")}
          </button>
        </form>
      </section>

      <section className="card" aria-labelledby="invite-title">
        <h2 id="invite-title">{t("inviteTitle")}</h2>
        <InviteMemberForm />
        {pending.length > 0 ? (
          <>
            <h3>{t("pendingTitle")}</h3>
            <ul>
              {pending.map((invitation) => (
                <li key={invitation.id}>{t("pendingUntil", { email: invitation.email, date: formatDate(invitation.expiresAt, locale), role: t(`roles.${invitation.role}`) })}</li>
              ))}
            </ul>
          </>
        ) : null}
      </section>
    </main>
  );
}
