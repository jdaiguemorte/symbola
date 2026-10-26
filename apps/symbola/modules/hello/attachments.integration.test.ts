// SOC-08 — « Envoi d'un fichier via hello » (critère d'acceptation),
// vérifié contre de vrais ClamAV + Garage, à travers le module hello.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { getGreetingAttachmentUrl, uploadGreetingAttachment } from "./service";

const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

describe("SOC-08 — Envoi de fichier via hello", () => {
  it("accepte une pièce jointe saine et la rend téléchargeable par lien signé", async () => {
    const result = await uploadGreetingAttachment({
      organizationId: randomUUID(),
      buffer: TINY_PNG,
      maxSizeBytes: 1024 * 1024,
    });

    expect(result.status).toBe("uploaded");
    if (result.status !== "uploaded") return;

    const url = await getGreetingAttachmentUrl(result.key, 60);
    const response = await fetch(url);
    expect(response.status).toBe(200);
  });
});
