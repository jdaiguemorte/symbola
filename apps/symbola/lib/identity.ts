// Lot 33 (SEC-01, SEC-07, HUB-01, ADR 0067) — plomberie de l'app autour du fournisseur
// d'identité : clients (API d'administration, OpenID Connect), demande d'autorisation en cours
// gardée dans un cookie court, envoi du lien magique. La logique d'authentification reste dans
// @symbola/auth.
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { createManagementClient, createOidcClient, MAGIC_LINK_TTL_SECONDS, readMfaEncryptionKey, sealMagicLink, type ManagementClient, type OidcClient, type PendingAuthorization } from "@symbola/auth";
import { parseEnv } from "@symbola/env";
import { sendMail } from "@symbola/mail";

type Identity = { management: ManagementClient; oidc: OidcClient; appPublicUrl: string };
let identityClients: Identity | null = null;

export function identity(): Identity {
  if (!identityClients) {
    const env = parseEnv(process.env);
    const connection = { endpoint: env.LOGTO_ENDPOINT, m2mAppId: env.LOGTO_M2M_APP_ID, m2mSecret: env.LOGTO_M2M_SECRET };
    const management = createManagementClient(connection);
    identityClients = { management, oidc: createOidcClient({ ...connection, appPublicUrl: env.APP_PUBLIC_URL }, management), appPublicUrl: env.APP_PUBLIC_URL.replace(/\/+$/, "") };
  }
  return identityClients;
}

// Demande d'autorisation en cours (état, nonce, vérificateur PKCE) : cookie httpOnly limité aux
// routes /auth, dix minutes. SameSite=Lax : le retour du fournisseur est une navigation de
// premier niveau, le cookie l'accompagne.
const PENDING_COOKIE = "symbola_connexion";
const PENDING_MAX_AGE_S = 10 * 60;

export async function rememberPendingAuthorization(pending: PendingAuthorization): Promise<void> {
  (await cookies()).set(PENDING_COOKIE, Buffer.from(JSON.stringify(pending), "utf8").toString("base64url"), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/auth",
    maxAge: PENDING_MAX_AGE_S,
  });
}

export async function takePendingAuthorization(): Promise<PendingAuthorization | null> {
  const store = await cookies();
  const value = store.get(PENDING_COOKIE)?.value;
  store.delete({ name: PENDING_COOKIE, path: "/auth" });
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<PendingAuthorization>;
    if (typeof parsed.state !== "string" || typeof parsed.nonce !== "string" || typeof parsed.codeVerifier !== "string") return null;
    return { state: parsed.state, nonce: parsed.nonce, codeVerifier: parsed.codeVerifier };
  } catch {
    return null;
  }
}

// SEC-07 : demande au fournisseur un jeton à usage unique de quinze minutes, puis envoie le lien
// scellé, avec les textes de Symbola, dans la langue de l'écran. Une adresse inconnue reçoit le
// même lien : il l'inscrit (HUB-01). Un échec d'envoi ne change pas la réponse à l'écran ; le
// journal ne garde que le type d'erreur.
export async function sendMagicLink(email: string, locale: "fr" | "en"): Promise<void> {
  const { management, appPublicUrl } = identity();
  try {
    const { token } = await management.createOneTimeToken(email);
    const sealed = sealMagicLink({ email, token, expiresAt: Date.now() + MAGIC_LINK_TTL_SECONDS * 1000 }, readMfaEncryptionKey());
    const t = await getTranslations({ locale, namespace: "Login" });
    await sendMail({ to: email, subject: t("magicLinkSubject"), text: t("magicLinkBody", { link: `${appPublicUrl}/auth/lien/${sealed}` }) });
  } catch (error) {
    console.error("lien de connexion : envoi impossible", error instanceof Error ? error.name : "erreur");
  }
}
