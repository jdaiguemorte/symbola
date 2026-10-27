import { getLocale, getTranslations } from "next-intl/server";
import { formatDateTime, type Locale } from "@symbola/i18n";
import { listEventClientAccesses, type EventDetail } from "@/modules/events/service";
import { isSignatureAvailable, type QuoteDetail } from "@/modules/quotes/service";
import { PAID_STYLE, OVERDUE_STYLE } from "../quote-display";
import { SendForSignatureForm, type SignerDraft } from "./signature-forms";

const SIGNER_STATUS_KEYS = { pending: "signerPending", signed: "signerSigned", declined: "signerDeclined" } as const;
const REQUEST_STATUS_KEYS = { pending: "signaturePending", completed: "signatureCompleted", declined: "signatureDeclined" } as const;

// DEV-02 — signature en ligne de la version courante : envoi (signataires
// saisis sur le devis), suivi par signataire, documents signés.
export async function SignatureSection({
  organizationId,
  quote,
  event,
}: {
  organizationId: string;
  quote: QuoteDetail;
  event: EventDetail | null;
}) {
  const t = await getTranslations("Quotes");
  const locale = (await getLocale()) as Locale;
  const { signature } = quote;

  if (signature) {
    return (
      <section aria-labelledby="signature-title">
        <h2 id="signature-title">{t("signatureTitle")}</h2>
        <p role="status">{t(REQUEST_STATUS_KEYS[signature.status])}</p>
        <ul>
          {signature.signers.map((signer) => (
            <li key={signer.id}>
              <strong>{signer.name}</strong> ({signer.email}) —{" "}
              <span style={signer.status === "signed" ? PAID_STYLE : signer.status === "declined" ? OVERDUE_STYLE : undefined}>
                {t(SIGNER_STATUS_KEYS[signer.status])}
                {signer.signedAt ? ` — ${formatDateTime(new Date(signer.signedAt), locale)}` : ""}
              </span>
              {signature.status === "pending" && signer.status === "pending" ? (
                <>
                  {" "}
                  — <a href={signer.signingUrl}>{t("signingLinkFor", { name: signer.name })}</a>
                </>
              ) : null}
            </li>
          ))}
        </ul>
        {signature.hasSignedDocument ? (
          <p>
            <a href={`/devis/${quote.id}/signature/signed`}>{t("downloadSignedDocument")}</a> —{" "}
            <a href={`/devis/${quote.id}/signature/certificate`}>{t("downloadAuditCertificate")}</a>
          </p>
        ) : null}
      </section>
    );
  }

  const sendable = quote.status === "draft" || quote.status === "sent";
  if (!sendable) return null;
  if (!isSignatureAvailable(quote.isDemo)) {
    return (
      <section aria-labelledby="signature-title">
        <h2 id="signature-title">{t("signatureTitle")}</h2>
        <p role="status">{t("signatureUnavailable")}</p>
      </section>
    );
  }

  // Pré-remplissage : les mariés de l'événement, et l'e-mail de leurs
  // accès (EVT-06) dans l'ordre des invitations.
  const accesses = event ? await listEventClientAccesses(organizationId, event.id) : [];
  const emails = accesses.filter((access) => access.status !== "revoked").map((access) => access.email);
  const drafts: SignerDraft[] = (event?.clients ?? []).map((client, index) => ({
    eventClientId: client.id,
    name: [client.firstName, client.lastName].filter(Boolean).join(" "),
    email: emails[index] ?? "",
  }));
  return (
    <section aria-labelledby="signature-title">
      <h2 id="signature-title">{t("signatureTitle")}</h2>
      <SendForSignatureForm quoteId={quote.id} drafts={drafts} rows={Math.max(2, drafts.length)} />
    </section>
  );
}
