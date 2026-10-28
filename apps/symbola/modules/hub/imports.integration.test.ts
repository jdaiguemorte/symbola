// IMP-01 — réception d'un fichier d'import par le hub : taille limitée par les
// réglages de la plateforme, antivirus, lecture, import en cours gardé en
// attente (rien n'est écrit dans les modules), abandon et purge à
// l'expiration. PostgreSQL et ClamAV réels.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { EICAR_TEST_STRING } from "@symbola/files";
import { readImportCorpusFile } from "@symbola/testing/import-corpus";
import {
  cancelImport,
  getImportDraft,
  getImportLimits,
  getPlatformSettings,
  listImports,
  purgeExpiredImportDrafts,
  setPlatformSettings,
  startImport,
} from "./service";

const { sql, db } = createAppConnection();

afterAll(async () => {
  await sql.end();
});

async function createPlanner() {
  const organization = await createOrganization(db, `Org ${randomUUID()}`);
  const user = await createUser(db, {
    organizationId: organization.id,
    email: `planner-${randomUUID()}@symbola.test`,
    password: "mot-de-passe",
    role: "owner",
  });
  return { organizationId: organization.id, userId: user.id };
}

function csv(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

describe("IMP-01 — Formats acceptés", () => {
  it("Quand elle dépose un fichier CSV, alors l'app détecte l'encodage, le séparateur et la ligne d'en-tête, et garde l'import en attente", async () => {
    const planner = await createPlanner();
    const result = await startImport(db, {
      ...planner,
      entityType: "events",
      fileName: "C:\\Users\\planner\\Mes mariages.csv",
      bytes: readImportCorpusFile("excel-fr-windows1252.csv"),
    });
    expect(result.status).toBe("started");
    if (result.status !== "started") return;

    const draft = await getImportDraft(db, planner.organizationId, result.importId);
    expect(draft).toMatchObject({
      entityType: "events",
      status: "draft",
      fileName: "Mes mariages.csv",
      fileFormat: "csv",
      encoding: "windows-1252",
      delimiter: ";",
      headerRowIndex: 0,
      rowCount: 3,
    });
    expect(draft?.headers[0]).toBe("Prénom mariée");
    expect(draft?.previewRows[1]?.[5]).toBe("Domaine des Œillets");
  });

  it("Quand elle dépose un classeur Excel ou un JSON, alors il est lu de la même façon", async () => {
    const planner = await createPlanner();
    for (const [file, format] of [
      ["excel-maison.xlsx", "xlsx"],
      ["export.json", "json"],
    ] as const) {
      const result = await startImport(db, { ...planner, entityType: "events", fileName: file, bytes: readImportCorpusFile(file) });
      expect(result.status).toBe("started");
      if (result.status !== "started") continue;
      expect((await getImportDraft(db, planner.organizationId, result.importId))?.fileFormat).toBe(format);
    }
  });

  it("Étant donné un fichier d'un autre format, alors il est refusé avec un motif clair et rien n'est gardé", async () => {
    const planner = await createPlanner();
    const result = await startImport(db, {
      ...planner,
      entityType: "events",
      fileName: "ancien.xls",
      bytes: readImportCorpusFile("libreoffice.xls"),
    });
    expect(result).toEqual({ status: "rejected", reason: "unsupported_format", hint: "xls" });
    expect(await listImports(db, planner.organizationId)).toEqual([]);
  });

  it("Étant donné un fichier trop gros (limite réglée par l'Admin), alors il est refusé avant toute analyse", async () => {
    const planner = await createPlanner();
    const before = await getPlatformSettings(db);
    const admin = await createUser(db, { organizationId: null, email: `admin-${randomUUID()}@symbola.test`, password: "mot-de-passe", role: "admin" });
    await setPlatformSettings(db, { ...before, adminUserId: admin.id, importMaxBytes: 64 });
    try {
      expect((await getImportLimits(db)).maxBytes).toBe(64);
      const result = await startImport(db, {
        ...planner,
        entityType: "events",
        fileName: "gros.csv",
        bytes: csv(`nom;date\n${"Dupont;2027-01-01\n".repeat(10)}`),
      });
      expect(result).toEqual({ status: "rejected", reason: "too_large" });
      expect(await listImports(db, planner.organizationId)).toEqual([]);
    } finally {
      await setPlatformSettings(db, { ...before, adminUserId: admin.id });
    }
  });

  it("Étant donné un fichier infecté, alors il est refusé et rien n'est gardé", async () => {
    const planner = await createPlanner();
    const result = await startImport(db, {
      ...planner,
      entityType: "events",
      fileName: "virus.csv",
      bytes: csv(EICAR_TEST_STRING),
    });
    expect(result).toEqual({ status: "rejected", reason: "infected" });
    expect(await listImports(db, planner.organizationId)).toEqual([]);
  });

  it("Le contenu des cellules qui commencent par = + - ou @ est neutralisé avant d'être gardé", async () => {
    const planner = await createPlanner();
    const result = await startImport(db, {
      ...planner,
      entityType: "catalog_items",
      fileName: "formules.csv",
      bytes: readImportCorpusFile("formules.csv"),
    });
    if (result.status !== "started") throw new Error("import attendu");
    const draft = await getImportDraft(db, planner.organizationId, result.importId);
    expect(draft?.neutralizedCells).toBe(5);
    expect(draft?.previewRows[0]?.[3]).toBe("'@SUM(A1:A2)");
  });

  it("Un import abandonné efface ses lignes en attente et reste au journal", async () => {
    const planner = await createPlanner();
    const result = await startImport(db, { ...planner, entityType: "tasks", fileName: "taches.csv", bytes: readImportCorpusFile("maison-titre-bom.csv") });
    if (result.status !== "started") throw new Error("import attendu");

    expect(await cancelImport(db, planner.organizationId, result.importId)).toBe(true);
    expect(await getImportDraft(db, planner.organizationId, result.importId)).toBeNull();
    const [entry] = await listImports(db, planner.organizationId);
    expect(entry).toMatchObject({ id: result.importId, status: "cancelled", fileName: "taches.csv", rowCount: 2 });
    // Un second abandon ne change rien.
    expect(await cancelImport(db, planner.organizationId, result.importId)).toBe(false);
  });

  it("Un import en cours expire après la durée réglée et ses lignes sont purgées", async () => {
    const planner = await createPlanner();
    const now = new Date("2027-01-10T10:00:00Z");
    const { draftRetentionDays } = await getImportLimits(db);
    const result = await startImport(db, { ...planner, entityType: "events", fileName: "a.csv", bytes: readImportCorpusFile("google-sheets-en.csv"), now });
    if (result.status !== "started") throw new Error("import attendu");

    const justBefore = new Date(now.getTime() + draftRetentionDays * 86_400_000 - 1000);
    const justAfter = new Date(now.getTime() + draftRetentionDays * 86_400_000 + 1000);
    expect(await getImportDraft(db, planner.organizationId, result.importId, justBefore)).not.toBeNull();
    expect(await purgeExpiredImportDrafts(db, [planner.organizationId], justBefore)).toBe(0);

    expect(await getImportDraft(db, planner.organizationId, result.importId, justAfter)).toBeNull();
    expect(await purgeExpiredImportDrafts(db, [planner.organizationId], justAfter)).toBe(1);
    const [entry] = await listImports(db, planner.organizationId);
    expect(entry?.status).toBe("cancelled");
  });
});

describe("IMP-01 — Isolation des imports entre organisations", () => {
  it("organisation A ne lit, n'abandonne ni ne liste l'import de B", async () => {
    const plannerA = await createPlanner();
    const plannerB = await createPlanner();
    const result = await startImport(db, { ...plannerB, entityType: "events", fileName: "b.csv", bytes: readImportCorpusFile("google-sheets-en.csv") });
    if (result.status !== "started") throw new Error("import attendu");

    expect(await getImportDraft(db, plannerA.organizationId, result.importId)).toBeNull();
    expect(await cancelImport(db, plannerA.organizationId, result.importId)).toBe(false);
    expect(await listImports(db, plannerA.organizationId)).toEqual([]);
    expect(await getImportDraft(db, plannerB.organizationId, result.importId)).not.toBeNull();
  });
});
