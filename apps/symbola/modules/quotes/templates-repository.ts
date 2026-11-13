// Lot 31a (FAC-01, HUB-21, décision D3) — accès aux modèles de devis : sections, lignes,
// options et échéancier type. Un modèle se copie dans un devis neuf ; le modifier ensuite
// ne change aucun devis. Jamais importé hors de modules/quotes/ (ADR 0011).
import { and, asc, eq, inArray, sql as raw } from "drizzle-orm";
import { appDatabase } from "@symbola/db/client";
import {
  paymentScheduleItems,
  quoteLines,
  quoteSections,
  quotes,
  quoteTemplateLines,
  quoteTemplates,
  quoteTemplateScheduleItems,
  quoteTemplateSections,
  quoteVersions,
} from "@symbola/db/schema/quotes";
import { withOrganization } from "@symbola/db/with-organization";

type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];

export type QuoteTemplateRow = typeof quoteTemplates.$inferSelect;
export type QuoteTemplateSectionRow = typeof quoteTemplateSections.$inferSelect;
export type QuoteTemplateLineRow = typeof quoteTemplateLines.$inferSelect;
export type QuoteTemplateScheduleRow = typeof quoteTemplateScheduleItems.$inferSelect;

export type TemplateWithContent = {
  template: QuoteTemplateRow;
  sections: QuoteTemplateSectionRow[];
  lines: QuoteTemplateLineRow[];
  schedule: QuoteTemplateScheduleRow[];
};

// Contenu d'un modèle : les sections sont repérées par une clé locale, que les lignes citent.
export type TemplateContent = {
  globalDiscountKind: "none" | "percent" | "amount";
  globalDiscountValue: number;
  advanceKind: "deposit" | "earnest" | null;
  sections: { key: string; title: string }[];
  lines: {
    sectionKey: string | null;
    catalogItemId: string | null;
    label: string;
    description: string | null;
    unit: string;
    quantityMilli: number;
    unitPriceCents: number;
    vatRateBasisPoints: number;
    discountBasisPoints: number;
    isOption: boolean;
  }[];
  schedule: {
    label: string;
    amountCents: number | null;
    percentageBasisPoints: number | null;
    dueRule: "at_signature" | "before_event";
    daysBeforeEvent: number | null;
  }[];
};

async function inOrganization<T>(organizationId: string, work: (tx: Tx) => Promise<T>): Promise<T> {
  return withOrganization(appDatabase(), organizationId, work);
}

async function contentOf(tx: Tx, templates: QuoteTemplateRow[]): Promise<TemplateWithContent[]> {
  if (templates.length === 0) return [];
  const ids = templates.map((template) => template.id);
  const sections = await tx.select().from(quoteTemplateSections).where(inArray(quoteTemplateSections.templateId, ids)).orderBy(asc(quoteTemplateSections.position));
  const lines = await tx.select().from(quoteTemplateLines).where(inArray(quoteTemplateLines.templateId, ids)).orderBy(asc(quoteTemplateLines.position));
  const schedule = await tx.select().from(quoteTemplateScheduleItems).where(inArray(quoteTemplateScheduleItems.templateId, ids)).orderBy(asc(quoteTemplateScheduleItems.position));
  return templates.map((template) => ({
    template,
    sections: sections.filter((row) => row.templateId === template.id),
    lines: lines.filter((row) => row.templateId === template.id),
    schedule: schedule.filter((row) => row.templateId === template.id),
  }));
}

export async function findQuoteTemplates(organizationId: string): Promise<TemplateWithContent[]> {
  return inOrganization(organizationId, async (tx) => contentOf(tx, await tx.select().from(quoteTemplates).orderBy(asc(quoteTemplates.name))));
}

export async function findQuoteTemplate(organizationId: string, templateId: string): Promise<TemplateWithContent | null> {
  return inOrganization(organizationId, async (tx) => {
    const [template] = await tx.select().from(quoteTemplates).where(eq(quoteTemplates.id, templateId));
    return template ? ((await contentOf(tx, [template]))[0] ?? null) : null;
  });
}

async function insertContent(tx: Tx, organizationId: string, templateId: string, content: TemplateContent): Promise<void> {
  const sectionIds = new Map<string, string>();
  for (const [position, section] of content.sections.entries()) {
    const [row] = await tx.insert(quoteTemplateSections).values({ organizationId, templateId, title: section.title, position }).returning({ id: quoteTemplateSections.id });
    sectionIds.set(section.key, row!.id);
  }
  if (content.lines.length > 0) {
    await tx.insert(quoteTemplateLines).values(
      content.lines.map(({ sectionKey, ...line }, position) => ({
        organizationId,
        templateId,
        sectionId: sectionKey ? (sectionIds.get(sectionKey) ?? null) : null,
        ...line,
        position,
      })),
    );
  }
  if (content.schedule.length > 0) {
    await tx.insert(quoteTemplateScheduleItems).values(content.schedule.map((item, position) => ({ organizationId, templateId, ...item, position })));
  }
}

export async function insertQuoteTemplate(
  organizationId: string,
  header: { name: string; eventTypeId: string | null },
  content: TemplateContent,
): Promise<QuoteTemplateRow> {
  return inOrganization(organizationId, async (tx) => {
    const [template] = await tx
      .insert(quoteTemplates)
      .values({
        organizationId,
        name: header.name,
        eventTypeId: header.eventTypeId,
        globalDiscountKind: content.globalDiscountKind,
        globalDiscountValue: content.globalDiscountValue,
        advanceKind: content.advanceKind,
      })
      .returning();
    if (!template) throw new Error("création du modèle de devis échouée");
    await insertContent(tx, organizationId, template.id, content);
    return template;
  });
}

// Remplace le contenu ; la version augmente (les devis déjà créés gardent la leur).
export async function replaceQuoteTemplateContent(organizationId: string, templateId: string, content: TemplateContent): Promise<QuoteTemplateRow | null> {
  return inOrganization(organizationId, async (tx) => {
    const [template] = await tx.select().from(quoteTemplates).where(eq(quoteTemplates.id, templateId));
    if (!template) return null;
    await tx.delete(quoteTemplateLines).where(eq(quoteTemplateLines.templateId, templateId));
    await tx.delete(quoteTemplateSections).where(eq(quoteTemplateSections.templateId, templateId));
    await tx.delete(quoteTemplateScheduleItems).where(eq(quoteTemplateScheduleItems.templateId, templateId));
    await insertContent(tx, organizationId, templateId, content);
    const [updated] = await tx
      .update(quoteTemplates)
      .set({
        version: raw`${quoteTemplates.version} + 1`,
        globalDiscountKind: content.globalDiscountKind,
        globalDiscountValue: content.globalDiscountValue,
        advanceKind: content.advanceKind,
      })
      .where(eq(quoteTemplates.id, templateId))
      .returning();
    return updated ?? null;
  });
}

export async function updateQuoteTemplateHeader(organizationId: string, templateId: string, header: { name: string; eventTypeId: string | null }): Promise<boolean> {
  return inOrganization(organizationId, async (tx) => {
    const updated = await tx.update(quoteTemplates).set(header).where(eq(quoteTemplates.id, templateId)).returning({ id: quoteTemplates.id });
    return updated.length > 0;
  });
}

export async function deleteQuoteTemplateRow(organizationId: string, templateId: string): Promise<boolean> {
  return inOrganization(organizationId, async (tx) => {
    const deleted = await tx.delete(quoteTemplates).where(eq(quoteTemplates.id, templateId)).returning({ id: quoteTemplates.id });
    return deleted.length > 0;
  });
}

// Contenu de la version courante d'un devis, pour en faire un modèle.
export async function findCurrentVersionContent(organizationId: string, quoteId: string) {
  return inOrganization(organizationId, async (tx) => {
    const [quote] = await tx.select().from(quotes).where(eq(quotes.id, quoteId));
    if (!quote) return null;
    const [version] = await tx.select().from(quoteVersions).where(and(eq(quoteVersions.quoteId, quoteId), eq(quoteVersions.version, quote.currentVersion)));
    if (!version) return null;
    const sections = await tx.select().from(quoteSections).where(eq(quoteSections.versionId, version.id)).orderBy(asc(quoteSections.position));
    const lines = await tx.select().from(quoteLines).where(eq(quoteLines.versionId, version.id)).orderBy(asc(quoteLines.position));
    const schedule = await tx.select().from(paymentScheduleItems).where(eq(paymentScheduleItems.versionId, version.id)).orderBy(asc(paymentScheduleItems.dueDate), asc(paymentScheduleItems.position));
    return { quote, version, sections, lines, schedule };
  });
}

// Copie un modèle dans la version en brouillon, encore vide, d'un devis.
export type ApplyTemplateResult = { status: "ok" } | { status: "not_found" | "locked" | "not_empty" };

export async function applyTemplateToDraft(
  organizationId: string,
  input: {
    quoteId: string;
    templateId: string;
    dueDate: (item: QuoteTemplateScheduleRow) => string;
    vatRateFor: (line: QuoteTemplateLineRow) => number;
  },
): Promise<ApplyTemplateResult> {
  return inOrganization(organizationId, async (tx) => {
    const [quote] = await tx.select().from(quotes).where(eq(quotes.id, input.quoteId));
    if (!quote) return { status: "not_found" };
    const [version] = await tx.select().from(quoteVersions).where(and(eq(quoteVersions.quoteId, quote.id), eq(quoteVersions.version, quote.currentVersion)));
    if (!version) return { status: "not_found" };
    if (version.sentAt) return { status: "locked" };
    const [existing] = await tx.select({ id: quoteLines.id }).from(quoteLines).where(eq(quoteLines.versionId, version.id)).limit(1);
    if (existing) return { status: "not_empty" };
    const [template] = await tx.select().from(quoteTemplates).where(eq(quoteTemplates.id, input.templateId));
    if (!template) return { status: "not_found" };
    const [content] = await contentOf(tx, [template]);
    const sectionIds = new Map<string, string>();
    for (const section of content!.sections) {
      const [row] = await tx.insert(quoteSections).values({ organizationId, versionId: version.id, title: section.title, position: section.position }).returning({ id: quoteSections.id });
      sectionIds.set(section.id, row!.id);
    }
    if (content!.lines.length > 0) {
      await tx.insert(quoteLines).values(
        content!.lines.map((line) => ({
          organizationId,
          versionId: version.id,
          sectionId: line.sectionId ? (sectionIds.get(line.sectionId) ?? null) : null,
          catalogItemId: line.catalogItemId,
          label: line.label,
          description: line.description,
          unit: line.unit,
          quantityMilli: line.quantityMilli,
          unitPriceCents: line.unitPriceCents,
          vatRateBasisPoints: input.vatRateFor(line),
          discountBasisPoints: line.discountBasisPoints,
          isOption: line.isOption,
          position: line.position,
        })),
      );
    }
    if (content!.schedule.length > 0) {
      await tx.insert(paymentScheduleItems).values(
        content!.schedule.map((item) => ({
          organizationId,
          versionId: version.id,
          label: item.label,
          amountCents: item.amountCents,
          percentageBasisPoints: item.percentageBasisPoints,
          dueDate: input.dueDate(item),
          position: item.position,
        })),
      );
    }
    await tx
      .update(quoteVersions)
      .set({
        templateId: template.id,
        templateVersion: template.version,
        globalDiscountKind: template.globalDiscountKind,
        globalDiscountValue: template.globalDiscountValue,
        ...(template.advanceKind ? { advanceKind: template.advanceKind } : {}),
      })
      .where(eq(quoteVersions.id, version.id));
    return { status: "ok" };
  });
}
