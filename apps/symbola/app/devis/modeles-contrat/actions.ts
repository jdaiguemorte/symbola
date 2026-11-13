"use server";

// Lot 31b (FAC-04, HUB-21, HUB-26, JUR-20 ; D7, D10, partie N) — modèles de contrat : créer,
// modifier le titre et la date de revue, ajouter, modifier, déplacer et supprimer les clauses,
// dupliquer, supprimer, ajouter le modèle de départ. Session planner et organisation vérifiées.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import {
  addContractClause,
  addStarterContractTemplates,
  ContractTemplateNotFoundError,
  createContractTemplate,
  duplicateContractTemplate,
  moveContractClause,
  removeContractClause,
  removeContractTemplate,
  updateContractClause,
  updateContractTemplate,
  type ContractClauseRole,
} from "@/modules/quotes/service";
import { isValidId } from "../module-access";
import { authorizedPlanner } from "../planner-access";

export type ContractTemplateFormState = { error?: string; success?: boolean };

const ROLES: ContractClauseRole[] = ["precontractual_information", "withdrawal_period", "withdrawal_form", "early_execution", "termination", "no_withdrawal", "advance_deposit", "advance_earnest"];

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "");
}

function clauseInput(formData: FormData) {
  const role = text(formData, "role");
  return {
    title: text(formData, "title"),
    body: text(formData, "body"),
    optional: formData.get("optional") === "on",
    role: (ROLES as string[]).includes(role) ? (role as ContractClauseRole) : null,
  };
}

function headerInput(formData: FormData) {
  const eventTypeId = text(formData, "eventTypeId");
  return {
    name: text(formData, "name"),
    title: text(formData, "title"),
    eventTypeId: isValidId(eventTypeId) ? eventTypeId : null,
    legalReviewedOn: text(formData, "legalReviewedOn") || null,
  };
}

async function run(
  formData: FormData,
  idField: "templateId" | "clauseId",
  write: (organizationId: string, id: string) => Promise<void>,
): Promise<ContractTemplateFormState> {
  const t = await getTranslations("Contracts");
  const planner = await authorizedPlanner();
  if (!planner) return { error: t("unauthenticated") };
  const id = text(formData, idField);
  if (!isValidId(id)) return { error: t("templateNotFound") };
  try {
    await write(planner.organizationId, id);
  } catch (error) {
    if (error instanceof ContractTemplateNotFoundError) return { error: t("templateNotFound") };
    if (error instanceof RangeError) return { error: t("templateInvalid") };
    throw error;
  }
  revalidatePath("/devis/modeles-contrat", "layout");
  return { success: true };
}

export async function createContractTemplateAction(_prev: ContractTemplateFormState, formData: FormData): Promise<ContractTemplateFormState> {
  const t = await getTranslations("Contracts");
  const planner = await authorizedPlanner();
  if (!planner) return { error: t("unauthenticated") };
  let id: string;
  try {
    id = (await createContractTemplate({ organizationId: planner.organizationId, ...headerInput(formData) })).id;
  } catch (error) {
    if (error instanceof RangeError) return { error: t("templateInvalid") };
    throw error;
  }
  revalidatePath("/devis/modeles-contrat");
  redirect(`/devis/modeles-contrat/${id}`);
}

export async function updateContractTemplateAction(_prev: ContractTemplateFormState, formData: FormData): Promise<ContractTemplateFormState> {
  return run(formData, "templateId", async (organizationId, templateId) => {
    await updateContractTemplate({ organizationId, templateId, ...headerInput(formData) });
  });
}

export async function addContractClauseAction(_prev: ContractTemplateFormState, formData: FormData): Promise<ContractTemplateFormState> {
  return run(formData, "templateId", async (organizationId, templateId) => {
    await addContractClause(organizationId, templateId, clauseInput(formData));
  });
}

export async function updateContractClauseAction(_prev: ContractTemplateFormState, formData: FormData): Promise<ContractTemplateFormState> {
  return run(formData, "clauseId", async (organizationId, clauseId) => {
    await updateContractClause(organizationId, clauseId, clauseInput(formData));
  });
}

export async function removeContractClauseAction(formData: FormData): Promise<void> {
  await run(formData, "clauseId", async (organizationId, clauseId) => {
    await removeContractClause(organizationId, clauseId);
  });
}

export async function moveContractClauseAction(formData: FormData): Promise<void> {
  await run(formData, "clauseId", async (organizationId, clauseId) => {
    await moveContractClause(organizationId, clauseId, formData.get("direction") === "up" ? "up" : "down");
  });
}

export async function duplicateContractTemplateAction(_prev: ContractTemplateFormState, formData: FormData): Promise<ContractTemplateFormState> {
  const t = await getTranslations("Contracts");
  return run(formData, "templateId", async (organizationId, templateId) => {
    const name = text(formData, "name").trim() || t("templateCopyName", { name: text(formData, "sourceName") }).slice(0, 120);
    await duplicateContractTemplate({ organizationId, templateId, name });
  });
}

export async function removeContractTemplateAction(formData: FormData): Promise<void> {
  const result = await run(formData, "templateId", async (organizationId, templateId) => {
    await removeContractTemplate(organizationId, templateId);
  });
  if (result.success) redirect("/devis/modeles-contrat");
}

export async function addStarterContractTemplatesAction(): Promise<void> {
  const planner = await authorizedPlanner();
  if (!planner) return;
  await addStarterContractTemplates(planner.organizationId, (await getLocale()) === "en" ? "en" : "fr");
  revalidatePath("/devis/modeles-contrat");
}
