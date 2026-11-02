"use server";

import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { createAppConnection } from "@symbola/db/client";
import { formatDateTime, type Locale } from "@symbola/i18n";
import { getDocumentHeader, listExportablePrivacyRequests, PrivacyExportInvalidError, storePrivacyExport } from "@/modules/hub/service";
import { buildExportArchive, buildExportPdfModel, selectRecordsForExport } from "@/lib/privacy/export";
import { ExportPdfDocument } from "./export-pdf";
import { ownerContext } from "./owner-access";

export type ExportFormState = { error?: string; exportId?: string; recordCount?: number };

const exportSchema = z.object({
  email: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(50).optional(),
  name: z.string().trim().max(200).optional(),
  records: z.array(z.string().max(200)).max(5000),
  requestId: z.union([z.literal(""), z.uuid()]),
  notesAcknowledged: z.literal("on"),
});

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

  const raw = {
    email: formData.get("email") ?? undefined,
    phone: formData.get("phone") ?? undefined,
    name: formData.get("name") ?? undefined,
    records: formData.getAll("record"),
    requestId: formData.get("requestId") ?? "",
    notesAcknowledged: formData.get("notesAcknowledged") ?? undefined,
  };
  if (raw.notesAcknowledged !== "on") return { error: t("exportConfirmMissing") };
  const parsed = exportSchema.safeParse(raw);
  if (!parsed.success) return { error: t("exportInvalid") };
  const { records: selectedKeys, requestId } = parsed.data;
  const terms = { email: parsed.data.email, phone: parsed.data.phone, name: parsed.data.name };

  const selection = await selectRecordsForExport({ organizationId: owner.organizationId, terms, selectedKeys });
  if (selection.status === "empty") return { error: t("exportNoSelection") };
  if (selection.status === "incomplete") return { error: t("exportIncomplete") };
  if (selection.status === "changed") return { error: t("exportChanged") };

  const locale = (await getLocale()) as Locale;
  const generatedAt = new Date();
  const { sql, db } = createAppConnection();
  try {
    // Demande rattachée : d'accès ou de portabilité, en cours, de l'organisation.
    let person: string | null = null;
    if (requestId !== "") {
      const request = (await listExportablePrivacyRequests(db, owner.organizationId)).find((candidate) => candidate.id === requestId);
      if (!request) return { error: t("exportRequestInvalid") };
      person = t("pdfPerson", { person: request.personLabel });
    }
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
    const pdf = await renderToBuffer(createElement(ExportPdfDocument, { model }) as unknown as ReactElement<DocumentProps>);
    const archive = buildExportArchive({ records: selection.records, pdf, generatedAt, organizationName });
    const stored = await storePrivacyExport(db, {
      organizationId: owner.organizationId,
      userId: owner.userId,
      requestId: requestId === "" ? null : requestId,
      recordCount: selection.records.length,
      pdf,
      archive,
      now: generatedAt,
    });
    revalidatePath("/rgpd");
    return { exportId: stored.id, recordCount: stored.recordCount };
  } catch (error) {
    if (error instanceof PrivacyExportInvalidError) return { error: t("exportRequestInvalid") };
    throw error;
  } finally {
    await sql.end();
  }
}
