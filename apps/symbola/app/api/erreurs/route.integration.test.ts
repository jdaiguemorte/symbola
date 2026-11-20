// Lot 40b (Q27, NFR-16, SEC-20 ; décision D14, ADR 0077) — relais des erreurs du navigateur, appelé
// comme le ferait la page : même origine seulement, taille et contenu bornés, débit limité par
// adresse IP (vraie base, rate_limit_events) ; ce qui part au suivi (un faux GlitchTip, serveur HTTP
// local) ne porte ni message, ni adresse complète, ni personne.
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST } from "./route";

let server: Server;
const received: { url: string; auth: string; body: string }[] = [];

beforeAll(async () => {
  server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => (body += chunk));
    request.on("end", () => {
      received.push({ url: request.url ?? "", auth: String(request.headers["x-sentry-auth"] ?? ""), body });
      response.writeHead(200).end("{}");
    });
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  process.env.ERROR_TRACKING_DSN = `http://cle-test@127.0.0.1:${(server.address() as AddressInfo).port}/7`;
});

afterAll(async () => {
  delete process.env.ERROR_TRACKING_DSN;
  await new Promise((done) => server.close(done));
});

// Une adresse de documentation (RFC 3849) par appel de test, tirée sur 64 bits : les compteurs de débit
// ne se mêlent pas. Tirée parmi 253 adresses IPv4, l'adresse du test de débit retombait parfois sur
// celle d'un appel précédent du même fichier, et le test échouait sur un 429 venu trop tôt.
const ip = () => `2001:db8:${randomBytes(8).toString("hex").match(/.{4}/g)!.join(":")}::1`;

function post(body: string, headers: Record<string, string> = {}, from = ip()) {
  return POST(
    new Request("http://symbola.test/api/erreurs", {
      method: "POST",
      body,
      headers: { "content-type": "application/json", origin: "http://symbola.test", host: "symbola.test", "x-forwarded-for": from, ...headers },
    }),
  );
}

const report = {
  reference: "7KQ2-M9XD",
  name: "TypeError",
  stack: "TypeError: valeur de lea@example.org illisible\n    at render (https://symbola.test/_next/static/chunks/app.js?dpl=1:10:20)",
  route: "/contacts/0f8fad5b-d9cb-469f-a165-70867728950e?q=lea@example.org",
};

describe("Q27 — Relais des erreurs du navigateur (/api/erreurs)", () => {
  it("relaie l'erreur au suivi, triée : référence, type, pile et route nettoyée, sans message ni adresse e-mail", async () => {
    received.length = 0;
    expect((await post(JSON.stringify(report))).status).toBe(204);
    expect(received).toHaveLength(1);
    expect(received[0]!.url).toBe("/api/7/envelope/");
    expect(received[0]!.auth).toContain("sentry_key=cle-test");
    const event = JSON.parse(received[0]!.body.trim().split("\n")[2]!);
    expect(event).toMatchObject({ platform: "javascript", transaction: "/contacts/[id]", tags: { reference: "7KQ2-M9XD", source: "navigateur" } });
    expect(received[0]!.body).not.toContain("lea@example.org");
    expect(received[0]!.body).not.toContain("illisible");
  });

  it("refuse (403) un appel d'une autre origine, ou sans origine, sans rien relayer", async () => {
    received.length = 0;
    expect((await post(JSON.stringify(report), { origin: "https://ailleurs.example" })).status).toBe(403);
    expect((await post(JSON.stringify(report), { origin: "" })).status).toBe(403);
    expect(received).toHaveLength(0);
  });

  it("refuse un corps démesuré (413) ou mal formé (400), sans rien relayer", async () => {
    received.length = 0;
    expect((await post("x".repeat(20_000))).status).toBe(413);
    expect((await post("pas du JSON")).status).toBe(400);
    expect((await post(JSON.stringify({ ...report, reference: "<script>" }))).status).toBe(400);
    expect((await post(JSON.stringify({ ...report, name: "x".repeat(200) }))).status).toBe(400);
    expect(received).toHaveLength(0);
  });

  it("limite le débit par adresse IP (429 au-delà de 30 en un quart d'heure)", async () => {
    const from = ip();
    for (let attempt = 0; attempt < 30; attempt += 1) expect((await post(JSON.stringify(report), {}, from)).status).toBe(204);
    expect((await post(JSON.stringify(report), {}, from)).status).toBe(429);
  });
});
