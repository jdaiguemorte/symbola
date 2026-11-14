// Lot 33 (SEC-01, SEC-07, ADR 0067) — connexion par OpenID Connect au fournisseur d'identité :
// flux « code » avec PKCE, par openid-client (aucun contrôle de jeton écrit à la main).
//
// La demande d'autorisation est toujours poussée de serveur à serveur (PAR) : l'adresse e-mail
// (login_hint) et le jeton du lien magique ne paraissent jamais dans une adresse vue par le
// navigateur, ni dans les journaux. Le navigateur ne reçoit qu'une référence opaque.
import * as client from "openid-client";
import { z } from "zod";
import { createManagementClient, type IdentityConnection, type ManagementClient } from "./management";
import { WEB_APPLICATION_NAME } from "./settings";

// Niveau d'authentification que le fournisseur déclare après une double authentification.
export const MFA_ACR = "urn:logto:acr:mfa";

export type PendingAuthorization = { state: string; nonce: string; codeVerifier: string };
export type IdentityClaims = { subject: string; email: string; mfa: boolean };

export class IdentityClaimsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IdentityClaimsError";
  }
}

const claimsSchema = z.object({
  sub: z.string().min(1),
  email: z.string().email(),
  email_verified: z.literal(true),
  acr: z.string().optional(),
});

export type OidcSettings = IdentityConnection & { appPublicUrl: string };

export function createOidcClient(settings: OidcSettings, management: ManagementClient = createManagementClient(settings)) {
  const redirectUri = `${settings.appPublicUrl.replace(/\/+$/, "")}/auth/callback`;
  let configuration: Promise<client.Configuration> | null = null;

  function config(): Promise<client.Configuration> {
    configuration ??= (async () => {
      const web = await management.findWebApplication(WEB_APPLICATION_NAME);
      if (!web) throw new Error("application web de Symbola absente chez le fournisseur : lancer configure-identity");
      const issuer = new URL(`${settings.endpoint.replace(/\/+$/, "")}/oidc`);
      // http seulement en local (dev, CI) ; en environnement, l'adresse est en https.
      const options = issuer.protocol === "http:" ? { execute: [client.allowInsecureRequests] } : undefined;
      return client.discovery(issuer, web.id, web.secret, undefined, options);
    })().catch((error: unknown) => {
      configuration = null;
      throw error;
    });
    return configuration;
  }

  return {
    redirectUri,

    // Adresse d'autorisation à ouvrir dans le navigateur, et ce qu'il faut garder pour le retour.
    // loginHint et oneTimeToken : lien magique (SEC-07) ; sans eux, la page du fournisseur
    // (mot de passe, clé d'accès, code par e-mail).
    async authorize(input: { loginHint?: string; oneTimeToken?: string; locale: "fr" | "en" }): Promise<{ url: URL; pending: PendingAuthorization }> {
      const pending: PendingAuthorization = { state: client.randomState(), nonce: client.randomNonce(), codeVerifier: client.randomPKCECodeVerifier() };
      const parameters: Record<string, string> = {
        redirect_uri: redirectUri,
        scope: "openid email",
        code_challenge: await client.calculatePKCECodeChallenge(pending.codeVerifier),
        code_challenge_method: "S256",
        state: pending.state,
        nonce: pending.nonce,
        prompt: "login",
        ui_locales: input.locale,
      };
      if (input.loginHint) parameters.login_hint = input.loginHint;
      if (input.oneTimeToken) parameters.one_time_token = input.oneTimeToken;
      const url = await client.buildAuthorizationUrlWithPAR(await config(), parameters);
      return { url, pending };
    },

    // Retour du fournisseur : code échangé, jeton d'identité vérifié (signature, émetteur,
    // audience, nonce, état), adresse vérifiée exigée. L'adresse de retour est rebâtie depuis
    // l'adresse publique de l'app (derrière le proxy, la requête porte une adresse interne).
    async complete(callbackParameters: URLSearchParams, pending: PendingAuthorization): Promise<IdentityClaims> {
      const callbackUrl = new URL(redirectUri);
      callbackUrl.search = callbackParameters.toString();
      const tokens = await client.authorizationCodeGrant(await config(), callbackUrl, {
        pkceCodeVerifier: pending.codeVerifier,
        expectedState: pending.state,
        expectedNonce: pending.nonce,
      });
      const parsed = claimsSchema.safeParse(tokens.claims());
      if (!parsed.success) throw new IdentityClaimsError("jeton d'identité sans adresse vérifiée");
      return { subject: parsed.data.sub, email: parsed.data.email.toLowerCase(), mfa: parsed.data.acr === MFA_ACR };
    },

    // Sortie : la session du fournisseur se ferme aussi, puis retour sur la page de connexion.
    async endSessionUrl(): Promise<URL> {
      const configured = await config();
      return client.buildEndSessionUrl(configured, { client_id: configured.clientMetadata().client_id, post_logout_redirect_uri: `${settings.appPublicUrl.replace(/\/+$/, "")}/login` });
    },
  };
}

export type OidcClient = ReturnType<typeof createOidcClient>;
