"use server";

// Lot 63g (HUB-06, HUB-27, ARC-06, SEC-09 ; ADR 0108) — écran « Apps » : demander l'activation d'une app
// pendant le pilote (sans champ libre), annuler la demande tant qu'elle attend, et, libre-service
// ouvert, ajouter l'app à son abonnement par le parcours de « Mon abonnement » (lot 54). La
// Propriétaire seulement ; contrôles côté serveur, refaits par le service. Chaque issue revient sur
// l'écran avec son message.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { appDatabase } from "@symbola/db/client";
import { requireOwner } from "@/lib/guards";
import {
  appOffer,
  cancelModuleRequest,
  changeSubscription,
  getPlanCatalog,
  getSubscription,
  isFeatureEnabled,
  isModuleEnabled,
  isModuleKey,
  ModuleRequestError,
  requestModuleActivation,
  SubscriptionForbiddenError,
  SubscriptionManagedError,
  SubscriptionNotCancellableError,
  SubscriptionSeatsError,
  SubscriptionSelectionError,
} from "@/modules/hub/service";

const BASE = "/apps";
const moduleSchema = z.object({ moduleKey: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/) });
const requestSchema = z.object({ requestId: z.string().uuid() });

async function owner() {
  const auth = await requireOwner();
  if (!auth) redirect(`${BASE}?erreur=forbidden`);
  return auth;
}

function done(outcome: string): never {
  revalidatePath("/", "layout");
  redirect(`${BASE}?${outcome}`);
}

export async function requestAppAction(formData: FormData): Promise<void> {
  const auth = await owner();
  const parsed = moduleSchema.safeParse({ moduleKey: formData.get("moduleKey") });
  if (!parsed.success) done("erreur=unknown_module");
  let outcome = `ok=requested&app=${parsed.data.moduleKey}`;
  try {
    await requestModuleActivation(appDatabase(), { organizationId: auth.user.organizationId, userId: auth.user.id, moduleKey: parsed.data.moduleKey });
  } catch (error) {
    if (!(error instanceof ModuleRequestError)) throw error;
    outcome = `erreur=${error.reason}`;
  }
  done(outcome);
}

export async function cancelAppRequestAction(formData: FormData): Promise<void> {
  const auth = await owner();
  const parsed = requestSchema.safeParse({ requestId: formData.get("requestId") });
  if (!parsed.success) done("erreur=not_found");
  let outcome = "ok=cancelled";
  try {
    await cancelModuleRequest(appDatabase(), { organizationId: auth.user.organizationId, userId: auth.user.id, requestId: parsed.data.requestId });
  } catch (error) {
    if (!(error instanceof ModuleRequestError)) throw error;
    outcome = `erreur=${error.reason}`;
  }
  done(outcome);
}

// Libre-service ouvert : l'option du module s'ajoute à l'offre en cours, avec effet immédiat ; l'écart
// au prorata va sur la facture suivante. L'issue s'affiche dans « Mon abonnement », comme un changement
// fait là.
export async function addAppToSubscriptionAction(formData: FormData): Promise<void> {
  const auth = await owner();
  const db = appDatabase();
  const organizationId = auth.user.organizationId;
  const parsed = moduleSchema.safeParse({ moduleKey: formData.get("moduleKey") });
  if (!parsed.success || !isModuleKey(parsed.data.moduleKey)) done("erreur=unknown_module");
  if (!(await isFeatureEnabled(db, organizationId, "subscription_self_service"))) done("erreur=managed");
  if (await isModuleEnabled(db, organizationId, parsed.data.moduleKey)) done("erreur=already_enabled");
  const offer = appOffer(await getPlanCatalog(db), await getSubscription(db, organizationId), parsed.data.moduleKey, new Date());
  if (offer.kind !== "option") done("erreur=managed");
  let target: string;
  try {
    const change = await changeSubscription(db, { organizationId, userId: auth.user.id, selection: offer.selection });
    target = `/parametres/abonnement?ok=changed&prorata=${change.prorataCents}`;
  } catch (error) {
    if (error instanceof SubscriptionSeatsError) target = `/parametres/abonnement?erreur=seats&places=${error.maxUsers}`;
    else if (error instanceof SubscriptionSelectionError) target = `/parametres/abonnement?erreur=${error.problem}`;
    else if (error instanceof SubscriptionManagedError || error instanceof SubscriptionNotCancellableError) target = `${BASE}?erreur=managed`;
    else if (error instanceof SubscriptionForbiddenError) target = `${BASE}?erreur=forbidden`;
    else throw error;
  }
  revalidatePath("/", "layout");
  redirect(target);
}
