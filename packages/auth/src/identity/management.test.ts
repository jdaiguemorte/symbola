// Lot 33 (SEC-07, ADR 0067) — client de l'API d'administration du fournisseur d'identité, avec un
// faux fetch : jeton machine à machine gardé puis renouvelé, lien magique de quinze minutes,
// recherche exacte par adresse, erreurs sans donnée personnelle.
import { describe, expect, it } from "vitest";
import { createManagementClient, identityConnectionFromEnv, IdentityProviderError, MAGIC_LINK_TTL_SECONDS } from "./management";

type Call = { url: string; method: string; body: string | undefined; authorization: string | undefined };

function fakeFetch(routes: Record<string, (call: Call) => { status?: number; json: unknown }>) {
  const calls: Call[] = [];
  const impl = (async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    const call: Call = { url, method: init?.method ?? "GET", body: init?.body?.toString(), authorization: headers.get("authorization") ?? undefined };
    calls.push(call);
    const path = new URL(url).pathname;
    const route = routes[`${call.method} ${path}`];
    if (!route) return new Response(JSON.stringify({ code: "test.not_found" }), { status: 404 });
    const { status = 200, json } = route(call);
    return new Response(status === 204 ? null : JSON.stringify(json), { status });
  }) as typeof fetch;
  return { impl, calls };
}

const connection = { endpoint: "http://identite.test/", m2mAppId: "symbola-bootstrap", m2mSecret: "secret-de-test-machine" };
const token = () => ({ json: { access_token: "jeton-machine", expires_in: 3600 } });

describe("SEC-01 — Client de l'API d'administration du fournisseur d'identité", () => {
  it("demande un jeton machine à machine pour l'API d'administration, le garde, puis le renouvelle une minute avant son expiration", async () => {
    let clock = 0;
    const { impl, calls } = fakeFetch({ "POST /oidc/token": token, "GET /api/users": () => ({ json: [] }) });
    const client = createManagementClient(connection, impl, () => clock);
    await client.findUserByEmail("a@example.test");
    await client.findUserByEmail("b@example.test");
    expect(calls.filter((call) => call.url.endsWith("/oidc/token"))).toHaveLength(1);
    const tokenCall = calls[0]!;
    expect(tokenCall.authorization).toBe(`Basic ${Buffer.from("symbola-bootstrap:secret-de-test-machine").toString("base64")}`);
    expect(new URLSearchParams(tokenCall.body)).toEqual(new URLSearchParams({ grant_type: "client_credentials", resource: "https://default.logto.app/api", scope: "all" }));
    expect(calls[1]!.authorization).toBe("Bearer jeton-machine");
    clock = (3600 - 59) * 1000;
    await client.findUserByEmail("c@example.test");
    expect(calls.filter((call) => call.url.endsWith("/oidc/token"))).toHaveLength(2);
  });

  it("SEC-07 — demande un jeton à usage unique de quinze minutes pour l'adresse donnée", async () => {
    const { impl, calls } = fakeFetch({ "POST /oidc/token": token, "POST /api/one-time-tokens": () => ({ status: 201, json: { token: "jeton-unique", expiresAt: 1 } }) });
    const client = createManagementClient(connection, impl);
    expect(MAGIC_LINK_TTL_SECONDS).toBe(900);
    await expect(client.createOneTimeToken("camille@example.test")).resolves.toEqual({ token: "jeton-unique", expiresAt: 1 });
    expect(JSON.parse(calls[1]!.body!)).toEqual({ email: "camille@example.test", expiresIn: 900 });
  });

  it("SEC-07 — émet le jeton pour l'adresse que le fournisseur connaît, avec sa casse ; sinon pour celle demandée", async () => {
    const { impl, calls } = fakeFetch({
      "POST /oidc/token": token,
      "GET /api/users": (call) => ({ json: new URL(call.url).searchParams.get("search.primaryEmail") === "camille@example.test" ? [{ id: "sub-1", primaryEmail: "Camille@Example.test" }] : [] }),
      "POST /api/one-time-tokens": () => ({ status: 201, json: { token: "jeton-unique", expiresAt: 1 } }),
    });
    const client = createManagementClient(connection, impl);
    await expect(client.issueSignInToken("camille@example.test")).resolves.toEqual({ token: "jeton-unique", expiresAt: 1, email: "Camille@Example.test" });
    expect(JSON.parse(calls.at(-1)!.body!)).toEqual({ email: "Camille@Example.test", expiresIn: 900 });
    await expect(client.issueSignInToken("nouvelle@example.test")).resolves.toMatchObject({ email: "nouvelle@example.test" });
    expect(JSON.parse(calls.at(-1)!.body!)).toEqual({ email: "nouvelle@example.test", expiresIn: 900 });
  });

  it("cherche un compte par son adresse exacte, et répond « aucun » sans erreur", async () => {
    const { impl, calls } = fakeFetch({ "POST /oidc/token": token, "GET /api/users": () => ({ json: [] }) });
    const client = createManagementClient(connection, impl);
    await expect(client.findUserByEmail("camille@example.test")).resolves.toBeNull();
    const query = new URL(calls[1]!.url).searchParams;
    expect(query.get("search.primaryEmail")).toBe("camille@example.test");
    expect(query.get("mode.primaryEmail")).toBe("exact");
  });

  it("une erreur du fournisseur nomme le chemin et le code, jamais l'adresse cherchée", async () => {
    const { impl } = fakeFetch({ "POST /oidc/token": token, "GET /api/users": () => ({ status: 500, json: { code: "guard.invalid_input" } }) });
    const client = createManagementClient(connection, impl);
    const error = await client.findUserByEmail("camille@example.test").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(IdentityProviderError);
    expect((error as IdentityProviderError).message).toBe("fournisseur d'identité : /api/users a répondu 500 (guard.invalid_input)");
    expect((error as Error).message).not.toContain("camille");
  });

  it("un secret machine à machine refusé arrête tout, sans jamais appeler l'API", async () => {
    const { impl, calls } = fakeFetch({ "POST /oidc/token": () => ({ status: 401, json: { error: "invalid_client" } }) });
    const client = createManagementClient(connection, impl);
    await expect(client.createOneTimeToken("camille@example.test")).rejects.toThrow("/oidc/token a répondu 401");
    expect(calls).toHaveLength(1);
  });

  it("lit la connexion dans les variables d'environnement validées", () => {
    expect(identityConnectionFromEnv({ LOGTO_ENDPOINT: "http://identite.test", LOGTO_M2M_APP_ID: "symbola-bootstrap", LOGTO_M2M_SECRET: "s".repeat(32) })).toEqual({
      endpoint: "http://identite.test",
      m2mAppId: "symbola-bootstrap",
      m2mSecret: "s".repeat(32),
    });
  });

  it("D4 — rend la double authentification obligatoire pour un compte, chez le fournisseur", async () => {
    const { impl, calls } = fakeFetch({ "POST /oidc/token": token, "PATCH /api/users/sub-1/logto-configs": () => ({ json: {} }) });
    await createManagementClient(connection, impl).requireMfa("sub-1");
    expect(calls[1]!.method).toBe("PATCH");
    expect(JSON.parse(calls[1]!.body!)).toEqual({ mfa: { enabled: true, required: true } });
  });

  it("retrouve l'application web de Symbola et son secret ; aucune application : null", async () => {
    const apps = [
      { id: "app-autre", name: "Autre", type: "Traditional" },
      { id: "app-symbola", name: "Symbola", type: "Traditional" },
    ];
    const { impl } = fakeFetch({
      "POST /oidc/token": token,
      "GET /api/applications": () => ({ json: apps }),
      "GET /api/applications/app-symbola/secrets": () => ({ json: [{ value: "secret-web" }] }),
    });
    const client = createManagementClient(connection, impl);
    await expect(client.findWebApplication("Symbola")).resolves.toEqual({ id: "app-symbola", secret: "secret-web" });
    await expect(client.findWebApplication("Inconnue")).resolves.toBeNull();
  });
});

describe("HUB-04 (lot 52) — Fermeture des sessions d'un compte chez le fournisseur (adaptateur)", () => {
  it("liste les sessions du compte, puis ferme chacune et révoque ses autorisations ; une session déjà fermée est ignorée", async () => {
    const { impl, calls } = fakeFetch({
      "POST /oidc/token": token,
      "GET /api/users/sub-1/sessions": () => ({ json: { sessions: [{ payload: { uid: "s-a" } }, { payload: { uid: "s-b" } }] } }),
      "DELETE /api/users/sub-1/sessions/s-a": () => ({ status: 204, json: null }),
      "DELETE /api/users/sub-1/sessions/s-b": () => ({ status: 404, json: { code: "oidc.session_not_found" } }),
    });
    const client = createManagementClient(connection, impl);
    await expect(client.closeAllSessions("sub-1")).resolves.toBe(2);
    const deletions = calls.filter((call) => call.method === "DELETE").map((call) => new URL(call.url));
    expect(deletions.map((url) => url.pathname)).toEqual(["/api/users/sub-1/sessions/s-a", "/api/users/sub-1/sessions/s-b"]);
    expect(deletions.every((url) => url.searchParams.get("revokeGrantsTarget") === "all")).toBe(true);
  });

  it("une autre erreur du fournisseur remonte, sans donnée personnelle", async () => {
    const { impl } = fakeFetch({
      "POST /oidc/token": token,
      "GET /api/users/sub-1/sessions": () => ({ status: 500, json: { code: "oidc.internal" } }),
    });
    const client = createManagementClient(connection, impl);
    await expect(client.closeAllSessions("sub-1")).rejects.toBeInstanceOf(IdentityProviderError);
  });
});

describe("SEC-08 (lot 52, D6) — Webhook du fournisseur d'identité", () => {
  it("crée le webhook de Symbola s'il manque, sur le changement des données d'un compte et la réinitialisation du mot de passe", async () => {
    const { impl, calls } = fakeFetch({
      "POST /oidc/token": token,
      "GET /api/hooks": () => ({ json: [] }),
      "POST /api/hooks": () => ({ status: 201, json: { id: "hook-1", name: "Symbola", signingKey: "cle" } }),
    });
    const client = createManagementClient(connection, impl);
    await expect(client.upsertWebhook({ name: "Symbola", url: "https://app.test/api/webhooks/identite" })).resolves.toMatchObject({ id: "hook-1" });
    const created = calls.find((call) => call.method === "POST" && call.url.endsWith("/api/hooks"))!;
    expect(JSON.parse(created.body!)).toEqual({ name: "Symbola", events: ["User.Data.Updated", "PostResetPassword"], config: { url: "https://app.test/api/webhooks/identite" }, enabled: true });
  });

  it("met à jour le webhook existant (commande rejouable) et lit sa clé de signature", async () => {
    const { impl, calls } = fakeFetch({
      "POST /oidc/token": token,
      "GET /api/hooks": () => ({ json: [{ id: "hook-1", name: "Symbola" }] }),
      "PATCH /api/hooks/hook-1": () => ({ json: { id: "hook-1", name: "Symbola" } }),
      "GET /api/hooks/hook-1": () => ({ json: { id: "hook-1", name: "Symbola", signingKey: "cle-secrete" } }),
    });
    const client = createManagementClient(connection, impl);
    await client.upsertWebhook({ name: "Symbola", url: "https://app.test/api/webhooks/identite" });
    expect(calls.some((call) => call.method === "PATCH")).toBe(true);
    await expect(client.findWebhookSigningKey("Symbola")).resolves.toBe("cle-secrete");
    await expect(client.findWebhookSigningKey("Autre")).resolves.toBeNull();
  });
});

describe("RGP-11 (lot 35c) — Effacement d'un compte chez le fournisseur, à la suppression de son dernier espace (adaptateur)", () => {
  it("supprime le compte ; un compte déjà absent n'est pas une erreur ; une autre erreur remonte", async () => {
    const { impl, calls } = fakeFetch({
      "POST /oidc/token": token,
      "DELETE /api/users/sub-1": () => ({ status: 204, json: null }),
      "DELETE /api/users/sub-3": () => ({ status: 500, json: { code: "oidc.internal" } }),
    });
    const client = createManagementClient(connection, impl);
    await client.deleteUser("sub-1");
    await client.deleteUser("sub-2");
    await expect(client.deleteUser("sub-3")).rejects.toBeInstanceOf(IdentityProviderError);
    expect(calls.filter((call) => call.method === "DELETE").map((call) => new URL(call.url).pathname)).toEqual(["/api/users/sub-1", "/api/users/sub-2", "/api/users/sub-3"]);
  });
});
