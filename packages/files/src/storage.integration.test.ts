// SOC-08 — Garage (ADR 0015) : stockage privé puis téléchargement par
// lien signé à durée limitée. Vérifié contre un vrai Garage.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createStorageClient, getSignedDownloadUrl, uploadPrivateObject } from "./storage";

describe("SOC-08 — Stockage objet (Garage réel)", () => {
  it("stocke un objet et le rend accessible par un lien signé à durée limitée", async () => {
    const storage = createStorageClient();
    const key = `test/${randomUUID()}.txt`;
    const content = Buffer.from("contenu de test SOC-08");

    await uploadPrivateObject(storage, { key, body: content, contentType: "text/plain" });

    const url = await getSignedDownloadUrl(storage, key, 60);
    expect(url).toContain(key);

    const response = await fetch(url);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("contenu de test SOC-08");
  });

  it("refuse l'accès direct sans lien signé (bucket privé)", async () => {
    const storage = createStorageClient();
    const key = `test/${randomUUID()}.txt`;
    await uploadPrivateObject(storage, {
      key,
      body: Buffer.from("privé"),
      contentType: "text/plain",
    });

    const env = await import("@symbola/env").then((m) => m.parseEnv(process.env));
    const directUrl = `http://${env.S3_ENDPOINT}:${env.S3_PORT}/${env.S3_BUCKET}/${key}`;
    const response = await fetch(directUrl);
    expect(response.status).not.toBe(200);
  });

  it("génère un lien signé expiré qui est refusé", async () => {
    const storage = createStorageClient();
    const key = `test/${randomUUID()}.txt`;
    await uploadPrivateObject(storage, {
      key,
      body: Buffer.from("expirera vite"),
      contentType: "text/plain",
    });

    const url = await getSignedDownloadUrl(storage, key, 1); // 1 seconde
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const response = await fetch(url);
    expect(response.status).not.toBe(200);
  });
});
