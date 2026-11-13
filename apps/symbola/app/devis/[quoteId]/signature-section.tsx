import { getLocale, getTranslations } from "next-intl/server";
import { formatDateTime, type Locale } from "@symbola/i18n";
import { listEventLinks, type EventDetail } from "@/modules/events/service";
import { isSignatureAvailable, listQuoteContracts, type QuoteDetail } from "@/modules/quotes/service";
import { PAID_CLASS, OVERDUE_CLASS } from "../quote-display";
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

  const tContracts = await getTranslations("Contracts");
  // D13 : contrat à distance, le lien s'affiche sur l'espace du signataire après sa commande.
  const orderFirst =
    signature?.contractId && signature.status === "pending"
      ? ((await listQuoteContracts(organizationId, quote.id)).find((contract) => contract.id === signature.contractId)?.regime.orderRequired ?? false)
      : false;
  if (signature) {
    return (
      <section aria-labelledby="signature-title">
        <h2 id="signature-title">{t("signatureTitle")}</h2>
        <p role="status">{t(REQUEST_STATUS_KEYS[signature.status])}</p>
        {/* Lot 31b (D9) : le devis seul, ou suivi de son contrat dans le même PDF. */}
        <p className="meta">{tContracts(`signatureScope_${signature.kind}`)}</p>
        <ul>
          {signature.signers.map((signer) => (
            <li key={signer.id}>
              <strong>{signer.name}</strong> ({signer.email}) —{" "}
              <span className={signer.status === "signed" ? PAID_CLASS : signer.status === "declined" ? OVERDUE_CLASS : "badge"}>
                {t(SIGNER_STATUS_KEYS[signer.status])}
                {signer.signedAt ? ` — ${formatDateTime(new Date(signer.signedAt), locale)}` : ""}
              </span>
              {signature.status === "pending" && signer.status === "pending" ? (
                orderFirst ? (
                  <> — {tContracts("signingLinkOnPortal")}</>
                ) : (
                  <>
                    {" "}
                    — <a href={signer.signingUrl}>{t("signingLinkFor", { name: signer.name })}</a>
                  </>
                )
              ) : null}
            </li>
          ))}
        </ul>
        {/* Filet de sécurité : un e-mail non reçu (spam, panne d'envoi) ne bloque pas la signature. */}
        {signature.status === "pending" ? <p>{orderFirst ? tContracts("orderFirstHint") : t("signingLinksHint")}</p> : null}
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

  // Pré-remplissage : les mariés de l'événement, avec l'e-mail de leur lien
  // personnel (lot 26a), sinon celui de leur fiche.
  const links = event ? (await listEventLinks(organizationId, event.id)).filter((link) => link.audience === "client" && link.status !== "revoked") : [];
  const drafts: SignerDraft[] = (event?.clients ?? []).map((client) => ({
    eventClientId: client.id,
    name: [client.firstName, client.lastName].filter(Boolean).join(" "),
    email: links.find((link) => link.eventClientId === client.id)?.email ?? client.email ?? "",
  }));
  // Lot 31b (DOC-03, D9) : le contrat de la version courante, à jour (généré après le dernier choix
  // des options) et pas encore en signature, part avec le devis.
  const contracts = quote.current.sentAt ? await listQuoteContracts(organizationId, quote.id) : [];
  const current = [...contracts].reverse().find((contract) => contract.quoteVersion === quote.current.version) ?? null;
  const contract = current && !current.outdated && !current.signature ? { id: current.id, version: current.version } : null;
  return (
    <section aria-labelledby="signature-title">
      <h2 id="signature-title">{t("signatureTitle")}</h2>
      {current?.outdated ? <p role="alert">{tContracts("contractOutdatedBeforeSignature")}</p> : null}
      <SendForSignatureForm quoteId={quote.id} drafts={drafts} rows={Math.max(2, drafts.length)} contract={contract} />
    </section>
  );
}
