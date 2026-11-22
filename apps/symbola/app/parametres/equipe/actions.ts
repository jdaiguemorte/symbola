"use server";

// Lot 24b (SEC-06, décision D3) — retrait de l'accès d'un collaborateur, par la
// titulaire seulement : ses sessions et appareils de confiance sont supprimés,
// il ne se connecte plus. La ligne va au journal de l'organisation.
// Lot 33b (HUB-03, D12) — invitation d'une Planner par la Propriétaire : lien valable sept jours, à
// usage unique, envoyé dans la langue de l'écran. Débit limité et quota d'e-mails de l'organisation.
// Lot 52 (HUB-04, EVT-06 ; D1, D2 ; ADR 0094) — invitation d'une Planner ou d'un Comptable ; le retrait
// ferme aussi les sessions du fournisseur d'identité et retire la personne des équipes d'évènement ;
// transfert de propriété ; réglage « toutes les Planners voient tous les évènements ».
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { accountIdentity, cancelOwnershipTransfer, removeMember, requestOwnershipTransfer } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { parseEnv } from "@symbola/env";
import { formatDate, type Locale } from "@symbola/i18n";
import { MailQuotaExceededError, reserveOrganizationMail } from "@symbola/mail";
import { requireOwner } from "@/lib/guards";
import { closeProviderSessions, identity } from "@/lib/identity";
import { checkRateLimit, longestWait, rateLimitMessage } from "@/lib/rate-limit";
import { createTeamInvitation, eraseMemberSignature, getOrganizationContact, sendOrganizationEmail, sendSymbolaEmail, setEventVisibility } from "@/modules/hub/service";
import { removeMemberFromEvents } from "@/modules/events/service";
import { isEventsModuleEnabled } from "@/app/events/module-access";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type InviteMemberState = { error?: string; sent?: boolean };

function appUrl(): string {
  return parseEnv(process.env).APP_PUBLIC_URL.replace(/\/+$/, "");
}

// HUB-04 : la révocation supprime aussitôt les sessions Symbola de la personne (sa requête suivante est
// refusée), ferme ses sessions chez le fournisseur et la retire des équipes d'évènement.
export async function removeMemberAction(formData: FormData): Promise<void> {
  const owner = await requireOwner();
  if (!owner) return;
  const userId = String(formData.get("userId") ?? "");
  if (!UUID.test(userId)) return;
  const organizationId = owner.user.organizationId;
  const outcome = await removeMember(appDatabase(), { organizationId, userId, removedByUserId: owner.user.id, closeProviderSessions });
  if (outcome === "removed" && (await isEventsModuleEnabled(organizationId))) await removeMemberFromEvents(organizationId, userId);
  // Lot 66c (D5, RGP-05) : sa signature (nom, fonction, téléphone, liens, photo) part avec son accès.
  if (outcome === "removed") await eraseMemberSignature(organizationId, userId);
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
  const role = formData.get("role") === "accountant" ? "accountant" : "member";
  const result = await createTeamInvitation(db, { organizationId, email, invitedByUserId: owner.user.id, role });
  if (result.outcome === "invalid_email") return { error: t("inviteInvalidEmail") };
  if (result.outcome === "already_member") return { error: t("inviteAlreadyMember") };

  const locale = (await getLocale()) as Locale;
  const url = `${appUrl()}/invitations/${result.token}`;
  try {
    await reserveOrganizationMail(organizationId);
    const organization = (await getOrganizationContact(db, organizationId)).name;
    // Lot 38a (D3) : texte fixe de Symbola, mis en page.
    await sendSymbolaEmail({
      to: email,
      locale,
      subject: t("inviteMailSubject", { organization }),
      body: t(role === "accountant" ? "inviteMailBodyAccountant" : "inviteMailBody", { organization, url, date: formatDate(result.expiresAt, locale) }),
      organizationId,
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

// D1 : la Planner désignée a-t-elle un second facteur chez le fournisseur ? En cas de doute, non.
async function hasMfaFactor(userId: string): Promise<boolean> {
  const account = await accountIdentity(appDatabase(), userId);
  if (!account?.idpSubject) return false;
  try {
    return (await identity().management.listMfaVerifications(account.idpSubject)).length > 0;
  } catch (error) {
    console.error("transfert de propriété : facteurs illisibles", error instanceof Error ? error.name : "erreur");
    return false;
  }
}

// D1 : la Propriétaire désigne une Planner qui a la double authentification ; la Planner reçoit le lien
// de confirmation (usage unique, sept jours ; jeton après « # »).
export async function requestOwnershipTransferAction(formData: FormData): Promise<void> {
  const owner = await requireOwner();
  if (!owner) return;
  const toUserId = String(formData.get("userId") ?? "");
  if (!UUID.test(toUserId)) redirect("/parametres/equipe");
  const organizationId = owner.user.organizationId;
  const db = appDatabase();
  const requested = await requestOwnershipTransfer(db, { organizationId, fromUserId: owner.user.id, toUserId, toHasMfa: await hasMfaFactor(toUserId) });
  if (requested.outcome !== "requested") redirect(`/parametres/equipe?transfert=${requested.outcome}`);
  const recipient = await accountIdentity(db, toUserId);
  const locale: Locale = recipient ? ((await getLocale()) as Locale) : "fr";
  try {
    await sendOrganizationEmail({
      organizationId,
      to: requested.toEmail,
      kind: "ownership_transfer",
      locale,
      values: { link: `${appUrl()}/propriete#${requested.token}`, valid_until: formatDate(requested.expiresAt, locale) },
    });
  } catch (error) {
    console.error("transfert de propriété : envoi impossible", error instanceof Error ? error.name : "erreur");
    await cancelOwnershipTransfer(db, { organizationId, byUserId: owner.user.id });
    redirect("/parametres/equipe?transfert=send_failed");
  }
  revalidatePath("/parametres/equipe");
  redirect("/parametres/equipe?transfert=sent");
}

export async function cancelOwnershipTransferAction(): Promise<void> {
  const owner = await requireOwner();
  if (!owner) return;
  await cancelOwnershipTransfer(appDatabase(), { organizationId: owner.user.organizationId, byUserId: owner.user.id });
  revalidatePath("/parametres/equipe");
  redirect("/parametres/equipe?transfert=cancelled");
}

// D2 : « Toutes les Planners voient tous les évènements » (activé par défaut).
export async function setEventVisibilityAction(formData: FormData): Promise<void> {
  const owner = await requireOwner();
  if (!owner) return;
  await setEventVisibility(appDatabase(), { organizationId: owner.user.organizationId, allPlannersSeeAll: formData.get("allPlannersSeeAll") === "on", byUserId: owner.user.id });
  revalidatePath("/parametres/equipe");
  redirect("/parametres/equipe?visibilite=1");
}
