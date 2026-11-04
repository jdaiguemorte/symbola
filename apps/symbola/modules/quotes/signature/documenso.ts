// DEV-02, ADR 0026 — adaptateur Documenso (auto-hébergé, AGPL, utilisé sans
// modification) : API v2 appelée avec fetch, sans SDK. Documenso place les
// zones de signature à partir des balises {{SIGNATURE, rN}} du PDF ; Symbola
// envoie lui-même les liens de signature (distribution « NONE »). Le webhook
// est authentifié par l'en-tête secret de Documenso (comparaison en temps
// constant) ; son contenu ne sert qu'à savoir quelle enveloppe relire.
import type {
  CreateSignatureRequestInput,
  CreatedSignatureRequest,
  SignatureProvider,
  SignatureRequestState,
  SignedDocuments,
  WebhookAuthentication,
} from "./provider";
import { secretsMatch } from "./secret";

export type DocumensoOptions = {
  // API v2 interne, ex. http://documenso:3000/api/v2.
  apiUrl: string;
  apiKey: string;
  webhookHeader: string;
  webhookSecret: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
};

type DocumensoRecipient = { id: number; email: string; signingOrder: number | null; signingStatus: string; signedAt: string | null };
// Positions et tailles en pourcentage de la page ; l'API v2 les renvoie
// sous forme de texte (« 7.14 »), d'où la conversion avant tout calcul.
type DocumensoField = { id: number; type: string; positionX: number | string; positionY: number | string; width: number | string; height: number | string };
type DocumensoEnvelope = {
  id: string;
  externalId: string | null;
  status: string;
  recipients: DocumensoRecipient[];
  fields?: DocumensoField[];
  envelopeItems?: { id: string }[];
};

// Taille minimale d'une zone de signature, en pourcentage de la page : la
// zone placée par Documenso a la taille du texte de la balise, trop petite
// pour signer confortablement (relevé sur un vrai serveur).
const MIN_FIELD_WIDTH_PERCENT = 25;
const MIN_FIELD_HEIGHT_PERCENT = 5;
// Limite de Documenso pour l'identifiant externe d'une enveloppe.
const EXTERNAL_ID_MAX_LENGTH = 255;

export class DocumensoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumensoError";
  }
}

// L'identifiant externe de l'enveloppe porte l'organisation et, dans
// l'ordre, l'identifiant de chaque signataire : `<org>.<signer1>.<signer2>`.
// Documenso ne garde pas d'identifiant par destinataire ; leur ordre de
// signature (1, 2…) suit celui des signataires (ADR 0026).
function encodeExternalId(signerExternalIds: string[]): string {
  const parts = signerExternalIds.map((id) => {
    const dot = id.indexOf(".");
    if (dot <= 0) throw new DocumensoError("Documenso : identifiant de signataire invalide");
    return { organization: id.slice(0, dot), signer: id.slice(dot + 1) };
  });
  const organization = parts[0]!.organization;
  if (parts.some((part) => part.organization !== organization)) throw new DocumensoError("Documenso : signataires de plusieurs organisations");
  const encoded = [organization, ...parts.map((part) => part.signer)].join(".");
  if (encoded.length > EXTERNAL_ID_MAX_LENGTH) throw new DocumensoError("Documenso : trop de signataires pour une demande");
  return encoded;
}

function decodeExternalId(externalId: string | null | undefined): string[] | null {
  if (typeof externalId !== "string") return null;
  const [organization, ...signers] = externalId.split(".");
  if (!organization || signers.length === 0 || signers.some((signer) => signer.length === 0)) return null;
  return signers.map((signer) => `${organization}.${signer}`);
}

function byOrder<T extends DocumensoRecipient>(recipients: T[]): T[] {
  return [...recipients].sort((a, b) => (a.signingOrder ?? a.id) - (b.signingOrder ?? b.id));
}

export class DocumensoSignatureProvider implements SignatureProvider {
  readonly name = "documenso";
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: DocumensoOptions) {
    this.fetchImpl = options.fetch ?? fetch;
  }

  private async request(method: "GET" | "POST", path: string, body?: BodyInit, contentType?: string): Promise<Response> {
    const response = await this.fetchImpl(`${this.options.apiUrl.replace(/\/$/, "")}${path}`, {
      method,
      headers: { Authorization: this.options.apiKey, ...(contentType ? { "Content-Type": contentType } : {}) },
      ...(body === undefined ? {} : { body }),
      signal: AbortSignal.timeout(this.options.timeoutMs ?? 20_000),
    });
    // Jamais le corps de la réponse dans l'erreur : il peut contenir des
    // e-mails de signataires (CLAUDE.md §5, journaux sans donnée personnelle).
    if (!response.ok) throw new DocumensoError(`Documenso ${method} ${path.split("?")[0]} : HTTP ${response.status}`);
    return response;
  }

  private async json<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    const response = await this.request(method, path, body === undefined ? undefined : JSON.stringify(body), body === undefined ? undefined : "application/json");
    return (await response.json()) as T;
  }

  private async pdf(path: string): Promise<Buffer> {
    return Buffer.from(await (await this.request("GET", path)).arrayBuffer());
  }

  private envelope(externalId: string): Promise<DocumensoEnvelope> {
    return this.json<DocumensoEnvelope>("GET", `/envelope/${encodeURIComponent(externalId)}`);
  }

  async createRequest(input: CreateSignatureRequestInput): Promise<CreatedSignatureRequest> {
    const externalId = encodeExternalId(input.signers.map((signer) => signer.externalId));
    const form = new FormData();
    form.append(
      "payload",
      JSON.stringify({
        title: input.title,
        type: "DOCUMENT",
        externalId,
        recipients: input.signers.map((signer, index) => ({ name: signer.name, email: signer.email, role: "SIGNER", signingOrder: index + 1 })),
        meta: { language: "fr", timezone: "Europe/Paris", distributionMethod: "NONE" },
      }),
    );
    form.append("files", new Blob([new Uint8Array(input.pdf)], { type: "application/pdf" }), "devis.pdf");
    const created = (await (await this.request("POST", "/envelope/create", form)).json()) as { id: string };

    // Zones de signature à une taille confortable, sans bouger leur coin.
    const envelope = await this.envelope(created.id);
    const resized = (envelope.fields ?? [])
      .filter((field) => field.type === "SIGNATURE")
      .map((field) => ({ id: field.id, type: field.type, x: Number(field.positionX), y: Number(field.positionY), width: Number(field.width), height: Number(field.height) }))
      .filter((field) => field.width < MIN_FIELD_WIDTH_PERCENT || field.height < MIN_FIELD_HEIGHT_PERCENT)
      .map((field) => ({
        id: field.id,
        type: field.type,
        width: Math.min(Math.max(field.width, MIN_FIELD_WIDTH_PERCENT), 100 - field.x),
        height: Math.min(Math.max(field.height, MIN_FIELD_HEIGHT_PERCENT), 100 - field.y),
      }));
    if (resized.length > 0) await this.json("POST", "/envelope/field/update-many", { envelopeId: created.id, data: resized });

    const distributed = await this.json<{ recipients: (DocumensoRecipient & { signingUrl: string })[] }>("POST", "/envelope/distribute", {
      envelopeId: created.id,
      meta: { distributionMethod: "NONE", language: "fr" },
    });
    const recipients = byOrder(distributed.recipients);
    return {
      externalId: created.id,
      signers: input.signers.map((signer, index) => {
        const recipient = recipients[index];
        if (!recipient?.signingUrl) throw new DocumensoError("Documenso : lien de signature absent de la réponse");
        return { externalId: signer.externalId, signingUrl: recipient.signingUrl };
      }),
    };
  }

  async getRequest(externalId: string): Promise<SignatureRequestState> {
    const envelope = await this.envelope(externalId);
    const signerIds = decodeExternalId(envelope.externalId);
    if (!signerIds) throw new DocumensoError("Documenso : enveloppe sans identifiant Symbola");
    const recipients = byOrder(envelope.recipients);
    const signers = signerIds.map((id, index) => {
      const recipient = recipients[index];
      const status =
        recipient?.signingStatus === "SIGNED" ? ("signed" as const) : recipient?.signingStatus === "REJECTED" ? ("declined" as const) : ("pending" as const);
      return { externalId: id, status, signedAt: status === "signed" ? (recipient?.signedAt ?? null) : null };
    });
    const status =
      envelope.status === "COMPLETED"
        ? "completed"
        : envelope.status === "REJECTED" || signers.some((signer) => signer.status === "declined")
          ? "declined"
          : "pending";
    return { externalId: envelope.id, status, signers };
  }

  async downloadDocuments(externalId: string): Promise<SignedDocuments> {
    const envelope = await this.envelope(externalId);
    const itemId = envelope.envelopeItems?.[0]?.id;
    if (envelope.status !== "COMPLETED" || !itemId) throw new DocumensoError("Documenso : documents signés indisponibles");
    return {
      signedPdf: await this.pdf(`/envelope/item/${encodeURIComponent(itemId)}/download?version=signed`),
      auditCertificatePdf: await this.pdf(`/envelope/${encodeURIComponent(envelope.id)}/certificate/download`),
    };
  }

  authenticateWebhook(headers: Headers, rawBody: string): WebhookAuthentication {
    const received = headers.get(this.options.webhookHeader);
    if (received === null) return { ok: false, reason: "missing_secret" };
    if (!secretsMatch(received, this.options.webhookSecret)) return { ok: false, reason: "invalid_secret" };
    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return { ok: false, reason: "invalid_payload" };
    }
    const { event, payload } = (body ?? {}) as { event?: unknown; payload?: { envelopeId?: unknown; externalId?: unknown } };
    if (typeof event !== "string" || typeof payload?.envelopeId !== "string") return { ok: false, reason: "invalid_payload" };
    const signerExternalIds = decodeExternalId(typeof payload.externalId === "string" ? payload.externalId : null);
    if (!signerExternalIds) return { ok: false, reason: "invalid_payload" };
    return { ok: true, eventType: event, requestExternalId: payload.envelopeId, signerExternalIds };
  }
}
