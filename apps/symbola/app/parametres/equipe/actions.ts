"use server";

// Lot 24b (SEC-06, décision D3) — retrait de l'accès d'un collaborateur, par la
// titulaire seulement : ses sessions et appareils de confiance sont supprimés,
// il ne se connecte plus. La ligne va au journal de l'organisation.
// Lot 33b (HUB-03, D12) — invitation d'une Planner par la Propriétaire : lien valable sept jours, à
// usage unique, envoyé dans la langue de l'écran. Débit limité et quota d'e-mails de l'organisation.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { removeMember } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { parseEnv } from "@symbola/env";
import { formatDate, type Locale } from "@symbola/i18n";
import { MailQuotaExceededError, reserveOrganizationMail, sendMail } from "@symbola/mail";
import { requireOwner } from "@/lib/guards";
import { checkRateLimit, longestWait, rateLimitMessage } from "@/lib/rate-limit";
import { createTeamInvitation, getOrganizationContact } from "@/modules/hub/service";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type InviteMemberState = { error?: string; sent?: boolean };

export async function removeMemberAction(formData: FormData): Promise<void> {
  const owner = await requireOwner();
  if (!owner) return;
  const userId = String(formData.get("userId") ?? "");
  if (!UUID.test(userId)) return;
  const outcome = await removeMember(appDatabase(), { organizationId: owner.user.organizationId, userId, removedByUserId: owner.user.id });
  revalidatePath("/parametres/equipe");
  redirect(outcome === "removed" ? "/parametres/equipe?retire=1" : "/parametres/equipe");
}

export async function inviteMemberAction(_prev: InviteMemberState, formData: FormData): Promise<InviteMemberState> {
  const t = await getTranslations("Team");
  const owner = await requireOwner();
  if (!owner) return { error: t("ownerOnly") };
  const organizationId = owner.user.organizationId;
  const wait = longestWait(await checkRateLimit("teamInvite", { account: organizationId }));
  if (wait !== null) return { error: await rateLimitMessage(wait) };

  const db = appDatabase();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const result = await createTeamInvitation(db, { organizationId, email, invitedByUserId: owner.user.id });
  if (result.outcome === "invalid_email") return { error: t("inviteInvalidEmail") };
  if (result.outcome === "already_member") return { error: t("inviteAlreadyMember") };

  const locale = (await getLocale()) as Locale;
  const url = `${parseEnv(process.env).APP_PUBLIC_URL.replace(/\/+$/, "")}/invitations/${result.token}`;
  try {
    await reserveOrganizationMail(organizationId);
    const organization = (await getOrganizationContact(db, organizationId)).name;
    await sendMail({
      to: email,
      subject: t("inviteMailSubject", { organization }),
      text: t("inviteMailBody", { organization, url, date: formatDate(result.expiresAt, locale) }),
    });
  } catch (error) {
    if (error instanceof MailQuotaExceededError) return { error: t("inviteMailQuota") };
    // Journal : le type d'erreur seulement, jamais l'adresse (SEC-20).
    console.error("invitation d'une Planner : envoi impossible", error instanceof Error ? error.name : "erreur");
    return { error: t("inviteSendFailed") };
  }
  revalidatePath("/parametres/equipe");
  return { sent: true };
}
