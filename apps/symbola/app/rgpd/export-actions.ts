"use server";

import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { appDatabase } from "@symbola/db/client";
import { formatDateTime, type Locale } from "@symbola/i18n";
import { getDocumentHeader, listExportablePrivacyRequests, PrivacyExportInvalidError, storePrivacyExport } from "@/modules/hub/service";
import { buildExportArchive, buildExportPdfModel, selectRecordsForExport } from "@/lib/privacy/export";
import { ExportPdfDocument } from "./export-pdf";
import { parseSelection } from "./form-selection";
import { ownerContext } from "./owner-access";
import { pdfSafe } from "@/lib/pdf-text";

export type ExportFormState = { error?: string; exportId?: string; recordCount?: number };

function fieldLabel(t: Awaited<ReturnType<typeof getTranslations<"Privacy">>>, key: string): string {
  if (key.startsWith("imported:")) return t("importedField", { name: key.slice("imported:".length) });
  return t.has(`field.${key}`) ? t(`field.${key}`) : key;
}

// RGPD-02 — export des fiches cochées (droits d'accès et de portabilité).
// Titulaire seulement. Les termes reviennent du formulaire (jamais de l'URL)
// pour relancer la recherche côté serveur : seules des fiches réellement
// trouvées dans l'organisation sont exportées. L'avertissement sur les notes
// internes doit avoir été coché.
export async function exportRecordsAction(_prevState: ExportFormState, formData: FormData): Promise<ExportFormState> {
  const t = await getTranslations("Privacy");
  const owner = await ownerContext();
  if (!owner) return { error: t("ownerOnly") };

  if (formData.get("notesAcknowledged") !== "on") return { error: t("exportConfirmMissing") };
  const parsedSelection = parseSelection(formData);
  const requestIdRaw = String(formData.get("requestId") ?? "");
  // Lot 18 (RGPD-07, décision B) : un export part toujours d'une demande.
  const requestIdCheck = z.uuid().safeParse(requestIdRaw);
  if (!parsedSelection || !requestIdCheck.success) return { error: t("exportInvalid") };
  const requestId = requestIdCheck.data;
  const { terms, selectedKeys } = parsedSelection;

  const selection = await selectRecordsForExport({ organizationId: owner.organizationId, terms, selectedKeys });
  if (selection.status === "empty") return { error: t("exportNoSelection") };
  if (selection.status === "incomplete") return { error: t("exportIncomplete") };
  if (selection.status === "changed") return { error: t("exportChanged") };

  const locale = (await getLocale()) as Locale;
  const generatedAt = new Date();
  const db = appDatabase();
  try {
    // Demande rattachée : d'accès ou de portabilité, en cours, de l'organisation.
    const request = (await listExportablePrivacyRequests(db, owner.organizationId)).find((candidate) => candidate.id === requestId);
    if (!request) return { error: t("exportRequestInvalid") };
    const person = t("pdfPerson", { person: request.personLabel });
    const header = await getDocumentHeader(db, owner.organizationId);
    const organizationName = header?.organizationName ?? "";
    const model = buildExportPdfModel(
      selection.records,
      {
        title: t("pdfTitle"),
        intro: t("pdfIntro", { organization: organizationName }),
        generatedAt: t("pdfGeneratedAt", { date: formatDateTime(generatedAt, locale) }),
        person,
        organizationName,
        module: (module) => (t.has(`module.${module}`) ? t(`module.${module}`) : module),
        kind: (kind) => (t.has(`kind.${kind}`) ? t(`kind.${kind}`) : kind),
        field: (field) => fieldLabel(t, field),
        noFields: t("pdfNoFields"),
        page: (current, total) => t("pdfPage", { current, total }),
      },
      locale,
    );
    const pdf = await renderToBuffer(createElement(ExportPdfDocument, { model: pdfSafe(model) }) as unknown as ReactElement<DocumentProps>);
    const archive = buildExportArchive({ records: selection.records, pdf, generatedAt, organizationName });
    const stored = await storePrivacyExport(db, {
      organizationId: owner.organizationId,
      userId: owner.userId,
      requestId,
      recordCount: selection.records.length,
      pdf,
      archive,
      now: generatedAt,
    });
    revalidatePath("/rgpd");
    revalidatePath(`/rgpd/demandes/${requestId}`);
    return { exportId: stored.id, recordCount: stored.recordCount };
  } catch (error) {
    if (error instanceof PrivacyExportInvalidError) return { error: t("exportRequestInvalid") };
    throw error;
  }
}
