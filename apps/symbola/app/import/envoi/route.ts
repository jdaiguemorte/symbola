// IMP-01 — étape « fichier » : type d'éléments choisi, fichier reçu, analysé
// par l'antivirus et lu ; l'import en cours s'ouvre sur l'étape suivante. Lot 16
// (L16-SEC-02, ADR 0044) : par cette route dédiée plutôt qu'une action serveur ;
// origine, session, limite de débit et taille sont vérifiées avant la lecture
// du fichier (lib/uploads/receive.ts). La route renvoie l'adresse de l'étape
// suivante, où le formulaire mène.
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import { getImportColumns, getImportDraft, startEventSheetsImport, startImport, type ImportRejectionReason } from "@/modules/hub/service";
import { saveColumnsIfNothingToDecide } from "@/lib/import/columns";
import { receiveUpload, uploadResponse } from "@/lib/uploads/receive";
import { availableImportEntityTypes, parseEntityType } from "../access";

const REJECTION_MESSAGES: Record<ImportRejectionReason, string> = {
  empty: "rejectedEmpty",
  too_large: "rejectedTooLarge",
  too_many_rows: "rejectedTooManyRows",
  too_many_columns: "rejectedTooManyColumns",
  unsupported_format: "rejectedUnsupported",
  malformed: "rejectedMalformed",
  infected: "rejectedInfected",
};

const HINT_MESSAGES = {
  xls: "rejectedHintXls",
  ods: "rejectedHintOds",
  xlsm: "rejectedHintXlsm",
  encrypted: "rejectedHintEncrypted",
  binary: "rejectedHintBinary",
} as const;

export async function POST(request: Request): Promise<Response> {
  const received = await receiveUpload(request);
  if (!received.ok) return received.response;
  const { user, formData } = received;
  const t = await getTranslations("Import");
  const organizationId = user.organizationId;

  const entityType = parseEntityType(String(formData.get("entityType") ?? ""));
  if (!entityType || !(await availableImportEntityTypes(organizationId)).includes(entityType)) {
    return uploadResponse({ error: t("missingEntityType") });
  }
  const db = appDatabase();
  // Lot 14c (IMP-08) : une ou plusieurs fiches événement PDF.
  if (entityType === "event_sheets") {
    const files = formData.getAll("file").filter((entry): entry is File => entry instanceof File && entry.size > 0);
    if (files.length === 0) return uploadResponse({ error: t("missingFile") });
    const started = await startEventSheetsImport(db, {
      organizationId,
      userId: user.id,
      files: await Promise.all(files.map(async (entry) => ({ fileName: entry.name, bytes: new Uint8Array(await entry.arrayBuffer()) }))),
    });
    if (started.status === "rejected") return uploadResponse({ error: t(started.reason === "too_many_files" ? "rejectedTooManySheets" : "missingFile") });
    revalidatePath("/import");
    return uploadResponse({ redirect: `/import/${started.importId}` });
  }
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return uploadResponse({ error: t("missingFile") });

  const result = await startImport(db, { organizationId, userId: user.id, entityType, fileName: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
  if (result.status === "rejected") {
    // Journalisé sans le nom du fichier ni son contenu (CLAUDE.md §5).
    console.warn("import refusé", { organizationId, reason: result.reason, hint: result.hint });
    const reason = t(REJECTION_MESSAGES[result.reason]);
    return uploadResponse({ error: result.hint ? `${reason} ${t(HINT_MESSAGES[result.hint])}` : reason });
  }
  // Lot 16 (IMP-11) : rien à décider sur les colonnes, l'étape est faite d'office.
  await saveColumnsIfNothingToDecide(organizationId, result.importId);
  revalidatePath("/import");
  // Lot 63b (HUB-14, UX-15) : lignes lues et colonnes reconnues, pour la fenêtre de chargement.
  const [draft, columns] = await Promise.all([getImportDraft(db, organizationId, result.importId), getImportColumns(db, organizationId, result.importId)]);
  const reading = draft && columns ? { rows: draft.rowCount, columns: columns.columns.length, recognized: columns.columns.filter((column) => column.proposedFieldKey !== null || column.profileDecision !== null).length } : undefined;
  return uploadResponse({ redirect: `/import/${result.importId}`, ...(reading ? { reading } : {}) } as Parameters<typeof uploadResponse>[0]);
}
