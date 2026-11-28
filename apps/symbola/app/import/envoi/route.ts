// IMP-01 — étape « fichier » : type d'éléments choisi, fichier reçu, analysé
// par l'antivirus et lu ; l'import en cours s'ouvre sur l'étape suivante. Lot 16
// (L16-SEC-02, ADR 0044) : par cette route dédiée plutôt qu'une action serveur ;
// origine, session, limite de débit et taille sont vérifiées avant la lecture
// du fichier (lib/uploads/receive.ts). La route renvoie l'adresse de l'étape
// suivante, où le formulaire mène.
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import { getImportColumns, getImportDraft, startEventSheetsImport, startImport, startPdfImport, type ImportRejectionReason, type PdfImportRejection } from "@/modules/hub/service";
import { saveColumnsIfNothingToDecide } from "@/lib/import/columns";
import { receiveUpload, uploadResponse } from "@/lib/uploads/receive";
import { availableImportEntityTypes, availablePdfImportEntityTypes, parseEntityType, parsePdfEntityType } from "../access";
import { getEvent } from "@/modules/events/service";
import { isValidId } from "@/app/events/module-access";
import { parseStepKind } from "@/app/reprise/access";
import { taskListViewer } from "@/lib/event-visibility";
import { takeoverForUpload } from "@/lib/takeover/flow";

const REJECTION_MESSAGES: Record<ImportRejectionReason, string> = {
  empty: "rejectedEmpty",
  too_large: "rejectedTooLarge",
  too_many_rows: "rejectedTooManyRows",
  too_many_columns: "rejectedTooManyColumns",
  unsupported_format: "rejectedUnsupported",
  malformed: "rejectedMalformed",
  infected: "rejectedInfected",
};

const PDF_REJECTION_MESSAGES: Record<PdfImportRejection, string> = {
  empty: "rejected.empty",
  too_large: "rejected.tooLarge",
  infected: "rejected.infected",
  too_many_pages: "rejected.tooManyPages",
  not_pdf: "rejected.notPdf",
  not_event_vendors_pdf: "rejected.notEventVendorsPdf",
  not_program_pdf: "rejected.notProgramPdf",
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

  const requested = String(formData.get("entityType") ?? "");
  // Lot 71e (HUB-14, SEC-21) : un PDF de prestataires retenus ou de programme, pour un mariage seulement.
  const pdfType = parsePdfEntityType(requested);
  const entityType = pdfType ?? parseEntityType(requested);
  if (!entityType || !(pdfType ? (await availablePdfImportEntityTypes(organizationId)).includes(pdfType) : (await availableImportEntityTypes(organizationId)).includes(entityType))) {
    return uploadResponse({ error: t("missingEntityType") });
  }
  const db = appDatabase();
  // Lot 71b (HUB-14) : le fichier d'une ligne de reprise. La reprise est de l'organisation et visible
  // de la personne, la sorte du fichier est celle de sa ligne ; sinon, rien n'est lu (SEC-13).
  const takeoverId = String(formData.get("takeoverId") ?? "");
  const takeoverKind = parseStepKind(formData.get("takeoverKind"));
  const fromTakeover = takeoverId !== "" || takeoverKind !== null;
  const takeover =
    fromTakeover && isValidId(takeoverId) && takeoverKind
      ? await takeoverForUpload({ organizationId, userId: user.id, viewer: await taskListViewer({ user: { id: user.id, role: user.role, organizationId } }) }, takeoverId, takeoverKind)
      : null;
  if (fromTakeover && (!takeover || takeover.entityType !== entityType)) return uploadResponse({ error: t("importNotFound") });
  // Lot 14c (IMP-08) : une ou plusieurs fiches événement PDF.
  if (entityType === "event_sheets") {
    const files = formData.getAll("file").filter((entry): entry is File => entry instanceof File && entry.size > 0);
    if (files.length === 0) return uploadResponse({ error: t("missingFile") });
    // Lot 71b : une reprise, un mariage, une fiche.
    if (takeover && files.length > 1) return uploadResponse({ error: (await getTranslations("Takeover"))("oneSheet") });
    const started = await startEventSheetsImport(db, {
      organizationId,
      userId: user.id,
      files: await Promise.all(files.map(async (entry) => ({ fileName: entry.name, bytes: new Uint8Array(await entry.arrayBuffer()) }))),
    });
    if (started.status === "rejected") return uploadResponse({ error: t(started.reason === "too_many_files" ? "rejectedTooManySheets" : "missingFile") });
    if (takeover) await takeover.attach(started.importId);
    revalidatePath("/import");
    return uploadResponse({ redirect: `/import/${started.importId}` });
  }
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return uploadResponse({ error: t("missingFile") });

  if (pdfType) {
    const targetId = String(formData.get("targetEventId") ?? "");
    const eventId = takeover ? takeover.targetEventId : isValidId(targetId) ? targetId : null;
    const event = eventId ? await getEvent(organizationId, eventId).catch(() => null) : null;
    // Un mariage d'une autre organisation, ou un essai : la même réponse qu'un import inexistant (SEC-13).
    if (!event || event.isDemo) return uploadResponse({ error: t("importNotFound") });
    const started = await startPdfImport(db, { organizationId, userId: user.id, entityType: pdfType, fileName: file.name, bytes: new Uint8Array(await file.arrayBuffer()), targetEventId: event.id });
    if (started.status === "rejected") {
      // Journalisé sans le nom du fichier ni son contenu (SEC-20).
      console.warn("import refusé", { organizationId, reason: started.reason });
      return uploadResponse({ error: (await getTranslations("ImportPdf"))(PDF_REJECTION_MESSAGES[started.reason]) });
    }
    if (takeover) await takeover.attach(started.importId);
    revalidatePath("/import");
    return uploadResponse({ redirect: `/import/${started.importId}/pdf` });
  }

  // Lot 65g (HUB-14, BUD-04) : l'évènement d'où l'import est lancé, s'il est bien de l'organisation.
  const targetId = String(formData.get("targetEventId") ?? "");
  const targetEventId = takeover
    ? takeover.targetEventId
    : (entityType === "budget_lines" || entityType === "tasks") && isValidId(targetId) && (await getEvent(organizationId, targetId).catch(() => null))
      ? targetId
      : null;
  const result = await startImport(db, { organizationId, userId: user.id, entityType, fileName: file.name, bytes: new Uint8Array(await file.arrayBuffer()), targetEventId });
  if (result.status === "rejected") {
    // Journalisé sans le nom du fichier ni son contenu (CLAUDE.md §5).
    console.warn("import refusé", { organizationId, reason: result.reason, hint: result.hint });
    const reason = t(REJECTION_MESSAGES[result.reason]);
    return uploadResponse({ error: result.hint ? `${reason} ${t(HINT_MESSAGES[result.hint])}` : reason });
  }
  // Lot 71b : rattaché à sa ligne avant l'enregistrement des colonnes (un budget qui nomme ses
  // prestataires couvre leur ligne dès ce moment).
  if (takeover) await takeover.attach(result.importId);
  // Lot 16 (IMP-11) : rien à décider sur les colonnes, l'étape est faite d'office.
  await saveColumnsIfNothingToDecide(organizationId, result.importId);
  revalidatePath("/import");
  // Lot 63b (HUB-14, UX-15) : lignes lues et colonnes reconnues, pour la fenêtre de chargement.
  const [draft, columns] = await Promise.all([getImportDraft(db, organizationId, result.importId), getImportColumns(db, organizationId, result.importId)]);
  const reading = draft && columns ? { rows: draft.rowCount, columns: columns.columns.length, recognized: columns.columns.filter((column) => column.proposedFieldKey !== null || column.profileDecision !== null).length } : undefined;
  return uploadResponse({ redirect: `/import/${result.importId}`, ...(reading ? { reading } : {}) } as Parameters<typeof uploadResponse>[0]);
}
