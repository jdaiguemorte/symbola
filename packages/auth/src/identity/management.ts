// Lot 33 (SEC-01, SEC-07, ADR 0067) — client de l'API d'administration du fournisseur d'identité
// (Logto). Jeton machine à machine (client_credentials), gardé jusqu'à une minute de son
// expiration. Aucune donnée personnelle dans les erreurs ni les journaux : le chemin et le statut.
import { z } from "zod";

export const IDENTITY_MANAGEMENT_RESOURCE = "https://default.logto.app/api";
// SEC-07 : un lien magique vaut quinze minutes.
export const MAGIC_LINK_TTL_SECONDS = 15 * 60;

export type IdentityConnection = { endpoint: string; m2mAppId: string; m2mSecret: string };

export class IdentityProviderError extends Error {
  constructor(
    readonly path: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(`fournisseur d'identité : ${path} a répondu ${status}${code ? ` (${code})` : ""}`);
    this.name = "IdentityProviderError";
  }
}

const tokenResponse = z.object({ access_token: z.string().min(1), expires_in: z.number().positive() });
const oneTimeToken = z.object({ token: z.string().min(1), expiresAt: z.number() });
const identityUser = z.object({ id: z.string().min(1), primaryEmail: z.string().nullable() });
const mfaVerification = z.object({ id: z.string(), type: z.string() });
const application = z.object({ id: z.string().min(1), name: z.string(), type: z.string() });
const applicationSecret = z.object({ value: z.string().min(1) });

export type IdentityUser = z.infer<typeof identityUser>;

export function createManagementClient(connection: IdentityConnection, fetchImpl: typeof fetch = fetch, now: () => number = Date.now) {
  const base = connection.endpoint.replace(/\/+$/, "");
  let cached: { token: string; refreshAt: number } | null = null;

  async function accessToken(): Promise<string> {
    if (cached && cached.refreshAt > now()) return cached.token;
    const response = await fetchImpl(`${base}/oidc/token`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        authorization: `Basic ${Buffer.from(`${connection.m2mAppId}:${connection.m2mSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({ grant_type: "client_credentials", resource: IDENTITY_MANAGEMENT_RESOURCE, scope: "all" }),
    });
    if (!response.ok) throw new IdentityProviderError("/oidc/token", response.status);
    const parsed = tokenResponse.parse(await response.json());
    cached = { token: parsed.access_token, refreshAt: now() + Math.max(0, parsed.expires_in - 60) * 1000 };
    return parsed.access_token;
  }

  async function request(method: string, path: string, body?: unknown): Promise<unknown> {
    const response = await fetchImpl(`${base}${path}`, {
      method,
      headers: { authorization: `Bearer ${await accessToken()}`, ...(body === undefined ? {} : { "content-type": "application/json" }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    const payload: unknown = text ? JSON.parse(text) : null;
    if (!response.ok) {
      const code = typeof payload === "object" && payload && "code" in payload ? String(payload.code) : undefined;
      throw new IdentityProviderError(path.replace(/\?.*$/, ""), response.status, code);
    }
    return payload;
  }

  return {
    request,

    // SEC-07 : jeton à usage unique ; le lien est construit et envoyé par Symbola.
    async createOneTimeToken(email: string, expiresInSeconds = MAGIC_LINK_TTL_SECONDS) {
      return oneTimeToken.parse(await request("POST", "/api/one-time-tokens", { email, expiresIn: expiresInSeconds }));
    },

    async findUserByEmail(email: string): Promise<IdentityUser | null> {
      const query = new URLSearchParams({ "search.primaryEmail": email, "mode.primaryEmail": "exact" });
      const users = z.array(identityUser).parse(await request("GET", `/api/users?${query.toString()}`));
      return users[0] ?? null;
    },

    // Reprise des comptes (partie F) : adresse seule, vérifiée par la confiance déjà accordée.
    async createUser(email: string): Promise<IdentityUser> {
      return identityUser.parse(await request("POST", "/api/users", { primaryEmail: email }));
    },

    async listMfaVerifications(userId: string): Promise<{ id: string; type: string }[]> {
      return z.array(mfaVerification).parse(await request("GET", `/api/users/${encodeURIComponent(userId)}/mfa-verifications`));
    },

    // D4 : la double authentification devient obligatoire pour ce compte chez le fournisseur ;
    // sans second facteur, il le fait installer pendant la connexion, puis le demande à chaque
    // connexion. Réglage d'administration, que la personne ne peut pas retirer elle-même.
    async requireMfa(userId: string): Promise<void> {
      await request("PATCH", `/api/users/${encodeURIComponent(userId)}/logto-configs`, { mfa: { enabled: true, required: true } });
    },

    async deleteMfaVerification(userId: string, verificationId: string): Promise<void> {
      await request("DELETE", `/api/users/${encodeURIComponent(userId)}/mfa-verifications/${encodeURIComponent(verificationId)}`);
    },

    // L'application web de Symbola, créée par configure-identity : son identifiant et son secret.
    async findWebApplication(name: string): Promise<{ id: string; secret: string } | null> {
      const apps = z.array(application).parse(await request("GET", "/api/applications?types=Traditional"));
      const app = apps.find((candidate) => candidate.name === name && candidate.type === "Traditional");
      if (!app) return null;
      const secrets = z.array(applicationSecret).parse(await request("GET", `/api/applications/${app.id}/secrets`));
      const secret = secrets[0]?.value;
      return secret ? { id: app.id, secret } : null;
    },
  };
}

export type ManagementClient = ReturnType<typeof createManagementClient>;
