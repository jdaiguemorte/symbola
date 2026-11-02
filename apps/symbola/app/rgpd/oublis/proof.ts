// RGPD-03 — preuve et modèle de réponse d'une demande d'oubli, dans la langue
// de la titulaire. L'appelant a déjà vérifié le rôle et l'organisation.
import { getLocale, getTranslations } from "next-intl/server";
import { createAppConnection } from "@symbola/db/client";
import { formatCalendarDate, formatDateTime, type Locale } from "@symbola/i18n";
import { starterErasureResponse } from "@symbola/starter-templates";
import { getDocumentHeader, type PrivacyErasureView } from "@/modules/hub/service";
import { buildErasureProofModel, fillTemplate, keptSummary, type ProofLabels, type ProofModel } from "./proof-model";

export async function buildErasureProof(organizationId: string, erasure: PrivacyErasureView): Promise<ProofModel> {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("Privacy");
  const { sql, db } = createAppConnection();
  let organizationName = "";
  try {
    organizationName = (await getDocumentHeader(db, organizationId))?.organizationName ?? "";
  } finally {
    await sql.end();
  }
  const date = (value: string) => formatCalendarDate(value, locale);
  const labels: ProofLabels = {
    title: t("proofTitle"),
    person: t("proofPerson", { person: erasure.request.personLabel }),
    request: t("proofRequest", { receivedOn: date(erasure.request.receivedOn), dueOn: date(erasure.request.dueOn) }),
    validatedAt: t("proofValidatedAt", { date: formatDateTime(erasure.createdAt, locale) }),
    completion: erasure.completedAt ? t("proofCompletedAt", { date: formatDateTime(erasure.completedAt, locale) }) : t("proofNotCompleted"),
    acksTitle: t("proofAcksTitle"),
    itemsTitle: t("proofItemsTitle"),
    keptTitle: t("proofKeptTitle"),
    keptNone: t("proofKeptNone"),
    responseTitle: t("responseTitle"),
    columns: { module: t("proofColumnModule"), kind: t("proofColumnKind"), fate: t("proofColumnFate"), count: t("proofColumnCount") },
    module: (module) => (t.has(`module.${module}`) ? t(`module.${module}`) : module),
    kind: (kind) => (t.has(`kind.${kind}`) ? t(`kind.${kind}`) : kind),
    fate: (fate) => t(`fate.${fate}`),
    ack: (ack) => {
      const module = t.has(`module.${ack.module}`) ? t(`module.${ack.module}`) : ack.module;
      return ack.status === "ok" ? t("ackOk", { module, date: formatDateTime(new Date(ack.at), locale), count: ack.count }) : t("ackFailed", { module });
    },
    keptLine: (kind, until, basis) => t("keptLine", { kind, date: until, basis }),
    basis: (basis) => t(`legalBasis.${basis}`),
    date,
    page: (current, total) => t("pdfPage", { current, total }),
  };
  const template = starterErasureResponse(locale);
  const response = {
    subject: template.subject,
    body: fillTemplate(template.body, {
      person: erasure.request.personLabel,
      receivedOn: date(erasure.request.receivedOn),
      completedOn: erasure.completedAt ? formatDateTime(erasure.completedAt, locale) : "—",
      organization: organizationName,
      kept: [t("responseKeptIntro"), ...keptSummary(erasure, labels).map((line) => `- ${line}`)].join("\n"),
    }),
  };
  return buildErasureProofModel({ erasure, organizationName, language: locale, labels, response });
}
