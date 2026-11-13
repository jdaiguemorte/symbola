// DEV-01 — critère obligatoire (CLAUDE.md §6) sur les tables du module
// quotes : une organisation ne voit et ne modifie jamais le catalogue, les
// devis, versions, lignes, séries ni réglages d'une autre. PostgreSQL réel,
// rôle applicatif.
import { randomUUID } from "node:crypto";
import { assertOrganizationIsolation } from "@symbola/testing";
import { eq } from "drizzle-orm";
import { afterAll, describe, it } from "vitest";
import { createAppConnection } from "./client";
import {
  catalogItems,
  contractEvidence,
  contracts,
  contractSignerActs,
  contractTemplateAcceptances,
  contractTemplateClauses,
  contractTemplates,
  earnestReceipts,
  numberSeries,
  paymentEntries,
  paymentMethods,
  paymentScheduleItems,
  quoteLines,
  quoteSigners,
  signatureRequests,
  signatureWebhookLog,
  quoteSections,
  quoteSettings,
  quoteTemplateLines,
  quoteTemplates,
  quoteTemplateScheduleItems,
  quoteTemplateSections,
  quotes,
  quoteVersions,
  scheduledDepositInvoices,
} from "./schema/quotes";
import { withOrganization } from "./with-organization";

const { sql, db } = createAppConnection();

afterAll(async () => {
  await sql.end();
});

type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];

async function seedQuote(tx: Tx, organizationId: string) {
  const [quote] = await tx
    .insert(quotes)
    .values({ organizationId, eventId: randomUUID(), number: `D-2027-${randomUUID().slice(0, 4)}`, createdByUserId: randomUUID() })
    .returning();
  if (!quote) throw new Error("insertion du devis attendue");
  const [version] = await tx.insert(quoteVersions).values({ organizationId, quoteId: quote.id, version: 1 }).returning();
  if (!version) throw new Error("insertion de la version attendue");
  return { quote, version };
}

describe("DEV-01 — Isolation entre organisations (module quotes, PostgreSQL réel)", () => {
  it("catalogue", async () => {
    await assertOrganizationIsolation({
      seed: async (organizationId) =>
        withOrganization(db, organizationId, async (tx) => {
          const [row] = await tx
            .insert(catalogItems)
            .values({ organizationId, label: "Coordination", unit: "forfait", unitPriceCents: 150000, vatRateBasisPoints: 2000 })
            .returning();
          if (!row) throw new Error("insertion attendue");
          return row;
        }),
      listVisible: async (organizationId) => withOrganization(db, organizationId, (tx) => tx.select().from(catalogItems)),
      attemptCrossOrganizationUpdate: async (organizationId, targetRow) => {
        const updated = await withOrganization(db, organizationId, (tx) =>
          tx.update(catalogItems).set({ label: "falsifié" }).where(eq(catalogItems.id, targetRow.id)).returning(),
        );
        return { affectedRows: updated.length };
      },
    });
  });

  it("devis", async () => {
    await assertOrganizationIsolation({
      seed: async (organizationId) => withOrganization(db, organizationId, async (tx) => (await seedQuote(tx, organizationId)).quote),
      listVisible: async (organizationId) => withOrganization(db, organizationId, (tx) => tx.select().from(quotes)),
      attemptCrossOrganizationUpdate: async (organizationId, targetRow) => {
        const updated = await withOrganization(db, organizationId, (tx) =>
          tx.update(quotes).set({ status: "signed" }).where(eq(quotes.id, targetRow.id)).returning(),
        );
        return { affectedRows: updated.length };
      },
    });
  });

  it("versions de devis", async () => {
    await assertOrganizationIsolation({
      seed: async (organizationId) => withOrganization(db, organizationId, async (tx) => (await seedQuote(tx, organizationId)).version),
      listVisible: async (organizationId) => withOrganization(db, organizationId, (tx) => tx.select().from(quoteVersions)),
      attemptCrossOrganizationUpdate: async (organizationId, targetRow) => {
        const updated = await withOrganization(db, organizationId, (tx) =>
          tx.update(quoteVersions).set({ legalMention: "falsifié" }).where(eq(quoteVersions.id, targetRow.id)).returning(),
        );
        return { affectedRows: updated.length };
      },
    });
  });

  it("lignes de devis", async () => {
    await assertOrganizationIsolation({
      seed: async (organizationId) =>
        withOrganization(db, organizationId, async (tx) => {
          const { version } = await seedQuote(tx, organizationId);
          const [row] = await tx
            .insert(quoteLines)
            .values({
              organizationId,
              versionId: version.id,
              label: "Coordination",
              unit: "forfait",
              quantityMilli: 1000,
              unitPriceCents: 150000,
              vatRateBasisPoints: 2000,
            })
            .returning();
          if (!row) throw new Error("insertion attendue");
          return row;
        }),
      listVisible: async (organizationId) => withOrganization(db, organizationId, (tx) => tx.select().from(quoteLines)),
      attemptCrossOrganizationUpdate: async (organizationId, targetRow) => {
        const updated = await withOrganization(db, organizationId, (tx) =>
          tx.update(quoteLines).set({ unitPriceCents: 1 }).where(eq(quoteLines.id, targetRow.id)).returning(),
        );
        return { affectedRows: updated.length };
      },
    });
  });

  // Lot 31a (FAC-01, HUB-21) : sections des devis, modèles de devis et leur contenu.
  it("sections de devis (lot 31a)", async () => {
    await assertOrganizationIsolation({
      seed: async (organizationId) =>
        withOrganization(db, organizationId, async (tx) => {
          const { version } = await seedQuote(tx, organizationId);
          const [row] = await tx.insert(quoteSections).values({ organizationId, versionId: version.id, title: "Coordination" }).returning();
          if (!row) throw new Error("insertion attendue");
          return row;
        }),
      listVisible: async (organizationId) => withOrganization(db, organizationId, (tx) => tx.select().from(quoteSections)),
      attemptCrossOrganizationUpdate: async (organizationId, targetRow) => {
        const updated = await withOrganization(db, organizationId, (tx) =>
          tx.update(quoteSections).set({ title: "falsifié" }).where(eq(quoteSections.id, targetRow.id)).returning(),
        );
        return { affectedRows: updated.length };
      },
    });
  });

  it("modèles de devis, leurs sections, lignes et échéances (lot 31a)", async () => {
    const seedTemplate = (tx: Tx, organizationId: string) =>
      tx.insert(quoteTemplates).values({ organizationId, name: "Mariage complet" }).returning().then(([row]) => row!);
    await assertOrganizationIsolation({
      seed: async (organizationId) => withOrganization(db, organizationId, (tx) => seedTemplate(tx, organizationId)),
      listVisible: async (organizationId) => withOrganization(db, organizationId, (tx) => tx.select().from(quoteTemplates)),
      attemptCrossOrganizationUpdate: async (organizationId, targetRow) => {
        const updated = await withOrganization(db, organizationId, (tx) =>
          tx.update(quoteTemplates).set({ name: "falsifié" }).where(eq(quoteTemplates.id, targetRow.id)).returning(),
        );
        return { affectedRows: updated.length };
      },
    });
    await assertOrganizationIsolation({
      seed: async (organizationId) =>
        withOrganization(db, organizationId, async (tx) => {
          const template = await seedTemplate(tx, organizationId);
          const [row] = await tx.insert(quoteTemplateSections).values({ organizationId, templateId: template.id, title: "Jour J" }).returning();
          return row!;
        }),
      listVisible: async (organizationId) => withOrganization(db, organizationId, (tx) => tx.select().from(quoteTemplateSections)),
      attemptCrossOrganizationUpdate: async (organizationId, targetRow) => {
        const updated = await withOrganization(db, organizationId, (tx) =>
          tx.update(quoteTemplateSections).set({ title: "falsifié" }).where(eq(quoteTemplateSections.id, targetRow.id)).returning(),
        );
        return { affectedRows: updated.length };
      },
    });
    await assertOrganizationIsolation({
      seed: async (organizationId) =>
        withOrganization(db, organizationId, async (tx) => {
          const template = await seedTemplate(tx, organizationId);
          const [row] = await tx
            .insert(quoteTemplateLines)
            .values({ organizationId, templateId: template.id, label: "Coordination", unit: "forfait", quantityMilli: 1000, unitPriceCents: 150000, vatRateBasisPoints: 2000, isOption: true })
            .returning();
          return row!;
        }),
      listVisible: async (organizationId) => withOrganization(db, organizationId, (tx) => tx.select().from(quoteTemplateLines)),
      attemptCrossOrganizationUpdate: async (organizationId, targetRow) => {
        const updated = await withOrganization(db, organizationId, (tx) =>
          tx.update(quoteTemplateLines).set({ unitPriceCents: 1 }).where(eq(quoteTemplateLines.id, targetRow.id)).returning(),
        );
        return { affectedRows: updated.length };
      },
    });
    await assertOrganizationIsolation({
      seed: async (organizationId) =>
        withOrganization(db, organizationId, async (tx) => {
          const template = await seedTemplate(tx, organizationId);
          const [row] = await tx
            .insert(quoteTemplateScheduleItems)
            .values({ organizationId, templateId: template.id, label: "Acompte", percentageBasisPoints: 3000, dueRule: "at_signature" })
            .returning();
          return row!;
        }),
      listVisible: async (organizationId) => withOrganization(db, organizationId, (tx) => tx.select().from(quoteTemplateScheduleItems)),
      attemptCrossOrganizationUpdate: async (organizationId, targetRow) => {
        const updated = await withOrganization(db, organizationId, (tx) =>
          tx.update(quoteTemplateScheduleItems).set({ label: "falsifié" }).where(eq(quoteTemplateScheduleItems.id, targetRow.id)).returning(),
        );
        return { affectedRows: updated.length };
      },
    });
  });

  // Lot 31b (FAC-04, FAC-05, DOC-03, JUR-07) : modèles de contrat et leurs clauses, acceptations de
  // l'avertissement, contrats, actes des signataires, dossiers de preuve, factures à émettre.
  it("modèles de contrat, clauses, acceptations, contrats, actes, dossiers de preuve et factures d'acompte à émettre (lot 31b)", async () => {
    const seedTemplate = (tx: Tx, organizationId: string) =>
      tx.insert(contractTemplates).values({ organizationId, name: "Contrat de mariage", title: "Contrat de prestation" }).returning().then(([row]) => row!);
    const seedContract = async (tx: Tx, organizationId: string) => {
      const { quote, version } = await seedQuote(tx, organizationId);
      const [contract] = await tx
        .insert(contracts)
        .values({ organizationId, quoteId: quote.id, quoteVersionId: version.id, version: 1, templateVersion: 1, title: "Contrat", clauses: [{ title: "Objet", body: "Mariage", role: null }], conclusionChannel: "distance", clientCategory: "individual", withdrawalApplies: true })
        .returning();
      return { quote, version, contract: contract! };
    };
    const seedSigner = async (tx: Tx, organizationId: string) => {
      const seeded = await seedContract(tx, organizationId);
      const [request] = await tx.insert(signatureRequests).values({ organizationId, versionId: seeded.version.id, provider: "fake", externalId: randomUUID(), kind: "quote_contract", contractId: seeded.contract.id }).returning();
      const [signer] = await tx.insert(quoteSigners).values({ organizationId, requestId: request!.id, name: "Léa", email: "lea@example.test", billingAddress: "1 rue des Lilas", signingUrl: "https://signature.example.test/s/abc" }).returning();
      return { ...seeded, request: request!, signer: signer! };
    };
    const tables = [
      {
        table: contractTemplates,
        seed: (tx: Tx, organizationId: string) => seedTemplate(tx, organizationId),
        tamper: { name: "falsifié" },
      },
      {
        table: contractTemplateClauses,
        seed: async (tx: Tx, organizationId: string) => {
          const template = await seedTemplate(tx, organizationId);
          return (await tx.insert(contractTemplateClauses).values({ organizationId, templateId: template.id, title: "Objet", body: "{client.noms}" }).returning())[0]!;
        },
        tamper: { body: "falsifié" },
      },
      {
        table: contractTemplateAcceptances,
        seed: async (tx: Tx, organizationId: string) => {
          const template = await seedTemplate(tx, organizationId);
          return (await tx.insert(contractTemplateAcceptances).values({ organizationId, templateId: template.id, templateVersion: 1, userId: randomUUID() }).returning())[0]!;
        },
        tamper: { templateVersion: 9 },
      },
      {
        table: contracts,
        seed: async (tx: Tx, organizationId: string) => (await seedContract(tx, organizationId)).contract,
        tamper: { title: "falsifié" },
      },
      {
        table: contractSignerActs,
        seed: async (tx: Tx, organizationId: string) => {
          const { contract, signer } = await seedSigner(tx, organizationId);
          return (await tx.insert(contractSignerActs).values({ organizationId, contractId: contract.id, signerId: signer.id, kind: "order", signerName: "Léa", presentedText: "Je commande" }).returning())[0]!;
        },
        tamper: { signerName: "falsifié" },
      },
      {
        table: contractEvidence,
        seed: async (tx: Tx, organizationId: string) => {
          const { contract, request } = await seedSigner(tx, organizationId);
          return (await tx.insert(contractEvidence).values({ organizationId, requestId: request.id, contractId: contract.id, documentKey: `evidence/${organizationId}/x.json`, sha256: "a".repeat(64) }).returning())[0]!;
        },
        tamper: { documentKey: "falsifié" },
      },
      {
        table: scheduledDepositInvoices,
        seed: async (tx: Tx, organizationId: string) => {
          const { quote, version } = await seedQuote(tx, organizationId);
          const [item] = await tx.insert(paymentScheduleItems).values({ organizationId, versionId: version.id, label: "Acompte", percentageBasisPoints: 3000, dueDate: "2027-01-15" }).returning();
          return (await tx.insert(scheduledDepositInvoices).values({ organizationId, quoteId: quote.id, versionId: version.id, scheduleItemId: item!.id, issueOn: "2027-01-15" }).returning())[0]!;
        },
        tamper: { issueOn: "2020-01-01" },
      },
    ] as const;
    // Même vérification pour chaque table du lot (lignes réduites à leur identifiant).
    type Row = { id: string };
    for (const entry of tables) {
      const table = entry.table as unknown as typeof contracts;
      await assertOrganizationIsolation<Row>({
        seed: async (organizationId) => withOrganization(db, organizationId, (tx) => entry.seed(tx, organizationId) as Promise<Row>),
        listVisible: async (organizationId) => withOrganization(db, organizationId, (tx) => tx.select({ id: table.id }).from(table)),
        attemptCrossOrganizationUpdate: async (organizationId, targetRow) => {
          const updated = await withOrganization(db, organizationId, (tx) =>
            tx
              .update(table)
              .set(entry.tamper as never)
              .where(eq(table.id, targetRow.id))
              .returning({ id: table.id }),
          );
          return { affectedRows: updated.length };
        },
      });
    }
  });

  // Lot 31c (JUR-08, D21) : reçus d'arrhes. Immuables : seule la copie des clients se met à jour
  // (anonymisation en fin de conservation) ; une autre organisation n'en voit ni n'en change aucun.
  it("reçus d'arrhes (lot 31c)", async () => {
    type Row = { id: string };
    await assertOrganizationIsolation<Row>({
      seed: async (organizationId) =>
        withOrganization(db, organizationId, async (tx) => {
          const { quote, version } = await seedQuote(tx, organizationId);
          const [item] = await tx.insert(paymentScheduleItems).values({ organizationId, versionId: version.id, label: "Arrhes", amountCents: 50000, dueDate: "2027-01-15" }).returning();
          const [entry] = await tx.insert(paymentEntries).values({ organizationId, scheduleItemId: item!.id, kind: "received", amountCents: 50000, paidOn: "2027-01-10" }).returning();
          const [receipt] = await tx
            .insert(earnestReceipts)
            .values({ organizationId, quoteId: quote.id, scheduleItemId: item!.id, paymentEntryId: entry!.id, number: `R-2027-${randomUUID().slice(0, 4)}`, issuedAt: new Date(), issuedOn: "2027-01-10", paidOn: "2027-01-10", amountCents: 50000, label: "Arrhes", sellerSnapshot: { organizationName: "Atelier" }, buyerSnapshot: [{ name: "Léa", billingAddress: "1 rue des Lilas" }] })
            .returning({ id: earnestReceipts.id });
          return receipt!;
        }),
      listVisible: async (organizationId) => withOrganization(db, organizationId, (tx) => tx.select({ id: earnestReceipts.id }).from(earnestReceipts)),
      attemptCrossOrganizationUpdate: async (organizationId, targetRow) => {
        const updated = await withOrganization(db, organizationId, (tx) =>
          tx.update(earnestReceipts).set({ buyerSnapshot: [] }).where(eq(earnestReceipts.id, targetRow.id)).returning({ id: earnestReceipts.id }),
        );
        return { affectedRows: updated.length };
      },
    });
  });

  it("séries de numérotation", async () => {
    await assertOrganizationIsolation({
      seed: async (organizationId) =>
        withOrganization(db, organizationId, async (tx) => {
          const [row] = await tx.insert(numberSeries).values({ organizationId, kind: "invoice", year: 2027, lastNumber: 4 }).returning();
          if (!row) throw new Error("insertion attendue");
          return row;
        }),
      listVisible: async (organizationId) => withOrganization(db, organizationId, (tx) => tx.select().from(numberSeries)),
      attemptCrossOrganizationUpdate: async (organizationId, targetRow) => {
        const updated = await withOrganization(db, organizationId, (tx) =>
          tx.update(numberSeries).set({ lastNumber: 0 }).where(eq(numberSeries.id, targetRow.id)).returning(),
        );
        return { affectedRows: updated.length };
      },
    });
  });

  it("réglages du module", async () => {
    await assertOrganizationIsolation({
      seed: async (organizationId) =>
        withOrganization(db, organizationId, async (tx) => {
          const [row] = await tx.insert(quoteSettings).values({ organizationId }).returning();
          if (!row) throw new Error("insertion attendue");
          return row;
        }),
      listVisible: async (organizationId) => withOrganization(db, organizationId, (tx) => tx.select().from(quoteSettings)),
      attemptCrossOrganizationUpdate: async (organizationId, targetRow) => {
        const updated = await withOrganization(db, organizationId, (tx) =>
          tx.update(quoteSettings).set({ validityDays: 1 }).where(eq(quoteSettings.id, targetRow.id)).returning(),
        );
        return { affectedRows: updated.length };
      },
    });
  });

  it("modes de paiement (DEV-03)", async () => {
    await assertOrganizationIsolation({
      seed: async (organizationId) =>
        withOrganization(db, organizationId, async (tx) => {
          const [row] = await tx.insert(paymentMethods).values({ organizationId, label: "Virement" }).returning();
          if (!row) throw new Error("insertion attendue");
          return row;
        }),
      listVisible: async (organizationId) => withOrganization(db, organizationId, (tx) => tx.select().from(paymentMethods)),
      attemptCrossOrganizationUpdate: async (organizationId, targetRow) => {
        const updated = await withOrganization(db, organizationId, (tx) =>
          tx.update(paymentMethods).set({ label: "falsifié" }).where(eq(paymentMethods.id, targetRow.id)).returning(),
        );
        return { affectedRows: updated.length };
      },
    });
  });

  it("échéancier (DEV-03)", async () => {
    await assertOrganizationIsolation({
      seed: async (organizationId) =>
        withOrganization(db, organizationId, async (tx) => {
          const { version } = await seedQuote(tx, organizationId);
          const [row] = await tx
            .insert(paymentScheduleItems)
            .values({ organizationId, versionId: version.id, label: "Acompte", amountCents: 50000, dueDate: "2027-06-01" })
            .returning();
          if (!row) throw new Error("insertion attendue");
          return row;
        }),
      listVisible: async (organizationId) => withOrganization(db, organizationId, (tx) => tx.select().from(paymentScheduleItems)),
      attemptCrossOrganizationUpdate: async (organizationId, targetRow) => {
        const updated = await withOrganization(db, organizationId, (tx) =>
          tx.update(paymentScheduleItems).set({ paidOn: "2027-06-01" }).where(eq(paymentScheduleItems.id, targetRow.id)).returning(),
        );
        return { affectedRows: updated.length };
      },
    });
  });

  it("demandes de signature, signataires et journal du webhook (DEV-02)", async () => {
    const seedRequest = (tx: Tx, organizationId: string) =>
      seedQuote(tx, organizationId).then(async ({ version }) => {
        const [request] = await tx
          .insert(signatureRequests)
          .values({ organizationId, versionId: version.id, provider: "fake", externalId: randomUUID() })
          .returning();
        if (!request) throw new Error("insertion attendue");
        return request;
      });

    await assertOrganizationIsolation({
      seed: async (organizationId) => withOrganization(db, organizationId, (tx) => seedRequest(tx, organizationId)),
      listVisible: async (organizationId) => withOrganization(db, organizationId, (tx) => tx.select().from(signatureRequests)),
      attemptCrossOrganizationUpdate: async (organizationId, targetRow) => {
        const updated = await withOrganization(db, organizationId, (tx) =>
          tx.update(signatureRequests).set({ status: "completed" }).where(eq(signatureRequests.id, targetRow.id)).returning(),
        );
        return { affectedRows: updated.length };
      },
    });

    await assertOrganizationIsolation({
      seed: async (organizationId) =>
        withOrganization(db, organizationId, async (tx) => {
          const request = await seedRequest(tx, organizationId);
          const [row] = await tx
            .insert(quoteSigners)
            .values({
              organizationId,
              requestId: request.id,
              name: "Inès",
              email: "ines@example.test",
              billingAddress: "1 rue des Lilas",
              signingUrl: "https://signature.example.test/s/abc",
            })
            .returning();
          if (!row) throw new Error("insertion attendue");
          return row;
        }),
      listVisible: async (organizationId) => withOrganization(db, organizationId, (tx) => tx.select().from(quoteSigners)),
      attemptCrossOrganizationUpdate: async (organizationId, targetRow) => {
        const updated = await withOrganization(db, organizationId, (tx) =>
          tx.update(quoteSigners).set({ status: "signed" }).where(eq(quoteSigners.id, targetRow.id)).returning(),
        );
        return { affectedRows: updated.length };
      },
    });

    await assertOrganizationIsolation({
      seed: async (organizationId) =>
        withOrganization(db, organizationId, async (tx) => {
          const [row] = await tx.insert(signatureWebhookLog).values({ organizationId, eventType: "form.completed", outcome: "applied" }).returning();
          if (!row) throw new Error("insertion attendue");
          return row;
        }),
      listVisible: async (organizationId) => withOrganization(db, organizationId, (tx) => tx.select().from(signatureWebhookLog)),
      attemptCrossOrganizationUpdate: async (organizationId, targetRow) => {
        const updated = await withOrganization(db, organizationId, (tx) =>
          tx.update(signatureWebhookLog).set({ outcome: "falsifié" }).where(eq(signatureWebhookLog.id, targetRow.id)).returning(),
        );
        return { affectedRows: updated.length };
      },
    });
  });
});
