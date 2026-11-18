"use server";

// Lot 33 (D4) — la double authentification devient obligatoire chez le fournisseur, puis un lien de
// connexion part à l'adresse du compte : le fournisseur fait installer le second facteur s'il
// manque, le demande, et la session repart avec la double authentification.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { accountIdentity, closeAccountSession, closeAllAccountSessions, disownDeviceAlert, dismissMfaPrompt, revokeOtherSessions } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { clearSessionCookie, getAuthContext, getSessionToken } from "@/lib/auth-context";
import { requirePendingMfa } from "@/lib/guards";
import { closeProviderSessions, requireMfaAtProvider, sendMagicLink } from "@/lib/identity";
import { checkRateLimit } from "@/lib/rate-limit";

export type SecurityLinkState = { sent?: boolean };

export async function sendSecurityLinkAction(_previous: SecurityLinkState): Promise<SecurityLinkState> {
  const pending = await requirePendingMfa();
  const account = await accountIdentity(appDatabase(), pending.userId);
  if (account?.idpSubject) await requireMfaAtProvider(account.idpSubject);
  if (account) await sendMagicLink(account.email, (await getLocale()) === "en" ? "en" : "fr");
  return { sent: true };
}

// —— Lot 52 (HUB-05, SEC-02, SEC-08 ; D4, D5 ; ADR 0094) ——————————————————————————————————————————

const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// « Plus tard » : le bandeau de double authentification revient dans un mois.
export async function dismissMfaPromptAction(): Promise<void> {
  const auth = await getAuthContext();
  if (auth.status !== "authenticated") return;
  await dismissMfaPrompt(appDatabase(), auth.user.id);
  revalidatePath("/", "layout");
}

// « Fermer » une session de son compte ; la dernière fermée ferme aussi la session du fournisseur.
export async function closeSessionAction(formData: FormData): Promise<void> {
  const auth = await getAuthContext();
  if (auth.status !== "authenticated") redirect("/login");
  const sessionId = String(formData.get("sessionId") ?? "");
  if (!SESSION_ID.test(sessionId) || sessionId === auth.user.sessionId) redirect("/securite");
  const db = appDatabase();
  const outcome = await closeAccountSession(db, { userId: auth.user.id, sessionId });
  if (outcome.status === "closed" && outcome.remaining === 0) {
    const account = await accountIdentity(db, auth.user.id);
    if (account?.idpSubject) await closeProviderSessions(account.idpSubject);
  }
  revalidatePath("/securite");
  redirect(outcome.status === "closed" ? "/securite?ferme=1" : "/securite");
}

// « Fermer toutes les autres » : seule la session en cours reste.
export async function closeOtherSessionsAction(): Promise<void> {
  const auth = await getAuthContext();
  if (auth.status !== "authenticated") redirect("/login");
  const closed = await revokeOtherSessions(appDatabase(), { userId: auth.user.id, currentSessionToken: await getSessionToken() });
  revalidatePath("/securite");
  redirect(`/securite?fermees=${closed}`);
}

export type DisownState = { done?: boolean; invalid?: boolean };

// « Ce n'est pas moi » (lien de l'alerte de nouvel appareil, jeton après « # », reçu ici en POST) :
// toutes les sessions du compte sont fermées, chez Symbola et chez le fournisseur ; la personne est
// ensuite invitée à vérifier son compte. Un lien inconnu, utilisé ou expiré : la même réponse.
export async function disownDeviceAction(_previous: DisownState, formData: FormData): Promise<DisownState> {
  const token = String(formData.get("token") ?? "");
  const limit = await checkRateLimit("linkOpen", { account: `pas-moi:${token.slice(0, 8)}` });
  if (!limit.allowed) return { invalid: true };
  const db = appDatabase();
  const disowned = await disownDeviceAlert(db, token);
  if (!disowned) return { invalid: true };
  await closeAllAccountSessions(db, { userId: disowned.userId, reason: "not_me" });
  if (disowned.idpSubject) await closeProviderSessions(disowned.idpSubject);
  await clearSessionCookie();
  return { done: true };
}
