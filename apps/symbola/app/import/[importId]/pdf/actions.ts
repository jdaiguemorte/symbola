"use server";

// Lot 71e (HUB-14 ; spécification du lot 71, § 5.5 ; maquettes 10 et 11) — les gestes de l'écran d'un PDF
// de prestataires retenus ou de programme : répondre au contrôle du couple, choisir un autre fichier,
// enregistrer les choix (contrats, fiches, postes, interlocuteurs) et importer. Session, organisation et
// rôle vérifiés ici ; les identifiants choisis (fiches, postes) sont revérifiés contre l'organisation à
// chaque lecture du brouillon (SEC-12, SEC-13).
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { appDatabase } from "@symbola/db/client";
import { cancelImport, getImportAnswers, getImportTakeoverId, getPdfImportDraft, saveImportAnswers, savePdfImportDecisions, type ImportPdfDecisions } from "@/modules/hub/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { confirmProgramImport, confirmVendorsImport } from "@/lib/import/pdf-imports";
import { isValidId } from "../../access";

async function context(formData: FormData): Promise<{ organizationId: string; userId: string; importId: string } | null> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return null;
  const importId = String(formData.get("importId") ?? "");
  if (!isValidId(importId)) return null;
  return { organizationId: auth.user.organizationId, userId: auth.user.id, importId };
}

const here = (importId: string) => `/import/${importId}/pdf`;

// « C'est bien ce mariage, continuer » : la réponse est gardée, et redite au bilan.
export async function confirmCoupleAction(formData: FormData): Promise<void> {
  const ctx = await context(formData);
  if (!ctx) return;
  await savePdfImportDecisions(appDatabase(), { organizationId: ctx.organizationId, importId: ctx.importId, decisions: { coupleConfirmed: true } });
  revalidatePath(here(ctx.importId));
  redirect(here(ctx.importId));
}

// « Choisir un autre fichier » : ce brouillon est abandonné, et l'envoi s'ouvre de nouveau, pour le même
// mariage (ou la même ligne de reprise).
export async function chooseOtherFileAction(formData: FormData): Promise<void> {
  const ctx = await context(formData);
  if (!ctx) return;
  const db = appDatabase();
  const draft = await getPdfImportDraft(db, ctx.organizationId, ctx.importId);
  if (!draft) redirect("/import");
  const takeoverId = await getImportTakeoverId(db, ctx.organizationId, ctx.importId);
  await cancelImport(db, ctx.organizationId, ctx.importId);
  revalidatePath("/import");
  redirect(takeoverId ? `/import?type=${draft.entityType}&reprise=${takeoverId}#import-form` : `/import?type=${draft.entityType}&evenement=${draft.targetEventId}#import-form`);
}

const LINE = /^(vendor|slot|contract)-(\d{1,3})$/;

// Les choix de l'écran des prestataires : la réponse aux contrats, puis, par ligne du fichier, la fiche,
// le poste, « Reprendre » et le contrat (« Ligne par ligne »). `intent=import` importe ensuite.
export async function saveVendorsAction(formData: FormData): Promise<void> {
  const ctx = await context(formData);
  if (!ctx) return;
  const db = appDatabase();
  const answer = String(formData.get("contracts") ?? "");
  const lines = formData
    .getAll("line")
    .map((value) => Number(value))
    .filter((line) => Number.isInteger(line) && line > 0 && line < 1000);
  const kept = new Set(formData.getAll("keep").map((value) => Number(value)));
  const rows = new Map<number, NonNullable<ImportPdfDecisions["vendorRows"]>[number]>(lines.map((line) => [line, { line, skip: !kept.has(line), reviewed: true }]));
  const signed: number[] = [];
  for (const [key, value] of formData.entries()) {
    const match = LINE.exec(key);
    if (!match || typeof value !== "string") continue;
    const line = Number(match[2]);
    const row = rows.get(line);
    if (!row) continue;
    if (match[1] === "contract") {
      if (value === "signed") signed.push(line);
      continue;
    }
    if (value !== "new" && !isValidId(value)) continue;
    row[match[1] as "vendor" | "slot"] = value;
  }
  if (answer === "all" || answer === "none" || answer === "per_line") {
    const answers = (await getImportAnswers(db, ctx.organizationId, ctx.importId)) ?? {};
    const perLineSent = formData.has("contractsPerLine");
    await saveImportAnswers(db, {
      organizationId: ctx.organizationId,
      importId: ctx.importId,
      answers: { ...answers, contracts: answer === "per_line" ? { answer, signedRows: perLineSent ? signed : (answers.contracts?.signedRows ?? []) } : { answer } },
    });
  }
  await savePdfImportDecisions(db, { organizationId: ctx.organizationId, importId: ctx.importId, decisions: { vendorRows: [...rows.values()], ...(formData.get("intent") ? { reviewed: true } : {}) } });
  if (formData.get("intent") === "import") {
    const result = await confirmVendorsImport({ organizationId: ctx.organizationId, userId: ctx.userId, importId: ctx.importId });
    if (result.status === "applied") {
      revalidatePath("/import");
      redirect(`/import/${ctx.importId}/journal`);
    }
    redirect(`${here(ctx.importId)}?bloque=${result.status === "blocked" ? result.reason : "introuvable"}`);
  }
  revalidatePath(here(ctx.importId));
  redirect(`${here(ctx.importId)}${formData.get("intent") === "continue" ? "#verifier" : ""}`);
}

// Les interlocuteurs d'un programme : le poste de chaque intervenant de l'en-tête (« texte » : aucun).
export async function saveProgramAction(formData: FormData): Promise<void> {
  const ctx = await context(formData);
  if (!ctx) return;
  const speakerSlots: { index: number; slotId: string | null }[] = [];
  for (const [key, value] of formData.entries()) {
    const match = /^speaker-(\d{1,3})$/.exec(key);
    if (!match || typeof value !== "string") continue;
    if (value !== "" && !isValidId(value)) continue;
    speakerSlots.push({ index: Number(match[1]), slotId: value === "" ? null : value });
  }
  await savePdfImportDecisions(appDatabase(), { organizationId: ctx.organizationId, importId: ctx.importId, decisions: { speakerSlots, ...(formData.get("intent") ? { reviewed: true } : {}) } });
  if (formData.get("intent") === "import") {
    const result = await confirmProgramImport({ organizationId: ctx.organizationId, userId: ctx.userId, importId: ctx.importId });
    if (result.status === "applied") {
      revalidatePath("/import");
      redirect(`/import/${ctx.importId}/journal`);
    }
    redirect(`${here(ctx.importId)}?bloque=${result.status === "blocked" ? result.reason : "introuvable"}`);
  }
  revalidatePath(here(ctx.importId));
  redirect(`${here(ctx.importId)}${formData.get("intent") === "continue" ? "#verifier" : ""}`);
}
