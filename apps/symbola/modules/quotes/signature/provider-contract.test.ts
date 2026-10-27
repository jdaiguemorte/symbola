// DEV-02 — « le faux fournisseur remplace DocuSeal sans changer le module
// Devis » : la même suite s'exécute contre les deux implémentations ;
// l'adaptateur DocuSeal y parle à un serveur HTTP simulé qui reproduit les
// réponses de l'API (ADR 0021).
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DocusealSignatureProvider } from "./docuseal";
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

// --- Serveur DocuSeal simulé ---

type SimSubmitter = { id: number; external_id: string; slug: string; status: string; completed_at: string | null; name: string; email: string; role: string };
type SimSubmission = { id: number; status: string; submitters: SimSubmitter[]; pdfBase64: string };

const API_KEY = "cle-api-de-test";
let server: Server;
let baseUrl = "";
const submissions = new Map<number, SimSubmission>();
let nextId = 100;

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

beforeAll(async () => {
  server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname.startsWith("/files/")) {
      res.writeHead(200, { "content-type": "application/pdf" });
      res.end(PDF);
      return;
    }
    if (req.headers["x-auth-token"] !== API_KEY) return json(res, 401, { error: "Not authenticated" });
    if (req.method === "POST" && url.pathname === "/api/submissions/pdf") {
      const body = JSON.parse(await readBody(req)) as {
        send_email: boolean;
        documents: { file: string }[];
        submitters: { role: string; name: string; email: string; external_id: string; send_email: boolean }[];
      };
      // L'adaptateur ne doit jamais laisser DocuSeal envoyer les e-mails.
      if (body.send_email !== false || body.submitters.some((s) => s.send_email !== false)) return json(res, 422, { error: "send_email" });
      const id = nextId++;
      const submission: SimSubmission = {
        id,
        status: "pending",
        pdfBase64: body.documents[0]!.file,
        submitters: body.submitters.map((s, index) => ({
          id: id * 10 + index,
          external_id: s.external_id,
          slug: `slug-${id}-${index}`,
          status: "sent",
          completed_at: null,
          name: s.name,
          email: s.email,
          role: s.role,
        })),
      };
      submissions.set(id, submission);
      return json(res, 200, { id, name: "x", status: "pending", submitters: submission.submitters });
    }
    const match = /^\/api\/submissions\/(\d+)$/.exec(url.pathname);
    if (req.method === "GET" && match) {
      const submission = submissions.get(Number(match[1]));
      if (!submission) return json(res, 404, { error: "Not found" });
      const completed = submission.status === "completed";
      return json(res, 200, {
        id: submission.id,
        status: submission.status,
        submitters: submission.submitters,
        documents: completed ? [{ name: "devis", url: `${baseUrl}/files/${submission.id}/signed.pdf` }] : [],
        audit_log_url: completed ? `${baseUrl}/files/${submission.id}/audit.pdf` : null,
      });
    }
    json(res, 404, { error: "Not found" });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function docusealDriver(): Driver {
  const provider = new DocusealSignatureProvider({
    apiUrl: `${baseUrl}/api`,
    apiKey: API_KEY,
    publicUrl: "https://signature.example.test",
    webhookHeader: "X-Symbola-Webhook-Secret",
    webhookSecret: "secret-du-webhook",
  });
  return {
    provider,
    async act(requestId, signerExternalId, action) {
      const submission = submissions.get(Number(requestId))!;
      const submitter = submission.submitters.find((s) => s.external_id === signerExternalId)!;
      submitter.status = action === "sign" ? "completed" : "declined";
      submitter.completed_at = action === "sign" ? new Date().toISOString() : null;
      if (action === "decline") submission.status = "declined";
      else if (submission.submitters.every((s) => s.status === "completed")) submission.status = "completed";
      return JSON.stringify({
        event_type: action === "sign" ? "form.completed" : "form.declined",
        timestamp: new Date().toISOString(),
        data: { id: submitter.id, submission_id: submission.id, external_id: submitter.external_id, email: submitter.email },
      });
    },
    validHeaders: () => new Headers({ "X-Symbola-Webhook-Secret": "secret-du-webhook" }),
    wrongHeaders: () => new Headers({ "X-Symbola-Webhook-Secret": "secret-du-webhooK" }),
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
  ["adaptateur DocuSeal (serveur HTTP simulé)", docusealDriver],
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
    expect(state.signers.map((signer) => signer.status)).toEqual(["signed", "pending"]);
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
    expect((await driver.provider.getRequest(created.externalId)).status).toBe("declined");
  });

  it("authentifie le webhook par son secret ; sans secret ou avec un secret faux, il est rejeté", async () => {
    const driver = makeDriver();
    const created = await driver.provider.createRequest({ title: "D-2027-0004 V1", pdf: PDF, signers: SIGNERS });
    const body = await driver.act(created.externalId, "org.signer-1", "sign");

    expect(driver.provider.authenticateWebhook(driver.validHeaders(), body)).toEqual({
      ok: true,
      eventType: "form.completed",
      requestExternalId: created.externalId,
      signerExternalIds: ["org.signer-1"],
    });
    expect(driver.provider.authenticateWebhook(driver.wrongHeaders(), body)).toEqual({ ok: false, reason: "invalid_secret" });
    expect(driver.provider.authenticateWebhook(new Headers(), body)).toEqual({ ok: false, reason: "missing_secret" });
    expect(driver.provider.authenticateWebhook(driver.validHeaders(), "pas du json")).toEqual({ ok: false, reason: "invalid_payload" });
  });
});

describe("DEV-02 — Adaptateur DocuSeal : appels à l'API", () => {
  it("envoie le PDF en base64, désactive les e-mails de DocuSeal et construit les liens publics", async () => {
    const { provider } = docusealDriver();
    const created = await provider.createRequest({ title: "D-2027-0005 V1", pdf: PDF, signers: SIGNERS });
    const submission = submissions.get(Number(created.externalId))!;
    expect(Buffer.from(submission.pdfBase64, "base64").equals(PDF)).toBe(true);
    expect(created.signers[0]?.signingUrl).toMatch(/^https:\/\/signature\.example\.test\/s\/slug-\d+-0$/);
  });

  it("une clé d'API refusée remonte une erreur sans donnée personnelle", async () => {
    const provider = new DocusealSignatureProvider({
      apiUrl: `${baseUrl}/api`,
      apiKey: "mauvaise-cle",
      publicUrl: "https://signature.example.test",
      webhookHeader: "X-Symbola-Webhook-Secret",
      webhookSecret: "secret",
    });
    const error = await provider.createRequest({ title: "x", pdf: PDF, signers: SIGNERS }).catch((caught: Error) => caught);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("DocuSeal POST /submissions/pdf : HTTP 401");
    expect((error as Error).message).not.toContain("ines@");
  });
});
