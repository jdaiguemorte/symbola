// DEV-02, ADR 0021 — faux fournisseur de signature, sans réseau : tests,
// développement local et essai guidé (« le marié fictif signe sans e-mail à
// un tiers »). État en mémoire du processus, partagé entre les rechargements
// de module du serveur de dev ; interdit en production (packages/env).
import { randomUUID } from "node:crypto";
import type {
  CreateSignatureRequestInput,
  CreatedSignatureRequest,
  SignatureProvider,
  SignatureRequestState,
  SignedDocuments,
  WebhookAuthentication,
} from "./provider";
import { parseWebhookBody } from "./provider";
import { secretsMatch } from "./secret";

type FakeSigner = { externalId: string; token: string; status: "pending" | "signed" | "declined"; signedAt: string | null };
type FakeRequest = { externalId: string; title: string; signers: FakeSigner[] };

const STORE_KEY = Symbol.for("symbola.fakeSignatureStore");
type Store = Map<string, FakeRequest>;
function store(): Store {
  const holder = globalThis as unknown as Record<symbol, Store | undefined>;
  holder[STORE_KEY] ??= new Map();
  return holder[STORE_KEY]!;
}

export const FAKE_WEBHOOK_HEADER = "x-symbola-fake-signature";

// PDF minimal mais valide, pour le document signé et le certificat fictifs.
function fakePdf(text: string): Buffer {
  const stream = `BT /F1 12 Tf 72 720 Td (${text.replace(/[()\\]/g, "")}) Tj ET`;
  return Buffer.from(
    `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n` +
      `3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n` +
      `4 0 obj<</Length ${stream.length}>>stream\n${stream}\nendstream endobj\n` +
      `5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n`,
    "latin1",
  );
}

export class FakeSignatureProvider implements SignatureProvider {
  readonly name = "fake";

  constructor(private readonly options: { signingBaseUrl: string; webhookSecret: string }) {}

  async createRequest(input: CreateSignatureRequestInput): Promise<CreatedSignatureRequest> {
    if (input.signers.length === 0) throw new RangeError("au moins un signataire");
    const request: FakeRequest = {
      externalId: `fake-${randomUUID()}`,
      title: input.title,
      signers: input.signers.map((signer) => ({ externalId: signer.externalId, token: randomUUID(), status: "pending", signedAt: null })),
    };
    store().set(request.externalId, request);
    return {
      externalId: request.externalId,
      signers: request.signers.map((signer) => ({
        externalId: signer.externalId,
        signingUrl: `${this.options.signingBaseUrl}/signature-fictive/${signer.token}`,
      })),
    };
  }

  async getRequest(externalId: string): Promise<SignatureRequestState> {
    const request = store().get(externalId);
    if (!request) throw new Error("demande de signature inconnue du faux fournisseur");
    const declined = request.signers.some((signer) => signer.status === "declined");
    const completed = request.signers.every((signer) => signer.status === "signed");
    return {
      externalId,
      status: declined ? "declined" : completed ? "completed" : "pending",
      signers: request.signers.map(({ externalId: id, status, signedAt }) => ({ externalId: id, status, signedAt })),
    };
  }

  async downloadDocuments(externalId: string): Promise<SignedDocuments> {
    const state = await this.getRequest(externalId);
    if (state.status !== "completed") throw new Error("demande non terminée");
    return { signedPdf: fakePdf(`Document signe (fictif) ${externalId}`), auditCertificatePdf: fakePdf(`Certificat (fictif) ${externalId}`) };
  }

  authenticateWebhook(headers: Headers, rawBody: string): WebhookAuthentication {
    const received = headers.get(FAKE_WEBHOOK_HEADER);
    if (received === null) return { ok: false, reason: "missing_secret" };
    if (!secretsMatch(received, this.options.webhookSecret)) return { ok: false, reason: "invalid_secret" };
    return parseWebhookBody(rawBody);
  }

  // --- Pilotage (tests, page de signature fictive) ---

  findByToken(token: string): { request: FakeRequest; signer: FakeSigner } | null {
    for (const request of store().values()) {
      const signer = request.signers.find((candidate) => candidate.token === token);
      if (signer) return { request, signer };
    }
    return null;
  }

  // Le signataire signe (ou refuse) ; renvoie le corps du webhook que le
  // fournisseur enverrait, au format DocuSeal.
  act(requestExternalId: string, signerExternalId: string, action: "sign" | "decline", now: Date = new Date()): string {
    const request = store().get(requestExternalId);
    const signer = request?.signers.find((candidate) => candidate.externalId === signerExternalId);
    if (!request || !signer) throw new Error("signataire inconnu du faux fournisseur");
    if (signer.status === "pending") {
      signer.status = action === "sign" ? "signed" : "declined";
      signer.signedAt = action === "sign" ? now.toISOString() : null;
    }
    return JSON.stringify({
      event_type: action === "sign" ? "form.completed" : "form.declined",
      timestamp: now.toISOString(),
      data: { submission_id: requestExternalId, external_id: signerExternalId },
    });
  }

  webhookHeaders(): Headers {
    return new Headers({ [FAKE_WEBHOOK_HEADER]: this.options.webhookSecret, "content-type": "application/json" });
  }
}
