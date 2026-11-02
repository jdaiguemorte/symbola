// RGPD-02 — exports RGPD rangés dans le stockage privé, contre un vrai
// PostgreSQL et le stockage S3 : lien signé de courte durée, rattachement à
// une demande d'accès ou de portabilité, expiration puis purge des fichiers ;
// isolation entre organisations.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { createStorageClient, getPrivateObject } from "@symbola/files";
import {
  createPrivacyRequest,
  getPrivacyExportDownloadUrl,
  getPlatformSettings,
  listExportablePrivacyRequests,
  listPrivacyExports,
  PrivacyExportInvalidError,
  PrivacyExportNotFoundError,
  purgeExpiredPrivacyExports,
  storePrivacyExport,
} from "./service";

const { sql, db } = createAppConnection();
const DAY_MS = 86_400_000;

afterAll(async () => {
  await sql.end();
});

async function createOwner() {
  const organization = await createOrganization(db, `Org ${randomUUID()}`);
  const user = await createUser(db, { organizationId: organization.id, email: `owner-${randomUUID()}@symbola.test`, password: "mot-de-passe", role: "owner" });
  return { organizationId: organization.id, userId: user.id };
}

const files = { pdf: Buffer.from("%PDF-1.4 export"), archive: Buffer.from("PK\u0003\u0004 archive") };

describe("RGPD-02 — Export : stockage privé et lien temporaire", () => {
  it("L'archive se télécharge par un lien signé à durée limitée, tant que l'export n'a pas expiré", async () => {
    const owner = await createOwner();
    const now = new Date();
    const stored = await storePrivacyExport(db, { ...owner, requestId: null, recordCount: 3, ...files, now });
    const { privacyExportRetentionDays } = await getPlatformSettings(db);
    expect(stored.expiresAt.getTime() - now.getTime()).toBe(privacyExportRetentionDays * DAY_MS);
    expect((await listPrivacyExports(db, owner.organizationId, now)).map((view) => view.id)).toEqual([stored.id]);

    const url = new URL(await getPrivacyExportDownloadUrl(db, { organizationId: owner.organizationId, exportId: stored.id, file: "archive", now }));
    expect(url.searchParams.get("X-Amz-Expires")).toBe("300");
    expect(url.searchParams.get("X-Amz-Signature")).toBeTruthy();
    const response = await fetch(url);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(files.archive);

    const afterExpiry = new Date(stored.expiresAt.getTime() + 1000);
    await expect(getPrivacyExportDownloadUrl(db, { organizationId: owner.organizationId, exportId: stored.id, file: "pdf", now: afterExpiry })).rejects.toThrow(
      PrivacyExportNotFoundError,
    );
    expect(await listPrivacyExports(db, owner.organizationId, afterExpiry)).toEqual([]);
  });

  it("à l'expiration, la purge efface les fichiers du stockage (pas la veille) ; la trace reste", async () => {
    const owner = await createOwner();
    const now = new Date();
    const stored = await storePrivacyExport(db, { ...owner, requestId: null, recordCount: 1, ...files, now });
    const prefix = `privacy-exports/${owner.organizationId}/${stored.id}`;
    expect(await purgeExpiredPrivacyExports(db, [owner.organizationId], new Date(stored.expiresAt.getTime() - 1000))).toBe(0);
    expect(await getPrivateObject(createStorageClient(), `${prefix}/export.pdf`)).toEqual(files.pdf);
    expect(await purgeExpiredPrivacyExports(db, [owner.organizationId], stored.expiresAt)).toBe(1);
    await expect(getPrivateObject(createStorageClient(), `${prefix}/export.pdf`)).rejects.toThrow();
    await expect(getPrivateObject(createStorageClient(), `${prefix}/donnees.zip`)).rejects.toThrow();
    // Déjà purgé : rien à refaire.
    expect(await purgeExpiredPrivacyExports(db, [owner.organizationId], new Date(stored.expiresAt.getTime() + DAY_MS))).toBe(0);
  });

  it("un export se rattache à une demande d'accès ou de portabilité en cours, jamais à une autre", async () => {
    const owner = await createOwner();
    const access = await createPrivacyRequest(db, { ...owner, type: "access", personLabel: "Élodie Durand", receivedOn: "2026-11-02", now: new Date("2026-11-02T11:00:00Z") });
    const erasure = await createPrivacyRequest(db, { ...owner, type: "erasure", personLabel: "Inès", receivedOn: "2026-11-02", now: new Date("2026-11-02T11:00:00Z") });
    expect((await listExportablePrivacyRequests(db, owner.organizationId)).map((request) => request.id)).toEqual([access.id]);

    const stored = await storePrivacyExport(db, { ...owner, requestId: access.id, recordCount: 2, ...files });
    expect(stored.requestPersonLabel).toBe("Élodie Durand");
    expect((await listPrivacyExports(db, owner.organizationId))[0]?.requestPersonLabel).toBe("Élodie Durand");
    await expect(storePrivacyExport(db, { ...owner, requestId: erasure.id, recordCount: 2, ...files })).rejects.toThrow(PrivacyExportInvalidError);
    await expect(storePrivacyExport(db, { ...owner, requestId: null, recordCount: 0, ...files })).rejects.toThrow(PrivacyExportInvalidError);
  });
});

describe("RGPD-02 — Isolation des exports", () => {
  it("organisation A ne liste ni ne télécharge un export de B, ni ne rattache un export à une demande de B", async () => {
    const ownerA = await createOwner();
    const ownerB = await createOwner();
    const requestB = await createPrivacyRequest(db, { ...ownerB, type: "access", personLabel: "Personne de B", receivedOn: "2026-11-02", now: new Date("2026-11-02T11:00:00Z") });
    const exportB = await storePrivacyExport(db, { ...ownerB, requestId: requestB.id, recordCount: 1, ...files });

    expect(await listPrivacyExports(db, ownerA.organizationId)).toEqual([]);
    expect(await listExportablePrivacyRequests(db, ownerA.organizationId)).toEqual([]);
    await expect(getPrivacyExportDownloadUrl(db, { organizationId: ownerA.organizationId, exportId: exportB.id, file: "archive" })).rejects.toThrow(
      PrivacyExportNotFoundError,
    );
    await expect(storePrivacyExport(db, { ...ownerA, requestId: requestB.id, recordCount: 1, ...files })).rejects.toThrow(PrivacyExportInvalidError);
    // La purge de A ne touche pas les exports de B.
    expect(await purgeExpiredPrivacyExports(db, [ownerA.organizationId], new Date(exportB.expiresAt.getTime() + DAY_MS))).toBe(0);
    expect(await listPrivacyExports(db, ownerB.organizationId)).toHaveLength(1);
  });
});
