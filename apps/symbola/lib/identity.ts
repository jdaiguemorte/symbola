// Lot 33 (SEC-01, SEC-07, HUB-01, ADR 0067) — plomberie de l'app autour du fournisseur
// d'identité : clients (API d'administration, OpenID Connect), demande d'autorisation en cours
// gardée dans un cookie court, envoi du lien magique. La logique d'authentification reste dans
// @symbola/auth.
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { createManagementClient, createOidcClient, IDENTITY_WEBHOOK_NAME, identityConnectionFromEnv, MAGIC_LINK_TTL_SECONDS, mfaFactorsFingerprint, readMfaEncryptionKey, sealMagicLink, type ManagementClient, type OidcClient, type PendingAuthorization } from "@symbola/auth";
import { parseEnv } from "@symbola/env";
import { sendSymbolaEmail } from "@/modules/hub/service";
import { secureCookies } from "./cookie-security";

type Identity = { management: ManagementClient; oidc: OidcClient; appPublicUrl: string };
let identityClients: Identity | null = null;

export function identity(): Identity {
  if (!identityClients) {
    const env = parseEnv(process.env);
    const connection = identityConnectionFromEnv(env);
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
    secure: secureCookies(),
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

// D4 : exige la double authentification de ce compte chez le fournisseur. Un échec ne bloque pas
// la connexion : la page « Sécurisez votre compte » la redemande.
export async function requireMfaAtProvider(subject: string): Promise<void> {
  try {
    await identity().management.requireMfa(subject);
  } catch (error) {
    console.error("double authentification : réglage chez le fournisseur impossible", error instanceof Error ? error.name : "erreur");
  }
}

// SEC-07 : demande au fournisseur un jeton à usage unique de quinze minutes, puis envoie le lien
// scellé, avec les textes de Symbola, dans la langue de l'écran. Une adresse inconnue reçoit le
// même lien : il l'inscrit (HUB-01). Un échec d'envoi ne change pas la réponse à l'écran ; le
// journal ne garde que le type d'erreur.
export async function sendMagicLink(email: string, locale: "fr" | "en"): Promise<void> {
  const { management, appPublicUrl } = identity();
  try {
    // Adresse exacte connue du fournisseur (casse comprise) : c'est elle que le lien lui rend.
    const issued = await management.issueSignInToken(email);
    const sealed = sealMagicLink({ email: issued.email, token: issued.token, expiresAt: Date.now() + MAGIC_LINK_TTL_SECONDS * 1000 }, readMfaEncryptionKey());
    const t = await getTranslations({ locale, namespace: "Login" });
    // Lot 38a (D3) : la même mise en page que les autres e-mails de Symbola.
    const link = `${appPublicUrl}/auth/lien/${sealed}`;
    await sendSymbolaEmail({ to: email, locale, subject: t("magicLinkSubject"), body: t("magicLinkBody", { link }), button: { label: t("magicLinkButton"), url: link } });
  } catch (error) {
    console.error("lien de connexion : envoi impossible", error instanceof Error ? error.name : "erreur");
  }
}

// Lot 52 (SEC-08, D6) : la clé de signature du webhook, lue chez le fournisseur et gardée en mémoire
// cinq minutes (relue aussitôt si une signature ne correspond plus : clé changée).
const SIGNING_KEY_CACHE_MS = 5 * 60 * 1000;
let signingKeyCache: { key: string | null; until: number } | null = null;

export async function identityWebhookSigningKey(options: { refresh: boolean }): Promise<string | null> {
  if (!options.refresh && signingKeyCache && signingKeyCache.until > Date.now()) return signingKeyCache.key;
  try {
    const key = await identity().management.findWebhookSigningKey(IDENTITY_WEBHOOK_NAME);
    signingKeyCache = { key, until: Date.now() + SIGNING_KEY_CACHE_MS };
    return key;
  } catch (error) {
    console.error("webhook du fournisseur d'identité : clé de signature illisible", error instanceof Error ? error.name : "erreur");
    return null;
  }
}

export async function identityFactorsFingerprint(subject: string): Promise<string | null> {
  try {
    return mfaFactorsFingerprint(await identity().management.listMfaVerifications(subject));
  } catch (error) {
    console.error("webhook du fournisseur d'identité : facteurs illisibles", error instanceof Error ? error.name : "erreur");
    return null;
  }
}

// HUB-04, HUB-05, SEC-08 : ferme toutes les sessions d'un compte chez le fournisseur. Un échec ne
// bloque rien (les sessions Symbola sont déjà fermées) ; le journal ne garde que le type d'erreur.
export async function closeProviderSessions(subject: string): Promise<void> {
  try {
    await identity().management.closeAllSessions(subject);
  } catch (error) {
    console.error("sessions du fournisseur : fermeture impossible", error instanceof Error ? error.name : "erreur");
  }
}

// Le centre de compte du fournisseur (adresse, mot de passe, clé d'accès, double authentification).
export function accountCenterUrl(): string {
  return `${parseEnv(process.env).LOGTO_ENDPOINT.replace(/\/+$/, "")}/account/security`;
}
