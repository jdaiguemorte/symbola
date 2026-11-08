"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { appDatabase, type AppDatabase } from "@symbola/db/client";
import {
  closePrivacyRequest,
  createPrivacyRequest,
  extendPrivacyRequest,
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

export async function createRequestAction(_prevState: RequestFormState, formData: FormData): Promise<RequestFormState> {
  const t = await getTranslations("Privacy");
  const owner = await ownerContext();
  if (!owner) return { error: t("ownerOnly") };
  const parsed = createSchema.safeParse({ type: formData.get("type"), personLabel: formData.get("personLabel"), receivedOn: formData.get("receivedOn") });
  if (!parsed.success) return { error: t("requestInvalid") };
  try {
    await withDb((db) => createPrivacyRequest(db, { ...owner, ...parsed.data }));
  } catch (error) {
    if (error instanceof PrivacyRequestInvalidError) return { error: t(`requestError.${error.code}`) };
    throw error;
  }
  revalidatePath("/rgpd/demandes");
  return { success: true };
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
  revalidatePath("/rgpd/demandes");
  return { success: true };
}

export async function closeRequestAction(formData: FormData): Promise<void> {
  const owner = await ownerContext();
  if (!owner) return;
  const requestId = z.uuid().safeParse(formData.get("requestId"));
  if (!requestId.success) return;
  try {
    await withDb((db) => closePrivacyRequest(db, { organizationId: owner.organizationId, requestId: requestId.data }));
  } catch (error) {
    if (!(error instanceof PrivacyRequestNotFoundError)) throw error;
  }
  revalidatePath("/rgpd/demandes");
}
