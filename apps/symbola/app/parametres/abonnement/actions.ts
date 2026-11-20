"use server";

// Lot 54 (HUB-27, ARC-06 ; D1, D2 ; ADR 0101) — « Mon abonnement » : changer d'offre (effet immédiat),
// résilier (« Résilier » puis « Confirmer la résiliation »), revenir sur la résiliation. La
// Propriétaire seulement, même en lecture seule (fin d'essai) ; contrôles côté serveur, refaits par le
// service. Chaque issue revient sur l'écran avec son message.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { appDatabase } from "@symbola/db/client";
import { requireOwner } from "@/lib/guards";
import {
  BILLING_PERIODS,
  cancelSubscription,
  changeSubscription,
  isFeatureEnabled,
  resumeSubscription,
  SubscriptionForbiddenError,
  SubscriptionManagedError,
  SubscriptionNotCancellableError,
  SubscriptionNotResumableError,
  SubscriptionSeatsError,
  SubscriptionSelectionError,
} from "@/modules/hub/service";

const BASE = "/parametres/abonnement";
const KEY = /^[a-z][a-z0-9_]{0,39}$/;

const selectionSchema = z.object({
  planKey: z.string().regex(KEY),
  chosenModule: z.string().regex(KEY).nullable(),
  options: z.array(z.string().regex(KEY)).max(20),
  storageUnits: z.coerce.number().int().min(0).max(1000),
  billingPeriod: z.enum(BILLING_PERIODS),
});

async function owner() {
  const auth = await requireOwner({ allowReadOnly: true });
  if (!auth) redirect(`${BASE}?erreur=forbidden`);
  if (!(await isFeatureEnabled(appDatabase(), auth.user.organizationId, "subscription_self_service"))) redirect(`${BASE}?erreur=managed`);
  return auth;
}

function refusal(error: unknown): string | null {
  if (error instanceof SubscriptionSelectionError) return `erreur=${error.problem}`;
  if (error instanceof SubscriptionSeatsError) return `erreur=seats&places=${error.maxUsers}`;
  if (error instanceof SubscriptionManagedError) return "erreur=managed";
  if (error instanceof SubscriptionForbiddenError) return "erreur=forbidden";
  if (error instanceof SubscriptionNotCancellableError) return "erreur=not_cancellable";
  if (error instanceof SubscriptionNotResumableError) return "erreur=not_resumable";
  return null;
}

export async function changeSubscriptionAction(formData: FormData): Promise<void> {
  const auth = await owner();
  const chosen = formData.get("chosenModule");
  const parsed = selectionSchema.safeParse({
    planKey: formData.get("planKey"),
    chosenModule: typeof chosen === "string" && chosen !== "" ? chosen : null,
    options: formData.getAll("options").filter((value): value is string => typeof value === "string"),
    storageUnits: formData.get("storageUnits") || 0,
    billingPeriod: formData.get("billingPeriod") ?? "monthly",
  });
  if (!parsed.success) redirect(`${BASE}?erreur=unknown_plan`);
  let outcome: string;
  try {
    const change = await changeSubscription(appDatabase(), { organizationId: auth.user.organizationId, userId: auth.user.id, selection: parsed.data });
    outcome = `ok=changed&prorata=${change.prorataCents}`;
  } catch (error) {
    const refused = refusal(error);
    if (!refused) throw error;
    outcome = refused;
  }
  revalidatePath("/", "layout");
  redirect(`${BASE}?${outcome}`);
}

export async function cancelSubscriptionAction(): Promise<void> {
  const auth = await owner();
  let outcome: string;
  try {
    await cancelSubscription(appDatabase(), { organizationId: auth.user.organizationId, userId: auth.user.id });
    outcome = "ok=cancelled";
  } catch (error) {
    const refused = refusal(error);
    if (!refused) throw error;
    outcome = refused;
  }
  revalidatePath("/", "layout");
  redirect(`${BASE}?${outcome}`);
}

export async function resumeSubscriptionAction(): Promise<void> {
  const auth = await owner();
  let outcome: string;
  try {
    await resumeSubscription(appDatabase(), { organizationId: auth.user.organizationId, userId: auth.user.id });
    outcome = "ok=resumed";
  } catch (error) {
    const refused = refusal(error);
    if (!refused) throw error;
    outcome = refused;
  }
  revalidatePath("/", "layout");
  redirect(`${BASE}?${outcome}`);
}
