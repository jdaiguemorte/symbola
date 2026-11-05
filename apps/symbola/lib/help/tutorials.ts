// Lot 10 (AIDE-06) — tutoriels « en faisant » : chaque tutoriel est une suite
// d'étapes. « setup » crée l'exemple fictif (marqué démo), « do » fait agir
// l'utilisateur dans le vrai écran puis vérifie le résultat par le service du
// module, « explain » et « look » expliquent, « finish » propose de garder ou
// de supprimer l'exemple. Les textes sont dans « Tutorials.<clé>.steps ».
// Côté serveur seulement : les vérifications passent par les service.ts.
import { starterTutorialTaskTemplate, starterTutorialVendors, starterVendorSlots } from "@symbola/starter-templates";
import { createAppConnection } from "@symbola/db/client";
import { getEventBudget, listBudgetLines } from "@/modules/budget/service";
import {
  createTaskTemplate,
  getEvent,
  getEventProgram,
  listEventTasks,
  listEventVendorSlots,
  listTaskTemplates,
  removeTaskTemplate,
  listVendorCandidates,
  startTutorialEvent,
} from "@/modules/events/service";
import { createVendor, removeDemoVendors } from "@/modules/vendors/service";
import { isModuleEnabled } from "@/modules/hub/service";
import { listImports } from "@/modules/hub/service";
import { archiveCatalogItem, getQuote, listCatalogItems, listQuoteInvoices, startQuotesTrial } from "@/modules/quotes/service";
import { endTrial } from "@/lib/demo-purge";
import type { TutorialKey } from "./catalog";

export type TutorialContext = Record<string, string>;
export type TutorialEnv = { organizationId: string; userId: string; locale: "fr" | "en"; context: TutorialContext };
export type StepKind = "explain" | "setup" | "do" | "look" | "finish";
export type TutorialStep = {
  kind: StepKind;
  // Écran où agir ou regarder (sur l'exemple fictif).
  href?: (context: TutorialContext) => string;
  check?: (env: TutorialEnv) => Promise<boolean>;
};
export type TutorialScript = {
  steps: TutorialStep[];
  setup?: (env: TutorialEnv) => Promise<TutorialContext>;
  // Garder une partie de l'exemple (un modèle, une prestation) : oui ou non.
  keepable?: boolean;
  cleanup: (env: TutorialEnv, keep: boolean) => Promise<void>;
};

const eventTab = (tab: string) => (context: TutorialContext) => `/events/${context.eventId}?onglet=${tab}`;
const quotePage = (context: TutorialContext) => `/devis/${context.quoteId}`;

async function exampleEvent(env: TutorialEnv, key: TutorialKey): Promise<TutorialContext> {
  const event = await startTutorialEvent({ organizationId: env.organizationId, userId: env.userId, locale: env.locale, tutorialKey: key });
  const detail = await getEvent(env.organizationId, event.eventId);
  return { eventId: event.eventId, initialDate: detail?.eventDate ?? "" };
}

async function exampleQuote(env: TutorialEnv, key: TutorialKey): Promise<TutorialContext> {
  const context = await exampleEvent(env, key);
  const quote = await startQuotesTrial({ organizationId: env.organizationId, eventId: context.eventId!, createdByUserId: env.userId, locale: env.locale });
  return { ...context, quoteId: quote.id };
}

async function removeExampleEvent(env: TutorialEnv): Promise<void> {
  if (env.context.eventId) await endTrial(env.organizationId, env.context.eventId);
}

const quoteSigned = async (env: TutorialEnv) => (await getQuote(env.organizationId, env.context.quoteId!)).status === "signed";

// Lot 11 : poste « Traiteur » de l'exemple (sinon le premier poste).
const slotTab = (context: TutorialContext) => `/events/${context.eventId}?onglet=budget&poste=${context.slotId}`;
const slotCandidates = async (env: TutorialEnv) =>
  (await listVendorCandidates(env.organizationId, env.context.eventId!)).filter((candidate) => candidate.vendorSlotId === env.context.slotId);

async function vendorsEnabled(organizationId: string): Promise<boolean> {
  const { sql, db } = createAppConnection();
  try {
    return await isModuleEnabled(db, organizationId, "vendors");
  } finally {
    await sql.end();
  }
}

export const TUTORIAL_SCRIPTS: Record<TutorialKey, TutorialScript> = {
  "event-page": {
    setup: (env) => exampleEvent(env, "event-page"),
    steps: [
      { kind: "explain" },
      { kind: "setup" },
      { kind: "do", href: eventTab("apercu"), check: async (env) => (await getEvent(env.organizationId, env.context.eventId!))?.status === "confirmed" },
      {
        kind: "do",
        href: eventTab("prestataires"),
        check: async (env) => (await listEventVendorSlots(env.organizationId, env.context.eventId!)).some((slot) => slot.status === "booked"),
      },
      { kind: "do", href: eventTab("retroplanning"), check: async (env) => (await listEventTasks(env.organizationId, env.context.eventId!)).some((task) => task.done) },
      { kind: "finish" },
    ],
    cleanup: (env) => removeExampleEvent(env),
  },
  "retroplanning-template": {
    setup: async (env) => {
      const context = await exampleEvent(env, "retroplanning-template");
      const example = starterTutorialTaskTemplate(env.locale);
      const template = await createTaskTemplate(env.organizationId, example.name, example.items);
      return { ...context, templateId: template.id };
    },
    steps: [
      { kind: "explain" },
      { kind: "setup" },
      { kind: "look", href: () => "/events/modeles" },
      { kind: "do", href: eventTab("retroplanning"), check: async (env) => (await listEventTasks(env.organizationId, env.context.eventId!)).length > 0 },
      { kind: "do", href: eventTab("apercu"), check: async (env) => ((await getEvent(env.organizationId, env.context.eventId!))?.eventDate ?? "") !== env.context.initialDate },
      { kind: "finish" },
    ],
    keepable: true,
    cleanup: async (env, keep) => {
      await removeExampleEvent(env);
      if (!keep && env.context.templateId) {
        const exists = (await listTaskTemplates(env.organizationId)).some((template) => template.id === env.context.templateId);
        if (exists) await removeTaskTemplate(env.organizationId, env.context.templateId);
      }
    },
  },
  catalog: {
    setup: async (env) => ({ baseline: (await listCatalogItems(env.organizationId, { includeArchived: true })).map((item) => item.id).join(",") }),
    steps: [
      { kind: "explain" },
      { kind: "setup" },
      {
        kind: "do",
        href: () => "/devis/catalogue",
        check: async (env) => {
          const baseline = new Set((env.context.baseline ?? "").split(",").filter(Boolean));
          return (await listCatalogItems(env.organizationId)).some((item) => !baseline.has(item.id));
        },
      },
      { kind: "look" },
      { kind: "finish" },
    ],
    keepable: true,
    cleanup: async (env, keep) => {
      if (keep) return;
      const baseline = new Set((env.context.baseline ?? "").split(",").filter(Boolean));
      for (const item of await listCatalogItems(env.organizationId)) {
        if (!baseline.has(item.id)) await archiveCatalogItem(env.organizationId, item.id);
      }
    },
  },
  "quote-signature": {
    setup: (env) => exampleQuote(env, "quote-signature"),
    steps: [
      { kind: "explain" },
      { kind: "setup" },
      { kind: "do", href: quotePage, check: async (env) => (await getQuote(env.organizationId, env.context.quoteId!)).signature !== null },
      { kind: "do", href: quotePage, check: quoteSigned },
      { kind: "finish" },
    ],
    cleanup: (env) => removeExampleEvent(env),
  },
  "deposit-invoice": {
    setup: (env) => exampleQuote(env, "deposit-invoice"),
    steps: [
      { kind: "explain" },
      { kind: "setup" },
      { kind: "do", href: quotePage, check: quoteSigned },
      { kind: "do", href: quotePage, check: async (env) => (await listQuoteInvoices(env.organizationId, env.context.quoteId!)).some((invoice) => invoice.kind === "deposit") },
      { kind: "do", href: quotePage, check: async (env) => (await listQuoteInvoices(env.organizationId, env.context.quoteId!)).some((invoice) => invoice.kind === "balance") },
      { kind: "finish" },
    ],
    cleanup: (env) => removeExampleEvent(env),
  },
  "budget-simulation": {
    setup: (env) => exampleEvent(env, "budget-simulation"),
    steps: [
      { kind: "explain" },
      { kind: "setup" },
      { kind: "do", href: (context) => `/budget/${context.eventId}`, check: async (env) => (await getEventBudget(env.organizationId, env.context.eventId!)) !== null },
      {
        kind: "do",
        href: (context) => `/budget/${context.eventId}`,
        check: async (env) => (await listBudgetLines(env.organizationId, env.context.eventId!)).totalActualCents > 0,
      },
      { kind: "finish" },
    ],
    cleanup: (env) => removeExampleEvent(env),
  },
  "day-program": {
    setup: (env) => exampleEvent(env, "day-program"),
    steps: [
      { kind: "explain" },
      { kind: "setup" },
      { kind: "do", href: eventTab("programme"), check: async (env) => (await getEventProgram(env.organizationId, env.context.eventId!)).items.length > 0 },
      { kind: "look", href: eventTab("programme") },
      { kind: "finish" },
    ],
    cleanup: (env) => removeExampleEvent(env),
  },
  "client-space": {
    setup: (env) => exampleEvent(env, "client-space"),
    steps: [{ kind: "explain" }, { kind: "setup" }, { kind: "look", href: eventTab("maries") }, { kind: "look", href: eventTab("retroplanning") }, { kind: "finish" }],
    cleanup: (env) => removeExampleEvent(env),
  },
  import: {
    setup: async (env) => {
      const { sql, db } = createAppConnection();
      try {
        return { baseline: (await listImports(db, env.organizationId)).map((entry) => entry.id).join(",") };
      } finally {
        await sql.end();
      }
    },
    steps: [
      { kind: "explain" },
      { kind: "setup" },
      {
        kind: "do",
        href: () => "/import",
        check: async (env) => {
          const baseline = new Set((env.context.baseline ?? "").split(",").filter(Boolean));
          const { sql, db } = createAppConnection();
          try {
            return (await listImports(db, env.organizationId)).some((entry) => !baseline.has(entry.id));
          } finally {
            await sql.end();
          }
        },
      },
      { kind: "look" },
      { kind: "finish" },
    ],
    cleanup: async () => {},
  },
  "vendor-quotes": {
    setup: async (env) => {
      const context = await exampleEvent(env, "vendor-quotes");
      const slots = await listEventVendorSlots(env.organizationId, context.eventId!);
      const caterer = starterVendorSlots(env.locale)[1];
      const slot = slots.find((candidate) => candidate.label === caterer) ?? slots[0];
      // Avec le carnet : deux traiteurs d'exemple à choisir (supprimés à la fin).
      const vendorIds: string[] = [];
      if (await vendorsEnabled(env.organizationId)) {
        for (const vendor of starterTutorialVendors(env.locale)) {
          const created = await createVendor(env.organizationId, { name: vendor.name, typeId: null, city: vendor.city, internalNote: vendor.note }, { isDemo: true });
          vendorIds.push(created.vendor.id);
        }
      }
      return { ...context, slotId: slot?.id ?? "", vendorIds: vendorIds.join(",") };
    },
    steps: [
      { kind: "explain" },
      { kind: "setup" },
      { kind: "do", href: slotTab, check: async (env) => (await slotCandidates(env)).length >= 2 },
      { kind: "do", href: slotTab, check: async (env) => (await slotCandidates(env)).some((candidate) => candidate.quoteAmountCents !== null || candidate.hasQuoteFile) },
      { kind: "do", href: slotTab, check: async (env) => (await slotCandidates(env)).some((candidate) => candidate.outcome === "selected") },
      { kind: "look", href: slotTab },
      { kind: "finish" },
    ],
    cleanup: async (env) => {
      await removeExampleEvent(env);
      await removeDemoVendors(env.organizationId, (env.context.vendorIds ?? "").split(",").filter(Boolean));
    },
  },
};

