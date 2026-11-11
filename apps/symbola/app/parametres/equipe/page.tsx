import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { listTeam } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { formatDateTime, type Locale } from "@symbola/i18n";
import { ScreenHelp } from "@/app/screen-help";
import { PageHeader } from "@/app/ui/page-header";
import { requireOwner } from "@/lib/guards";
import { removeMemberAction } from "./actions";

type Query = { retirer?: string; retire?: string };

// Lot 24b (SEC-06, décision D3) — équipe de l'organisation : la titulaire voit
// les comptes de l'équipe et retire l'accès d'un collaborateur, après une
// confirmation. Titulaire seulement. Inviter un collaborateur ou changer un
// rôle viendra avec la gestion complète de l'équipe.
export default async function TeamPage({ searchParams }: { searchParams: Promise<Query> }) {
  const auth = await requireOwner();
  const t = await getTranslations("Team");
  const tHelp = await getTranslations("Help");
  if (!auth) {
    return (
      <main>
        <h1>{t("title")}</h1>
        <p>{t("ownerOnly")}</p>
      </main>
    );
  }
  const locale = (await getLocale()) as Locale;
  const query = await searchParams;
  const members = await listTeam(appDatabase(), auth.user.organizationId);
  const confirming = members.find((member) => member.id === query.retirer && member.role === "member" && !member.disabledAt);

  return (
    <main>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <ScreenHelp title={tHelp("team.title")} body={tHelp("team.body")} />
      {query.retire === "1" ? <p role="status">{t("removed")}</p> : null}

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
        <table className="list-table">
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
                  {member.role === "member" && !member.disabledAt ? (
                    <Link href={`/parametres/equipe?retirer=${member.id}`}>{t("remove", { email: member.email })}</Link>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
