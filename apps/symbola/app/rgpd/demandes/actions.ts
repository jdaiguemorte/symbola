"use server";

// RGPD-04, lot 18 (RGPD-07, ADR 0047) — demandes et leur dossier : création
// (puis ouverture du dossier), prolongation, action menée à la main, réponse
// envoyée, clôture (seulement quand l'action est faite et la réponse envoyée).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { appDatabase, type AppDatabase } from "@symbola/db/client";
import {
  closePrivacyRequest,
  createPrivacyRequest,
  extendPrivacyRequest,
  markPrivacyActionDone,
  markPrivacyResponseSent,
  PRIVACY_REQUEST_TYPES,
  PrivacyRequestInvalidError,
  PrivacyRequestNotFoundError,
} from "@/modules/hub/service";
import { ownerContext } from "../owner-access";

export type RequestFormState = { error?: string; success?: boolean };

const createSchema = z.object({
  type: z.enum(PRIVACY_REQUEST_TYPES),
  personLabel: z.string().trim().min(1).max(200),
  receivedOn: z.iso.date(),
});

async function withDb<T>(fn: (db: AppDatabase) => Promise<T>): Promise<T> {
  const db = appDatabase();
  return await fn(db);
}

function refresh(requestId?: string) {
  revalidatePath("/rgpd");
  if (requestId) revalidatePath(`/rgpd/demandes/${requestId}`);
}

export async function createRequestAction(_prevState: RequestFormState, formData: FormData): Promise<RequestFormState> {
  const t = await getTranslations("Privacy");
  const owner = await ownerContext();
  if (!owner) return { error: t("ownerOnly") };
  const parsed = createSchema.safeParse({ type: formData.get("type"), personLabel: formData.get("personLabel"), receivedOn: formData.get("receivedOn") });
  if (!parsed.success) return { error: t("requestInvalid") };
  let requestId: string;
  try {
    requestId = (await withDb((db) => createPrivacyRequest(db, { ...owner, ...parsed.data }))).id;
  } catch (error) {
    if (error instanceof PrivacyRequestInvalidError) return { error: t(`requestError.${error.code}`) };
    throw error;
  }
  refresh();
  redirect(`/rgpd/demandes/${requestId}`);
}

export async function extendRequestAction(_prevState: RequestFormState, formData: FormData): Promise<RequestFormState> {
  const t = await getTranslations("Privacy");
  const owner = await ownerContext();
  if (!owner) return { error: t("ownerOnly") };
  const requestId = z.uuid().safeParse(formData.get("requestId"));
  if (!requestId.success) return { error: t("requestNotFound") };
  try {
    await withDb((db) =>
      extendPrivacyRequest(db, { organizationId: owner.organizationId, requestId: requestId.data, reason: String(formData.get("reason") ?? "") }),
    );
  } catch (error) {
    if (error instanceof PrivacyRequestInvalidError) return { error: t(`requestError.${error.code}`) };
    if (error instanceof PrivacyRequestNotFoundError) return { error: t("requestNotFound") };
    throw error;
  }
  refresh(requestId.data);
  return { success: true };
}

// Étapes du dossier : chaque bouton enregistre son jalon, puis rouvre le
// dossier sur l'étape suivante. Un jalon refusé (trop tôt, demande close)
// rouvre simplement le dossier, qui montre ce qui manque.
async function caseStep(formData: FormData, step: (db: AppDatabase, input: { organizationId: string; requestId: string }) => Promise<void>, next: string) {
  const owner = await ownerContext();
  if (!owner) return;
  const requestId = z.uuid().safeParse(formData.get("requestId"));
  if (!requestId.success) return;
  try {
    await withDb((db) => step(db, { organizationId: owner.organizationId, requestId: requestId.data }));
  } catch (error) {
    if (!(error instanceof PrivacyRequestInvalidError) && !(error instanceof PrivacyRequestNotFoundError)) throw error;
  }
  refresh(requestId.data);
  redirect(`/rgpd/demandes/${requestId.data}?etape=${next}`);
}

export async function markActionDoneAction(formData: FormData): Promise<void> {
  await caseStep(formData, markPrivacyActionDone, "response");
}

export async function markResponseSentAction(formData: FormData): Promise<void> {
  await caseStep(formData, markPrivacyResponseSent, "closed");
}

export async function closeRequestAction(formData: FormData): Promise<void> {
  await caseStep(formData, closePrivacyRequest, "closed");
}
