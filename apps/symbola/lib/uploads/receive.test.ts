// Lot 16 (SEC-02, ADR 0044) — réception d'un envoi de fichier par une route
// dédiée : origine, session, limite de débit et taille vérifiées avant la
// lecture du corps.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthResult } from "@symbola/auth";

const state = vi.hoisted(() => ({
  auth: { status: "unauthenticated" } as AuthResult,
  limited: false,
  authCalls: 0,
}));

vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string, values?: Record<string, unknown>) => (values ? `${key} ${JSON.stringify(values)}` : key),
  getLocale: async () => "fr",
}));
vi.mock("@/lib/auth-context", () => ({
  getPlannerAuthContext: async () => {
    state.authCalls += 1;
    return state.auth;
  },
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: async () => (state.limited ? { allowed: false, bucket: "upload.account", retryAfterSeconds: 120 } : { allowed: true }),
  rateLimitedResponse: async () => Response.json({ error: "tooMany" }, { status: 429, headers: { "Retry-After": "120" } }),
}));

const { isSameOrigin, receiveUpload } = await import("./receive");

const ORIGIN = { origin: "http://localhost:3000", host: "localhost:3000" };

function upload(body: BodyInit, headers: Record<string, string> = ORIGIN): Request {
  return new Request("http://localhost:3000/prestataires/x/fichiers", { method: "POST", body, headers, duplex: "half" } as RequestInit & { duplex: "half" });
}

function filesForm(bytes: number): FormData {
  const data = new FormData();
  data.set("file", new File([new Uint8Array(bytes)], "devis.pdf", { type: "application/pdf" }));
  return data;
}

describe("SEC-02 — Envoi de fichier par une route dédiée", () => {
  beforeEach(() => {
    state.auth = { status: "authenticated", user: { id: "user-1", email: "planner@symbola.test", role: "owner", organizationId: "org-1", language: null, firstStepsHidden: false, mfaEnabled: true } } as AuthResult;
    state.limited = false;
    state.authCalls = 0;
  });

  it("la même origine que l'app est exigée, comme pour une action serveur", () => {
    expect(isSameOrigin(new Headers(ORIGIN))).toBe(true);
    expect(isSameOrigin(new Headers({ origin: "https://staging.symbola.fr", host: "symbola-app:3000", "x-forwarded-host": "staging.symbola.fr" }))).toBe(true);
    expect(isSameOrigin(new Headers({ origin: "https://pirate.example", host: "localhost:3000" }))).toBe(false);
    expect(isSameOrigin(new Headers({ host: "localhost:3000" }))).toBe(false);
  });

  it("une page d'une autre origine est refusée avant même le contrôle de session", async () => {
    const result = await receiveUpload(upload(filesForm(10), { origin: "https://pirate.example", host: "localhost:3000" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
    expect(state.authCalls).toBe(0);
  });

  it("sans session de l'équipe : 401 et un message, sans lire le fichier", async () => {
    state.auth = { status: "unauthenticated" };
    const result = await receiveUpload(upload(filesForm(10)));
    expect(result.ok ? 200 : result.response.status).toBe(401);
    if (!result.ok) expect(await result.response.json()).toEqual({ error: "unauthenticated" });
  });

  it("au-delà de la limite de débit : 429, le délai et le message traduit", async () => {
    state.limited = true;
    const result = await receiveUpload(upload(filesForm(10)));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(429);
      expect(result.response.headers.get("Retry-After")).toBe("120");
    }
  });

  it("une taille annoncée trop grande est refusée (413) sans lire le corps", async () => {
    const result = await receiveUpload(upload(filesForm(10), { ...ORIGIN, "content-length": String(30 * 1024 * 1024) }), 1024);
    expect(result.ok ? 200 : result.response.status).toBe(413);
  });

  it("un corps qui dépasse la limite en cours de lecture est coupé (413), même sans taille annoncée", async () => {
    const big = new Uint8Array(4096);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('--b\r\nContent-Disposition: form-data; name="file"; filename="a.pdf"\r\n\r\n'));
        for (let i = 0; i < 4; i += 1) controller.enqueue(big);
        controller.enqueue(new TextEncoder().encode("\r\n--b--\r\n"));
        controller.close();
      },
    });
    const result = await receiveUpload(upload(stream, { ...ORIGIN, "content-type": "multipart/form-data; boundary=b" }), 8192);
    expect(result.ok ? 200 : result.response.status).toBe(413);
  });

  it("un envoi accepté rend le formulaire et la planner, organisation comprise", async () => {
    const result = await receiveUpload(upload(filesForm(2048)));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user).toMatchObject({ id: "user-1", organizationId: "org-1" });
      expect((result.formData.get("file") as File).size).toBe(2048);
    }
  });
});
