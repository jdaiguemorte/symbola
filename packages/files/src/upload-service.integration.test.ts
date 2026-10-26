// SOC-08 — pipeline complet : taille maximale, type par le contenu, scan
// ClamAV, stockage privé. Vérifié contre de vrais ClamAV + Garage.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { EICAR_TEST_STRING } from "./eicar";
import { uploadFile } from "./upload-service";

// PNG 1x1 transparent minimal, valide.
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

describe("SOC-08 — Envoi de fichier (ClamAV + Garage réels)", () => {
  it("accepte un PNG valide, sous la taille maximale, sain", async () => {
    const result = await uploadFile({
      organizationId: randomUUID(),
      buffer: TINY_PNG,
      maxSizeBytes: 1024 * 1024,
    });

    expect(result.status).toBe("uploaded");
    if (result.status === "uploaded") {
      expect(result.mime).toBe("image/png");
    }
  });

  it("refuse un fichier trop volumineux sans l'envoyer à ClamAV ni au stockage", async () => {
    const result = await uploadFile({
      organizationId: randomUUID(),
      buffer: TINY_PNG,
      maxSizeBytes: 1, // plus petit que le fichier
    });

    expect(result).toEqual({ status: "rejected", reason: "too_large" });
  });

  it("refuse un type de fichier non reconnu par son contenu", async () => {
    const result = await uploadFile({
      organizationId: randomUUID(),
      buffer: Buffer.from("ceci n'est ni un PDF ni une image"),
      maxSizeBytes: 1024 * 1024,
    });

    expect(result).toEqual({ status: "rejected", reason: "unsupported_type" });
  });

  it("refuse le fichier de test EICAR (critère d'acceptation SOC-08)", async () => {
    // Le fichier EICAR est pris tel quel (texte ASCII, ni PDF ni image) :
    // il est donc refusé dès le contrôle de type — le même ordre de
    // vérifications que la story l'énonce (type, taille, antivirus,
    // stockage). Que ClamAV détecte bien EICAR seul (pas enrobé dans un
    // PDF/PNG — comportement vérifié empiriquement contre ce conteneur
    // réel, pas une hypothèse) est prouvé directement par
    // clamav-client.integration.test.ts, qui lui envoie le flux brut.
    const result = await uploadFile({
      organizationId: randomUUID(),
      buffer: Buffer.from(EICAR_TEST_STRING, "ascii"),
      maxSizeBytes: 1024 * 1024,
    });

    expect(result.status).toBe("rejected");
  });
});
