// Lot 35a (HUB-13, D4) — e-mail qui prévient la Propriétaire que son export complet est prêt :
// dans la langue de l'organisation, avec la date d'expiration à l'heure de Paris et l'écran où le
// télécharger ; jamais l'archive ni un lien qui y mène directement.
import { describe, expect, it } from "vitest";
import { organizationExportReadyMail } from "./organization-exports";

describe("HUB-13 — E-mail « export prêt »", () => {
  const input = { organizationName: "Atelier Camille R.", expiresAt: new Date("2026-11-22T10:00:00.000Z"), url: "https://app.symbola.test/parametres/export" };

  it("en français : l'organisation, l'écran Paramètres et la date d'expiration (heure de Paris)", () => {
    const mail = organizationExportReadyMail({ ...input, locale: "fr" });
    expect(mail.subject).toBe("Votre export Symbola est prêt");
    expect(mail.text).toContain("« Atelier Camille R. »");
    expect(mail.text).toContain("https://app.symbola.test/parametres/export");
    expect(mail.text).toContain("22 novembre 2026 à 11:00");
  });

  it("en anglais, et jamais de lien vers l'archive elle-même", () => {
    const mail = organizationExportReadyMail({ ...input, locale: "en" });
    expect(mail.subject).toBe("Your Symbola export is ready");
    expect(mail.text).toContain("Settings, Export my data");
    for (const text of [mail.text, organizationExportReadyMail({ ...input, locale: "fr" }).text]) {
      expect(text).not.toMatch(/\.zip|organization-exports|\/parametres\/export\/[0-9a-f-]{36}/);
    }
  });
});
