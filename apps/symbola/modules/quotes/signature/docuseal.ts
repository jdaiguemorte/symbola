// DEV-02, ADR 0021 — adaptateur DocuSeal (auto-hébergé, AGPL, utilisé sans
// modification) : API REST appelée avec fetch, sans SDK. Symbola envoie
// lui-même les liens de signature (send_email: false). Le webhook est
// authentifié par un en-tête secret comparé en temps constant ; son contenu
// ne sert qu'à savoir quelle soumission relire par l'API.
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

export type DocusealOptions = {
  // URL de l'API, ex. http://docuseal:3000/api (réseau interne).
  apiUrl: string;
  apiKey: string;
  // URL publique des pages de signature, ex. https://signature.exemple.fr.
  publicUrl: string;
  webhookHeader: string;
  webhookSecret: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
};

type DocusealSubmitter = { external_id: string | null; slug: string; status: string; completed_at: string | null; declined_at?: string | null };
type DocusealSubmission = {
  id: number;
  status: string;
  submitters: DocusealSubmitter[];
  documents?: { name: string; url: string }[];
  audit_log_url?: string | null;
};

export class DocusealError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocusealError";
  }
}

export class DocusealSignatureProvider implements SignatureProvider {
  readonly name = "docuseal";
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: DocusealOptions) {
    this.fetchImpl = options.fetch ?? fetch;
  }

  private async call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    const response = await this.fetchImpl(`${this.options.apiUrl.replace(/\/$/, "")}${path}`, {
      method,
      headers: { "X-Auth-Token": this.options.apiKey, "Content-Type": "application/json", Accept: "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(this.options.timeoutMs ?? 15_000),
    });
    // Jamais le corps de la réponse dans l'erreur : il peut contenir des
    // e-mails de signataires (CLAUDE.md §5, journaux sans donnée personnelle).
    if (!response.ok) throw new DocusealError(`DocuSeal ${method} ${path.split("?")[0]} : HTTP ${response.status}`);
    return (await response.json()) as T;
  }

  async createRequest(input: CreateSignatureRequestInput): Promise<CreatedSignatureRequest> {
    const result = await this.call<{ id: number; submitters: DocusealSubmitter[] } | DocusealSubmitter[]>("POST", "/submissions/pdf", {
      name: input.title,
      send_email: false,
      documents: [{ name: input.title, file: input.pdf.toString("base64") }],
      submitters: input.signers.map((signer) => ({
        role: signer.role,
        name: signer.name,
        email: signer.email,
        external_id: signer.externalId,
        send_email: false,
      })),
    });
    // Selon la version, la réponse est la soumission ou la liste de ses signataires.
    const submitters = Array.isArray(result) ? result : result.submitters;
    const submissionId = Array.isArray(result) ? (result[0] as unknown as { submission_id?: number })?.submission_id : result.id;
    if (submissionId === undefined) throw new DocusealError("DocuSeal : identifiant de soumission absent");
    const base = this.options.publicUrl.replace(/\/$/, "");
    return {
      externalId: String(submissionId),
      signers: input.signers.map((signer) => {
        const submitter = submitters.find((candidate) => candidate.external_id === signer.externalId);
        if (!submitter) throw new DocusealError("DocuSeal : signataire absent de la réponse");
        return { externalId: signer.externalId, signingUrl: `${base}/s/${submitter.slug}` };
      }),
    };
  }

  async getRequest(externalId: string): Promise<SignatureRequestState> {
    const submission = await this.call<DocusealSubmission>("GET", `/submissions/${encodeURIComponent(externalId)}`);
    const signers = submission.submitters
      .filter((submitter): submitter is DocusealSubmitter & { external_id: string } => typeof submitter.external_id === "string")
      .map((submitter) => ({
        externalId: submitter.external_id,
        status:
          submitter.status === "completed" ? ("signed" as const) : submitter.status === "declined" ? ("declined" as const) : ("pending" as const),
        signedAt: submitter.status === "completed" ? submitter.completed_at : null,
      }));
    const status =
      submission.status === "completed" ? "completed" : submission.status === "declined" || signers.some((s) => s.status === "declined") ? "declined" : "pending";
    return { externalId: String(submission.id), status, signers };
  }

  async downloadDocuments(externalId: string): Promise<SignedDocuments> {
    const submission = await this.call<DocusealSubmission>("GET", `/submissions/${encodeURIComponent(externalId)}`);
    const documentUrl = submission.documents?.[0]?.url;
    if (submission.status !== "completed" || !documentUrl || !submission.audit_log_url) {
      throw new DocusealError("DocuSeal : documents signés indisponibles");
    }
    const download = async (url: string) => {
      const response = await this.fetchImpl(url, { signal: AbortSignal.timeout(this.options.timeoutMs ?? 15_000) });
      if (!response.ok) throw new DocusealError(`DocuSeal : téléchargement HTTP ${response.status}`);
      return Buffer.from(await response.arrayBuffer());
    };
    return { signedPdf: await download(documentUrl), auditCertificatePdf: await download(submission.audit_log_url) };
  }

  authenticateWebhook(headers: Headers, rawBody: string): WebhookAuthentication {
    const received = headers.get(this.options.webhookHeader);
    if (received === null) return { ok: false, reason: "missing_secret" };
    if (!secretsMatch(received, this.options.webhookSecret)) return { ok: false, reason: "invalid_secret" };
    return parseWebhookBody(rawBody);
  }
}
