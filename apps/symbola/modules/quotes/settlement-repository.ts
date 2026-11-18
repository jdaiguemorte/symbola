// Lot 43 (FAC-02, FAC-08 Divergent, FAC-09, FAC-15 ; D1, D2, D5, D7 ; ADR 0087, ADR 0089) — accès aux
// modèles de la page de proposition, au mot d'accueil et à la relance avant expiration des versions,
// aux références de virement (déclaration du payeur, suspension des relances, RIB envoyé au 8e jour)
// et aux relances d'impayés. Chaque écriture se fait sous la RLS de l'organisation ; jamais importé
// hors de modules/quotes/ (ADR 0011).
import { and, asc, eq, inArray, isNotNull, isNull, sql as raw } from "drizzle-orm";
import { appDatabase } from "@symbola/db/client";
import { appendAudit } from "@symbola/db/audit";
import { paymentReferences, paymentReminders, paymentScheduleItems, proposalTemplates, quoteSigners, quotes, quoteSettings, quoteVersions, type ProposalPhoto } from "@symbola/db/schema/quotes";
import { withOrganization } from "@symbola/db/with-organization";

type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];

export type ProposalTemplateRow = typeof proposalTemplates.$inferSelect;
export type PaymentReferenceRow = typeof paymentReferences.$inferSelect;
export type PaymentReminderRow = typeof paymentReminders.$inferSelect;

async function inOrganization<T>(organizationId: string, work: (tx: Tx) => Promise<T>): Promise<T> {
  return withOrganization(appDatabase(), organizationId, work);
}

// --- Modèles de proposition (D2) ---

export async function findProposalTemplates(organizationId: string): Promise<ProposalTemplateRow[]> {
  return inOrganization(organizationId, (tx) => tx.select().from(proposalTemplates).orderBy(asc(proposalTemplates.createdAt)));
}

// Celui du type d'évènement, sinon celui « pour tous ».
export async function findProposalTemplateFor(organizationId: string, eventTypeId: string | null): Promise<ProposalTemplateRow | null> {
  const rows = await findProposalTemplates(organizationId);
  return (eventTypeId ? rows.find((row) => row.eventTypeId === eventTypeId) : undefined) ?? rows.find((row) => row.eventTypeId === null) ?? null;
}

export async function findProposalTemplate(organizationId: string, templateId: string): Promise<ProposalTemplateRow | null> {
  return inOrganization(organizationId, async (tx) => (await tx.select().from(proposalTemplates).where(eq(proposalTemplates.id, templateId)))[0] ?? null);
}

// Enregistrer : crée le modèle du type, ou le remplace (sa version augmente).
export async function saveProposalTemplateRow(organizationId: string, input: { eventTypeId: string | null; greeting: string; blocks: string[] }): Promise<ProposalTemplateRow> {
  return inOrganization(organizationId, async (tx) => {
    const condition = input.eventTypeId ? eq(proposalTemplates.eventTypeId, input.eventTypeId) : isNull(proposalTemplates.eventTypeId);
    const [existing] = await tx.select().from(proposalTemplates).where(condition).for("update");
    if (existing) {
      const [row] = await tx
        .update(proposalTemplates)
        .set({ greeting: input.greeting, blocks: input.blocks, version: existing.version + 1, updatedAt: new Date() })
        .where(eq(proposalTemplates.id, existing.id))
        .returning();
      return row!;
    }
    const [row] = await tx.insert(proposalTemplates).values({ organizationId, eventTypeId: input.eventTypeId, greeting: input.greeting, blocks: input.blocks }).returning();
    return row!;
  });
}

export async function setProposalTemplatePhotos(organizationId: string, templateId: string, photos: ProposalPhoto[]): Promise<ProposalTemplateRow | null> {
  return inOrganization(organizationId, async (tx) => {
    const [row] = await tx
      .update(proposalTemplates)
      .set({ photos, version: raw`${proposalTemplates.version} + 1`, updatedAt: new Date() })
      .where(eq(proposalTemplates.id, templateId))
      .returning();
    return row ?? null;
  });
}

export async function deleteProposalTemplateRow(organizationId: string, templateId: string): Promise<ProposalTemplateRow | null> {
  return inOrganization(organizationId, async (tx) => (await tx.delete(proposalTemplates).where(eq(proposalTemplates.id, templateId)).returning())[0] ?? null);
}

// --- Versions : mot d'accueil, relance avant expiration, prolongation (FAC-02, FAC-15) ---

// Le mot d'accueil ne change que sur le brouillon de la version courante (une version envoyée est figée).
export async function setDraftProposalGreeting(
  organizationId: string,
  quoteId: string,
  input: { greeting: string | null; templateId: string | null; templateVersion: number | null },
): Promise<"saved" | "not_found" | "locked"> {
  return inOrganization(organizationId, async (tx) => {
    const [quote] = await tx.select().from(quotes).where(eq(quotes.id, quoteId));
    if (!quote) return "not_found";
    const [version] = await tx.select().from(quoteVersions).where(and(eq(quoteVersions.quoteId, quoteId), eq(quoteVersions.version, quote.currentVersion))).for("update");
    if (!version) return "not_found";
    if (version.sentAt) return "locked";
    await tx
      .update(quoteVersions)
      .set({ proposalGreeting: input.greeting, proposalTemplateId: input.templateId, proposalTemplateVersion: input.templateVersion, updatedAt: new Date() })
      .where(eq(quoteVersions.id, version.id));
    return "saved";
  });
}

// La relance avant expiration ne part qu'une fois : la première écriture gagne.
export async function markExpiryReminded(organizationId: string, versionId: string, now: Date): Promise<boolean> {
  return inOrganization(organizationId, async (tx) => {
    const rows = await tx.update(quoteVersions).set({ expiryRemindedAt: now }).where(and(eq(quoteVersions.id, versionId), isNull(quoteVersions.expiryRemindedAt))).returning({ id: quoteVersions.id });
    return rows.length === 1;
  });
}

// Prolonger la version envoyée en cours (ni signée, ni refusée) : nouvelle date de validité, la
// relance avant expiration pourra repartir.
export async function extendCurrentVersionValidity(organizationId: string, quoteId: string, validUntil: string): Promise<"saved" | "not_found" | "not_open"> {
  return inOrganization(organizationId, async (tx) => {
    const [quote] = await tx.select().from(quotes).where(eq(quotes.id, quoteId)).for("update");
    if (!quote) return "not_found";
    if (quote.status !== "sent") return "not_open";
    const rows = await tx
      .update(quoteVersions)
      .set({ validUntil, expiryRemindedAt: null, updatedAt: new Date() })
      .where(and(eq(quoteVersions.quoteId, quoteId), eq(quoteVersions.version, quote.currentVersion), isNotNull(quoteVersions.sentAt)))
      .returning({ id: quoteVersions.id });
    if (rows.length === 0) return "not_open";
    await appendAudit(tx, { organizationId, action: "quotes.validity.extended", objectId: quoteId, isDemo: quote.isDemo, details: { validUntil } });
    return "saved";
  });
}

// Les versions envoyées, ni signées ni refusées, à relancer peut-être (devis réels seulement).
export async function findOpenSentVersions(organizationId: string): Promise<{ quote: typeof quotes.$inferSelect; version: typeof quoteVersions.$inferSelect }[]> {
  return inOrganization(organizationId, (tx) =>
    tx
      .select({ quote: quotes, version: quoteVersions })
      .from(quotes)
      .innerJoin(quoteVersions, and(eq(quoteVersions.quoteId, quotes.id), eq(quoteVersions.version, quotes.currentVersion)))
      .where(and(eq(quotes.status, "sent"), eq(quotes.isDemo, false), isNotNull(quoteVersions.sentAt), isNull(quoteVersions.expiryRemindedAt))),
  );
}

// --- Réglages des relances (D1, D7) ---

export async function findReminderSettingsRow(organizationId: string): Promise<Pick<typeof quoteSettings.$inferSelect, "expiryReminderDays" | "paymentReminderDays" | "consumerLatePenaltyBasisPoints"> | null> {
  return inOrganization(organizationId, async (tx) => {
    const [row] = await tx
      .select({ expiryReminderDays: quoteSettings.expiryReminderDays, paymentReminderDays: quoteSettings.paymentReminderDays, consumerLatePenaltyBasisPoints: quoteSettings.consumerLatePenaltyBasisPoints })
      .from(quoteSettings);
    return row ?? null;
  });
}

export async function saveReminderSettingsRow(organizationId: string, input: { expiryReminderDays: number | null; paymentReminderDays: number[] | null; consumerLatePenaltyBasisPoints: number | null }): Promise<void> {
  await inOrganization(organizationId, async (tx) => {
    await tx
      .insert(quoteSettings)
      .values({ organizationId, ...input })
      .onConflictDoUpdate({ target: quoteSettings.organizationId, set: { ...input, updatedAt: new Date() } });
  });
}

// --- Références de virement et déclarations (FAC-08, D5) ---

export async function findPaymentReferences(organizationId: string, scheduleItemIds: string[]): Promise<PaymentReferenceRow[]> {
  if (scheduleItemIds.length === 0) return [];
  return inOrganization(organizationId, (tx) => tx.select().from(paymentReferences).where(inArray(paymentReferences.scheduleItemId, scheduleItemIds)));
}

function isUniqueViolation(error: unknown, constraint: string): boolean {
  const cause = (error as { cause?: { code?: string; constraint_name?: string } }).cause ?? (error as { code?: string; constraint_name?: string });
  return cause?.code === "23505" && cause.constraint_name === constraint;
}

// La référence d'une échéance, créée à la première lecture ; un tirage déjà pris dans l'organisation
// est retiré (unicité garantie par la base).
export async function ensurePaymentReference(organizationId: string, input: { scheduleItemId: string; isDemo: boolean; draw: () => string }): Promise<PaymentReferenceRow> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      return await inOrganization(organizationId, async (tx) => {
        const [existing] = await tx.select().from(paymentReferences).where(eq(paymentReferences.scheduleItemId, input.scheduleItemId));
        if (existing) return existing;
        const [row] = await tx
          .insert(paymentReferences)
          .values({ organizationId, scheduleItemId: input.scheduleItemId, reference: input.draw(), isDemo: input.isDemo })
          .onConflictDoNothing({ target: paymentReferences.scheduleItemId })
          .returning();
        return row ?? (await tx.select().from(paymentReferences).where(eq(paymentReferences.scheduleItemId, input.scheduleItemId)))[0]!;
      });
    } catch (error) {
      if (!isUniqueViolation(error, "payment_references_organization_reference_unique")) throw error;
    }
  }
  throw new Error("référence de virement : tirages épuisés");
}

// Le payeur déclare son virement : une seule déclaration tant que l'échéance n'est pas réglée.
export async function declareTransferRow(
  organizationId: string,
  input: { scheduleItemId: string; linkId: string; name: string; paidOn: string; now: Date; quoteId: string },
): Promise<"declared" | "already" | "paid"> {
  return inOrganization(organizationId, async (tx) => {
    const [item] = await tx.select().from(paymentScheduleItems).where(eq(paymentScheduleItems.id, input.scheduleItemId)).for("update");
    if (!item || item.paidOn) return "paid";
    const rows = await tx
      .update(paymentReferences)
      .set({ declaredAt: input.now, declaredPaidOn: input.paidOn, declaredByLinkId: input.linkId, declaredByName: input.name, updatedAt: input.now })
      .where(and(eq(paymentReferences.scheduleItemId, input.scheduleItemId), isNull(paymentReferences.declaredAt)))
      .returning();
    if (rows.length === 0) return "already";
    await appendAudit(tx, { organizationId, action: "quotes.transfer.declared", objectId: input.scheduleItemId, isDemo: rows[0]!.isDemo, details: { quoteId: input.quoteId } });
    return "declared";
  });
}

export async function setRemindersSuspension(
  organizationId: string,
  input: { scheduleItemId: string; suspend: { reason: string; userId: string } | null; now: Date },
): Promise<boolean> {
  return inOrganization(organizationId, async (tx) => {
    const rows = await tx
      .update(paymentReferences)
      .set(
        input.suspend
          ? { remindersSuspendedAt: input.now, remindersSuspensionReason: input.suspend.reason, remindersSuspendedBy: input.suspend.userId, updatedAt: input.now }
          : { remindersSuspendedAt: null, remindersSuspensionReason: null, remindersSuspendedBy: null, updatedAt: input.now },
      )
      .where(eq(paymentReferences.scheduleItemId, input.scheduleItemId))
      .returning();
    if (rows.length === 0) return false;
    await appendAudit(tx, {
      organizationId,
      action: input.suspend ? "quotes.reminders.suspended" : "quotes.reminders.resumed",
      objectId: input.scheduleItemId,
      isDemo: rows[0]!.isDemo,
      ...(input.suspend ? { reason: input.suspend.reason } : {}),
    });
    return true;
  });
}

// Les déclarations en attente de la confirmation de la planner (échéance non réglée).
export async function findPendingTransferDeclarations(organizationId: string): Promise<{ reference: PaymentReferenceRow; item: typeof paymentScheduleItems.$inferSelect; version: typeof quoteVersions.$inferSelect; quote: typeof quotes.$inferSelect }[]> {
  return inOrganization(organizationId, (tx) =>
    tx
      .select({ reference: paymentReferences, item: paymentScheduleItems, version: quoteVersions, quote: quotes })
      .from(paymentReferences)
      .innerJoin(paymentScheduleItems, eq(paymentScheduleItems.id, paymentReferences.scheduleItemId))
      .innerJoin(quoteVersions, eq(quoteVersions.id, paymentScheduleItems.versionId))
      .innerJoin(quotes, eq(quotes.id, quoteVersions.quoteId))
      .where(and(isNotNull(paymentReferences.declaredAt), isNull(paymentScheduleItems.paidOn)))
      .orderBy(asc(paymentReferences.declaredAt)),
  );
}

// --- Relances d'impayés (FAC-09) ---

export async function findPaymentReminders(organizationId: string, scheduleItemIds: string[]): Promise<PaymentReminderRow[]> {
  if (scheduleItemIds.length === 0) return [];
  return inOrganization(organizationId, (tx) => tx.select().from(paymentReminders).where(inArray(paymentReminders.scheduleItemId, scheduleItemIds)).orderBy(asc(paymentReminders.rank)));
}

// Juste avant l'envoi : l'échéance est relue sous verrou ; ni réglée, ni déclarée, ni suspendue, la
// relance de ce rang s'inscrit (une seule fois). false : rien ne part.
export async function claimInvoiceReminder(organizationId: string, input: { scheduleItemId: string; rank: number; dueOn: string; now: Date }): Promise<boolean> {
  return inOrganization(organizationId, async (tx) => {
    const [item] = await tx.select().from(paymentScheduleItems).where(eq(paymentScheduleItems.id, input.scheduleItemId)).for("update");
    if (!item || item.paidOn) return false;
    const [reference] = await tx.select().from(paymentReferences).where(eq(paymentReferences.scheduleItemId, input.scheduleItemId));
    if (reference?.declaredAt || reference?.remindersSuspendedAt) return false;
    const rows = await tx
      .insert(paymentReminders)
      .values({ organizationId, scheduleItemId: input.scheduleItemId, rank: input.rank, dueOn: input.dueOn, sentAt: input.now })
      .onConflictDoNothing({ target: [paymentReminders.scheduleItemId, paymentReminders.rank] })
      .returning({ id: paymentReminders.id });
    return rows.length === 1;
  });
}

// Le RIB envoyé au 8e jour hors établissement : une seule fois.
export async function markDetailsMailed(organizationId: string, scheduleItemId: string, now: Date): Promise<boolean> {
  return inOrganization(organizationId, async (tx) => {
    const rows = await tx
      .update(paymentReferences)
      .set({ detailsMailedAt: now, updatedAt: now })
      .where(and(eq(paymentReferences.scheduleItemId, scheduleItemId), isNull(paymentReferences.detailsMailedAt), isNull(paymentReferences.declaredAt)))
      .returning({ id: paymentReferences.id });
    return rows.length === 1;
  });
}

// --- SEC-16 : code vérifié avant de signer (D4) ---

export async function markSignerCodeVerified(organizationId: string, input: { signerIds: string[]; quoteId: string; now: Date; isDemo: boolean }): Promise<void> {
  if (input.signerIds.length === 0) return;
  await inOrganization(organizationId, async (tx) => {
    await tx.update(quoteSigners).set({ signingCodeVerifiedAt: input.now, updatedAt: input.now }).where(inArray(quoteSigners.id, input.signerIds));
    await appendAudit(tx, { organizationId, action: "quotes.signing_code.verified", objectId: input.quoteId, isDemo: input.isDemo, details: { signers: input.signerIds.length } });
  });
}

export async function quoteIdOfVersion(organizationId: string, versionId: string): Promise<string | null> {
  return inOrganization(organizationId, async (tx) => (await tx.select({ quoteId: quoteVersions.quoteId }).from(quoteVersions).where(eq(quoteVersions.id, versionId)))[0]?.quoteId ?? null);
}
