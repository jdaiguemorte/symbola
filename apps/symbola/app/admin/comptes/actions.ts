"use server";

// Lot 9 (ADR 0029) — actions d'assistance de l'Admin : chacune vérifiée côté
// serveur (rôle Admin), confirmée dans le formulaire, journalisée par le
// module hub, et signalée par e-mail à la personne concernée.
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { MfaResetNotAllowedError } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { parseEnv } from "@symbola/env";
import { sendMail } from "@symbola/mail";
import { InvitationNotPendingError, resendInvitation, resetTeamAccountMfa } from "@/modules/hub/service";
import { requireAdmin } from "@/lib/require-admin";

const idSchema = z.uuid();

async function notify(to: string, language: "fr" | "en", subject: string, text: string): Promise<boolean> {
  try {
    await sendMail({ to, subject, text });
    return true;
  } catch (error) {
    console.error("assistance Admin : e-mail non envoyé", error instanceof Error ? error.name : "erreur", language);
    return false;
  }
}

export async function resendInvitationAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const invitationId = idSchema.safeParse(formData.get("invitationId"));
  if (!invitationId.success) redirect("/admin/comptes?resultat=erreur");

  const { sql, db } = createAppConnection();
  let outcome = "invitation-envoyee";
  try {
    const resent = await resendInvitation(db, { adminUserId: admin.userId, invitationId: invitationId.data });
    const t = await getTranslations({ locale: resent.language, namespace: "AdminAccounts" });
    const link = `${parseEnv(process.env).APP_PUBLIC_URL}/invitations/${resent.token}`;
    const sent = await notify(resent.email, resent.language, t("inviteMailSubject"), t("inviteMailBody", { organization: resent.organizationName, link }));
    if (!sent) outcome = "e-mail-non-envoye";
  } catch (error) {
    if (!(error instanceof InvitationNotPendingError)) throw error;
    outcome = "erreur";
  } finally {
    await sql.end();
  }
  redirect(`/admin/comptes?resultat=${outcome}`);
}

export async function resetMfaAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const userId = idSchema.safeParse(formData.get("userId"));
  if (!userId.success || formData.get("confirm") !== "on") redirect("/admin/comptes?resultat=confirmation-requise");

  const { sql, db } = createAppConnection();
  let outcome = "double-authentification-reinitialisee";
  try {
    const account = await resetTeamAccountMfa(db, { adminUserId: admin.userId, userId: userId.data });
    const language = account.language ?? "fr";
    const t = await getTranslations({ locale: language, namespace: "AdminAccounts" });
    const sent = await notify(account.email, language, t("mfaResetMailSubject"), t("mfaResetMailBody", { link: `${parseEnv(process.env).APP_PUBLIC_URL}/login` }));
    if (!sent) outcome = "e-mail-non-envoye";
  } catch (error) {
    if (!(error instanceof MfaResetNotAllowedError)) throw error;
    outcome = "erreur";
  } finally {
    await sql.end();
  }
  redirect(`/admin/comptes?resultat=${outcome}`);
}
