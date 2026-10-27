// DEV-02, ADR 0006/0021 — interface du fournisseur de signature. Le module
// Devis ne connaît que ce contrat : DocuSeal en production, un faux
// fournisseur en mémoire pour les tests, le développement et l'essai guidé.

export type SignatureSignerInput = {
  // `<organization_id>.<signer_id>` : retrouvé dans le webhook (ADR 0021).
  externalId: string;
  name: string;
  email: string;
  // Rôle du signataire, repris par la balise de signature du PDF.
  role: string;
};

export type CreateSignatureRequestInput = {
  title: string;
  // PDF du devis portant une balise de signature par rôle
  // (`{{Signature;role=<rôle>;type=signature}}`).
  pdf: Buffer;
  signers: SignatureSignerInput[];
};

export type CreatedSignatureRequest = {
  externalId: string;
  signers: { externalId: string; signingUrl: string }[];
};

export type SignatureRequestState = {
  externalId: string;
  status: "pending" | "completed" | "declined";
  signers: { externalId: string; status: "pending" | "signed" | "declined"; signedAt: string | null }[];
};

export type SignedDocuments = { signedPdf: Buffer; auditCertificatePdf: Buffer };

// Ce que le webhook apprend d'un appel authentifié : seulement de quoi
// relire l'état réel chez le fournisseur, jamais l'état lui-même.
export type WebhookAuthentication =
  | { ok: true; eventType: string; requestExternalId: string; signerExternalIds: string[] }
  | { ok: false; reason: "missing_secret" | "invalid_secret" | "invalid_payload" };

export interface SignatureProvider {
  readonly name: string;
  createRequest(input: CreateSignatureRequestInput): Promise<CreatedSignatureRequest>;
  getRequest(externalId: string): Promise<SignatureRequestState>;
  downloadDocuments(externalId: string): Promise<SignedDocuments>;
  authenticateWebhook(headers: Headers, rawBody: string): WebhookAuthentication;
}

// Balise de signature reconnue par DocuSeal dans le texte du PDF (et par le
// faux fournisseur) : une zone de signature par rôle.
export function signatureTag(role: string): string {
  return `{{Signature;role=${role};type=signature}}`;
}

// Lecture commune du corps des webhooks (format DocuSeal, repris par le
// faux fournisseur) : `form.*` porte un signataire (`submission_id`,
// `external_id`), `submission.*` une soumission (`id`, `submitters`).
export function parseWebhookBody(rawBody: string): WebhookAuthentication {
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return { ok: false, reason: "invalid_payload" };
  }
  if (typeof body !== "object" || body === null) return { ok: false, reason: "invalid_payload" };
  const { event_type: eventType, data } = body as { event_type?: unknown; data?: unknown };
  if (typeof eventType !== "string" || typeof data !== "object" || data === null) return { ok: false, reason: "invalid_payload" };
  const record = data as Record<string, unknown>;
  const submissionId = eventType.startsWith("submission.") ? record.id : (record.submission_id ?? (record.submission as { id?: unknown } | undefined)?.id);
  if (typeof submissionId !== "string" && typeof submissionId !== "number") return { ok: false, reason: "invalid_payload" };
  const externalIds = new Set<string>();
  if (typeof record.external_id === "string") externalIds.add(record.external_id);
  if (Array.isArray(record.submitters)) {
    for (const submitter of record.submitters) {
      const id = (submitter as { external_id?: unknown } | null)?.external_id;
      if (typeof id === "string") externalIds.add(id);
    }
  }
  if (externalIds.size === 0) return { ok: false, reason: "invalid_payload" };
  return { ok: true, eventType, requestExternalId: String(submissionId), signerExternalIds: [...externalIds] };
}
