// DEV-02, ADR 0006/0026 — interface du fournisseur de signature. Le module
// Devis ne connaît que ce contrat : Documenso en production, un faux
// fournisseur en mémoire pour les tests, le développement et l'essai guidé.

export type SignatureSignerInput = {
  // `<organization_id>.<signer_id>` : retrouvé dans le webhook (ADR 0026).
  externalId: string;
  name: string;
  email: string;
  // Rôle affiché sur le PDF (« Signataire 1 »…).
  role: string;
};

export type CreateSignatureRequestInput = {
  title: string;
  // PDF du devis portant une balise de signature par signataire, dans
  // l'ordre des signataires (`{{SIGNATURE, r1}}`, `{{SIGNATURE, r2}}`…).
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

// Balise de signature reconnue par Documenso dans le texte du PDF : une zone
// de signature par signataire, numérotée dans l'ordre (index 0 → r1).
export function signatureTag(index: number): string {
  return `{{SIGNATURE, r${index + 1}}}`;
}

// Lecture du corps des webhooks du faux fournisseur : `form.*` porte un
// signataire (`submission_id`, `external_id`), `submission.*` une
// soumission (`id`, `submitters`).
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
