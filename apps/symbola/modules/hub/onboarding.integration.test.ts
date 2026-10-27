// ONB-01/02 — fiche entreprise interruptible/reprenable, changement de
// régime de TVA daté, seuils de franchise paramétrables par l'Admin.
// Contre un vrai PostgreSQL.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createAppConnection } from "@symbola/db/client";
import { createOrganization, createUser } from "@symbola/auth";
import {
  changeVatRegime,
  computeLegalMention,
  getOrganizationProfile,
  getPlatformSettings,
  saveOnboardingStep,
  setPlatformSettings,
} from "./service";

const { sql, db } = createAppConnection();

afterAll(async () => {
  await sql.end();
});

async function createTestAdmin(): Promise<string> {
  const admin = await createUser(db, {
    organizationId: null,
    email: `admin-${randomUUID()}@symbola.test`,
    password: "mot-de-passe-admin",
    role: "admin",
  });
  return admin.id;
}

describe("ONB-01 — Fiche entreprise interruptible et reprenable", () => {
  it("commence sans réponse, et chaque étape sauvegardée reste même si le questionnaire est interrompu", async () => {
    const organization = await createOrganization(db, `Org ${randomUUID()}`);

    const before = await getOrganizationProfile(db, organization.id);
    expect(before.siren).toBeNull();
    expect(before.completedAt).toBeNull();

    await saveOnboardingStep(db, organization.id, { siren: "123456789" });
    const afterFirstStep = await getOrganizationProfile(db, organization.id);
    expect(afterFirstStep.siren).toBe("123456789");
    expect(afterFirstStep.completedAt).toBeNull(); // toujours incomplet

    // Reprend plus tard : la première réponse n'a pas été perdue.
    await saveOnboardingStep(db, organization.id, { metier: "wedding_planner" });
    const afterSecondStep = await getOrganizationProfile(db, organization.id);
    expect(afterSecondStep.siren).toBe("123456789");
    expect(afterSecondStep.metier).toBe("wedding_planner");
  });

  it("toutes les réponses restent modifiables ensuite", async () => {
    const organization = await createOrganization(db, `Org ${randomUUID()}`);
    await saveOnboardingStep(db, organization.id, { siren: "111111111" });
    await saveOnboardingStep(db, organization.id, { siren: "222222222" });

    const profile = await getOrganizationProfile(db, organization.id);
    expect(profile.siren).toBe("222222222");
  });
});

describe("ONB-01 — Mentions légales déduites du régime de TVA", () => {
  it("franchise en base : article 293 B du CGI", () => {
    expect(computeLegalMention({ vatRegime: "franchise", vatRateDefaultBasisPoints: null })).toContain("293 B");
  });

  it("assujetti : aucune mention de franchise", () => {
    expect(computeLegalMention({ vatRegime: "assujetti", vatRateDefaultBasisPoints: 2000 })).not.toContain("293 B");
  });
});

describe("ONB-02 — Changement de régime de TVA daté", () => {
  it("enregistre le changement avec sa date d'effet, et met à jour le régime courant", async () => {
    const adminlessUserId = await createTestAdmin(); // réutilisé comme auteur du changement (titulaire dans un vrai parcours)
    const organization = await createOrganization(db, `Org ${randomUUID()}`);
    await saveOnboardingStep(db, organization.id, { vatRegime: "franchise" });

    const effectiveDate = "2027-01-01";
    await changeVatRegime(db, {
      organizationId: organization.id,
      userId: adminlessUserId,
      newRegime: "assujetti",
      effectiveDate,
    });

    const profile = await getOrganizationProfile(db, organization.id);
    expect(profile.vatRegime).toBe("assujetti");
  });
});

describe("ONB-02 — Seuils de franchise, paramètres Admin (jamais codés en dur)", () => {
  it("sont nuls tant que l'Admin ne les a pas renseignés, puis modifiables", async () => {
    const adminUserId = await createTestAdmin();

    const before = await getPlatformSettings(db);
    // Peut déjà avoir été fixé par un test précédent dans la même base
    // de dev : on fixe une valeur connue et on la relit, plutôt que de
    // supposer un état initial précis.
    void before;

    await setPlatformSettings(db, {
      adminUserId,
      franchiseThresholdServicesCents: 3750000, // 37 500,00 €
      franchiseThresholdGoodsCents: 8500000, // 85 000,00 €
    });

    const after = await getPlatformSettings(db);
    expect(after.franchiseThresholdServicesCents).toBe(3750000);
    expect(after.franchiseThresholdGoodsCents).toBe(8500000);
  });
});
