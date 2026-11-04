// DEV-02 — « le faux fournisseur remplace le vrai sans changer le module
// Devis » : la même suite s'exécute contre les deux implémentations ;
// l'adaptateur Documenso y parle à un serveur HTTP simulé qui reproduit les
// réponses de l'API v2 observées sur un vrai Documenso (ADR 0026).
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DocumensoSignatureProvider } from "./documenso";
import { FakeSignatureProvider } from "./fake";
import type { SignatureProvider } from "./provider";

const PDF = Buffer.from("%PDF-1.4\n%%EOF\n", "latin1");
const SIGNERS = [
  { externalId: "org.signer-1", name: "Inès", email: "ines@example.test", role: "Signataire 1" },
  { externalId: "org.signer-2", name: "Sacha", email: "sacha@example.test", role: "Signataire 2" },
];

// Pilote propre à chaque implémentation : fait signer ou refuser un
// signataire, renvoie le corps du webhook et des en-têtes valides.
type Driver = {
  provider: SignatureProvider;
  act(requestId: string, signerExternalId: string, action: "sign" | "decline"): Promise<string>;
  validHeaders(): Headers;
  wrongHeaders(): Headers;
};

// --- Serveur Documenso (API v2) simulé ---

type SimRecipient = { id: number; name: string; email: string; signingOrder: number; signingStatus: string; signedAt: string | null; token: string };
type SimField = { id: number; recipientId: number; type: string; page: number; positionX: number; positionY: number; width: number; height: number };
type SimEnvelope = {
  id: string;
  externalId: string;
  status: string;
  distributed: boolean;
  distributionMethod: string | undefined;
  recipients: SimRecipient[];
  fields: SimField[];
  pdf: Buffer;
};

const API_KEY = "api_cle-de-test";
let server: Server;
let baseUrl = "";
const envelopes = new Map<string, SimEnvelope>();
let nextId = 100;

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

function publicEnvelope(envelope: SimEnvelope) {
  return {
    id: envelope.id,
    externalId: envelope.externalId,
    status: envelope.status,
    recipients: envelope.recipients.map(({ token: _token, ...recipient }) => recipient),
    // Comme le vrai Documenso : positions et tailles renvoyées en texte.
    fields: envelope.fields.map((field) => ({ ...field, positionX: String(field.positionX), positionY: String(field.positionY), width: String(field.width), height: String(field.height) })),
    envelopeItems: [{ id: `${envelope.id}_item`, title: "devis.pdf" }],
  };
}

beforeAll(async () => {
  server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (req.headers.authorization !== API_KEY) return json(res, 401, { message: "Unauthorized" });

    if (req.method === "POST" && url.pathname === "/api/v2/envelope/create") {
      // multipart/form-data : « payload » (JSON) et « files » (le PDF).
      const request = new Request("http://localhost", { method: "POST", headers: { "content-type": req.headers["content-type"]! }, body: new Uint8Array(await readBody(req)) });
      const form = await request.formData();
      const payload = JSON.parse(String(form.get("payload"))) as {
        title: string;
        type: string;
        externalId: string;
        recipients: { name: string; email: string; role: string; signingOrder: number }[];
        meta?: { distributionMethod?: string; language?: string };
      };
      const file = form.get("files") as File;
      const id = `envelope_${nextId++}`;
      const recipients = payload.recipients.map((recipient, index) => ({
        id: nextId * 10 + index,
        name: recipient.name,
        email: recipient.email,
        signingOrder: recipient.signingOrder,
        signingStatus: "NOT_SIGNED",
        signedAt: null,
        token: `jeton-${id}-${index}`,
      }));
      // Documenso place une zone par balise {{SIGNATURE, rN}} : ici, une par
      // signataire, à la taille du texte de la balise (petite).
      const fields = recipients.map((recipient, index) => ({
        id: nextId * 100 + index,
        recipientId: recipient.id,
        type: "SIGNATURE",
        page: 1,
        positionX: 10 + index * 45,
        positionY: 80,
        width: 18,
        height: 1.5,
      }));
      envelopes.set(id, {
        id,
        externalId: payload.externalId,
        status: "DRAFT",
        distributed: false,
        distributionMethod: payload.meta?.distributionMethod,
        recipients,
        fields,
        pdf: Buffer.from(await file.arrayBuffer()),
      });
      return json(res, 200, { id });
    }

    const get = /^\/api\/v2\/envelope\/(envelope_\d+)$/.exec(url.pathname);
    if (req.method === "GET" && get) {
      const envelope = envelopes.get(get[1]!);
      return envelope ? json(res, 200, publicEnvelope(envelope)) : json(res, 404, { message: "Not found" });
    }

    if (req.method === "POST" && url.pathname === "/api/v2/envelope/field/update-many") {
      const body = JSON.parse((await readBody(req)).toString("utf8")) as { envelopeId: string; data: (Partial<SimField> & { id: number })[] };
      const envelope = envelopes.get(body.envelopeId)!;
      for (const update of body.data) Object.assign(envelope.fields.find((field) => field.id === update.id)!, update);
      return json(res, 200, { data: envelope.fields });
    }

    if (req.method === "POST" && url.pathname === "/api/v2/envelope/distribute") {
      const body = JSON.parse((await readBody(req)).toString("utf8")) as { envelopeId: string; meta?: { distributionMethod?: string } };
      const envelope = envelopes.get(body.envelopeId)!;
      envelope.distributed = true;
      envelope.status = "PENDING";
      envelope.distributionMethod = body.meta?.distributionMethod ?? envelope.distributionMethod;
      return json(res, 200, {
        success: true,
        id: envelope.id,
        recipients: envelope.recipients.map((recipient) => ({ ...recipient, signingUrl: `https://signature.example.test/sign/${recipient.token}` })),
      });
    }

    const item = /^\/api\/v2\/envelope\/item\/(envelope_\d+)_item\/download$/.exec(url.pathname);
    if (req.method === "GET" && item) {
      const envelope = envelopes.get(item[1]!)!;
      if (url.searchParams.get("version") !== "signed" || envelope.status !== "COMPLETED") return json(res, 400, { message: "not completed" });
      res.writeHead(200, { "content-type": "application/pdf" });
      return res.end(envelope.pdf);
    }

    const certificate = /^\/api\/v2\/envelope\/(envelope_\d+)\/certificate\/download$/.exec(url.pathname);
    if (req.method === "GET" && certificate) {
      const envelope = envelopes.get(certificate[1]!)!;
      if (envelope.status !== "COMPLETED") return json(res, 400, { message: "not completed" });
      res.writeHead(200, { "content-type": "application/pdf" });
      return res.end(PDF);
    }
    json(res, 404, { message: "Not found" });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function documensoProvider(apiKey = API_KEY) {
  return new DocumensoSignatureProvider({
    apiUrl: `${baseUrl}/api/v2`,
    apiKey,
    webhookHeader: "X-Documenso-Secret",
    webhookSecret: "secret-du-webhook",
  });
}

function documensoDriver(): Driver {
  const provider = documensoProvider();
  return {
    provider,
    async act(requestId, signerExternalId, action) {
      const envelope = envelopes.get(requestId)!;
      const index = SIGNERS.findIndex((signer) => signer.externalId === signerExternalId);
      const recipient = envelope.recipients.find((candidate) => candidate.signingOrder === index + 1)!;
      recipient.signingStatus = action === "sign" ? "SIGNED" : "REJECTED";
      recipient.signedAt = action === "sign" ? new Date().toISOString() : null;
      if (action === "decline") envelope.status = "REJECTED";
      else if (envelope.recipients.every((candidate) => candidate.signingStatus === "SIGNED")) envelope.status = "COMPLETED";
      // Corps réel d'un webhook Documenso (relevé sur un vrai serveur).
      return JSON.stringify({
        event: action === "sign" ? (envelope.status === "COMPLETED" ? "DOCUMENT_COMPLETED" : "DOCUMENT_SIGNED") : "DOCUMENT_REJECTED",
        payload: { id: 2, envelopeId: envelope.id, externalId: envelope.externalId, status: envelope.status, recipients: envelope.recipients },
        createdAt: new Date().toISOString(),
        webhookEndpoint: "https://symbola.example.test/api/webhooks/signature",
      });
    },
    validHeaders: () => new Headers({ "X-Documenso-Secret": "secret-du-webhook" }),
    wrongHeaders: () => new Headers({ "X-Documenso-Secret": "secret-du-webhooK" }),
  };
}

function fakeDriver(): Driver {
  const provider = new FakeSignatureProvider({ signingBaseUrl: "http://localhost:3000", webhookSecret: "secret-fictif" });
  return {
    provider,
    async act(requestId, signerExternalId, action) {
      return provider.act(requestId, signerExternalId, action);
    },
    validHeaders: () => provider.webhookHeaders(),
    wrongHeaders: () => new Headers({ "x-symbola-fake-signature": "autre" }),
  };
}

describe.each([
  ["faux fournisseur", fakeDriver],
  ["adaptateur Documenso (serveur HTTP simulé)", documensoDriver],
])("DEV-02 — Contrat SignatureProvider : %s", (_name, makeDriver) => {
  it("crée une demande avec un lien personnel par signataire", async () => {
    const { provider } = makeDriver();
    const created = await provider.createRequest({ title: "D-2027-0001 V1", pdf: PDF, signers: SIGNERS });
    expect(created.signers.map((signer) => signer.externalId)).toEqual(["org.signer-1", "org.signer-2"]);
    expect(new Set(created.signers.map((signer) => signer.signingUrl)).size).toBe(2);
    expect((await provider.getRequest(created.externalId)).status).toBe("pending");
  });

  it("la demande n'est terminée qu'au dernier signataire ; les documents se téléchargent alors", async () => {
    const driver = makeDriver();
    const created = await driver.provider.createRequest({ title: "D-2027-0002 V1", pdf: PDF, signers: SIGNERS });
    await driver.act(created.externalId, "org.signer-1", "sign");
    let state = await driver.provider.getRequest(created.externalId);
    expect(state.status).toBe("pending");
    expect(state.signers.map((signer) => [signer.externalId, signer.status])).toEqual([
      ["org.signer-1", "signed"],
      ["org.signer-2", "pending"],
    ]);
    await expect(driver.provider.downloadDocuments(created.externalId)).rejects.toThrow();

    await driver.act(created.externalId, "org.signer-2", "sign");
    state = await driver.provider.getRequest(created.externalId);
    expect(state.status).toBe("completed");
    expect(state.signers.every((signer) => signer.signedAt !== null)).toBe(true);
    const documents = await driver.provider.downloadDocuments(created.externalId);
    expect(documents.signedPdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(documents.auditCertificatePdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("un refus termine la demande en « refusée »", async () => {
    const driver = makeDriver();
    const created = await driver.provider.createRequest({ title: "D-2027-0003 V1", pdf: PDF, signers: SIGNERS });
    await driver.act(created.externalId, "org.signer-2", "decline");
    const state = await driver.provider.getRequest(created.externalId);
    expect(state.status).toBe("declined");
    expect(state.signers.find((signer) => signer.externalId === "org.signer-2")?.status).toBe("declined");
  });

  it("authentifie le webhook par son secret ; sans secret ou avec un secret faux, il est rejeté", async () => {
    const driver = makeDriver();
    const created = await driver.provider.createRequest({ title: "D-2027-0004 V1", pdf: PDF, signers: SIGNERS });
    const body = await driver.act(created.externalId, "org.signer-1", "sign");

    const authenticated = driver.provider.authenticateWebhook(driver.validHeaders(), body);
    expect(authenticated).toMatchObject({ ok: true, requestExternalId: created.externalId });
    expect(authenticated.ok && authenticated.signerExternalIds).toEqual(expect.arrayContaining(["org.signer-1"]));
    expect(driver.provider.authenticateWebhook(driver.wrongHeaders(), body)).toEqual({ ok: false, reason: "invalid_secret" });
    expect(driver.provider.authenticateWebhook(new Headers(), body)).toEqual({ ok: false, reason: "missing_secret" });
    expect(driver.provider.authenticateWebhook(driver.validHeaders(), "pas du json")).toEqual({ ok: false, reason: "invalid_payload" });
  });
});

describe("DEV-02 — Adaptateur Documenso : appels à l'API (ADR 0026)", () => {
  it("envoie le PDF tel quel, ne laisse jamais Documenso envoyer d'e-mail et renvoie ses liens de signature", async () => {
    const provider = documensoProvider();
    const created = await provider.createRequest({ title: "D-2027-0005 V1", pdf: PDF, signers: SIGNERS });
    const envelope = envelopes.get(created.externalId)!;
    expect(envelope.pdf.equals(PDF)).toBe(true);
    expect(envelope.distributed).toBe(true);
    expect(envelope.distributionMethod).toBe("NONE");
    expect(envelope.recipients.map((recipient) => [recipient.email, recipient.signingOrder])).toEqual([
      ["ines@example.test", 1],
      ["sacha@example.test", 2],
    ]);
    expect(created.signers[0]?.signingUrl).toBe(`https://signature.example.test/sign/jeton-${created.externalId}-0`);
  });

  it("agrandit les zones de signature placées à la taille du texte des balises", async () => {
    const provider = documensoProvider();
    const created = await provider.createRequest({ title: "D-2027-0006 V1", pdf: PDF, signers: SIGNERS });
    for (const field of envelopes.get(created.externalId)!.fields) {
      expect(field.height).toBeGreaterThanOrEqual(5);
      expect(field.width).toBeGreaterThanOrEqual(25);
    }
  });

  it("refuse des signataires d'organisations différentes dans une même demande", async () => {
    const provider = documensoProvider();
    await expect(
      provider.createRequest({ title: "x", pdf: PDF, signers: [SIGNERS[0]!, { ...SIGNERS[1]!, externalId: "autre.signer-2" }] }),
    ).rejects.toThrow(/organisation/);
  });

  it("un webhook d'une enveloppe sans identifiant Symbola est refusé comme invalide", () => {
    const provider = documensoProvider();
    const body = JSON.stringify({ event: "DOCUMENT_COMPLETED", payload: { id: 9, envelopeId: "envelope_9", externalId: null } });
    expect(provider.authenticateWebhook(new Headers({ "X-Documenso-Secret": "secret-du-webhook" }), body)).toEqual({ ok: false, reason: "invalid_payload" });
  });

  it("une clé d'API refusée remonte une erreur sans donnée personnelle", async () => {
    const error = await documensoProvider("mauvaise-cle")
      .createRequest({ title: "x", pdf: PDF, signers: SIGNERS })
      .catch((caught: Error) => caught);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("Documenso POST /envelope/create : HTTP 401");
    expect((error as Error).message).not.toContain("ines@");
  });
});
