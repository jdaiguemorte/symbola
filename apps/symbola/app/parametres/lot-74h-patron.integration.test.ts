// Lot 74h (HUB-28, GC-02, CHR-03, HUB-09 ; D7, G8, G9, G10, G15 ; spécification du lot 74, § 6.8) — la première
// vague du patron des réglages contre un vrai PostgreSQL, par les actions des écrans : la coupure d'un
// automatisme garde sa date et son auteur (0246) et la remise en marche les efface ; le seuil de « Bientôt »
// se règle de 1 à 30 et change l'état des tâches ; « Mariages par an » se change dans la fiche. Abus : une
// collègue ne coupe ni ne remet en marche (réglage de la titulaire) ; le Comptable et l'Exploitation n'y
// touchent pas ; l'organisation A ne lit ni ne change les réglages de B, et le nom d'une personne de B
// n'est jamais rendu dans A. Seul l'accès à la requête Next.js est simulé.
import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createOrganization, setUserNames } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { signedInAccount } from "@/lib/test-fixtures/session";
import { getAutomationGate, getOrganizationProfile, setAutomationEnabled, teamMemberFirstName } from "@/modules/hub/service";
import { getTaskSoonDays, taskDueState } from "@/modules/events/service";

let sessionToken: string | undefined;

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "symbola_session" && sessionToken ? { value: sessionToken } : undefined),
    set: () => undefined,
    delete: () => undefined,
  }),
  headers: async () => new Headers(),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
  notFound: () => {
    throw new Error("notFound");
  },
}));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
  getLocale: async () => "fr",
}));

const { setAutomationRunningAction } = await import("./automatisations/actions");
const { resumeRiskRadarAction } = await import("./radar/actions");
const { saveCompanySheetAction } = await import("./actions");
const { saveTaskSoonDaysAction } = await import("../events/parametres/task-category-actions");

const { sql, db } = createAppConnection();
afterAll(async () => {
  await sql.end();
});

beforeEach(() => {
  sessionToken = undefined;
});

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

async function agency(firstName = "Camille") {
  const organization = await createOrganization(db, `Atelier ${randomUUID()}`);
  const owner = await signedInAccount(db, { organizationId: organization.id, role: "owner" });
  await setUserNames(db, owner.userId, { firstName, lastName: "Exemple" });
  const member = await signedInAccount(db, { organizationId: organization.id, role: "member" });
  const accountant = await signedInAccount(db, { organizationId: organization.id, role: "accountant" });
  return { organizationId: organization.id, owner, member, accountant };
}

// Une action refusée par sa garde : un refus rendu, ou une redirection (Comptable, Exploitation).
async function refused(run: () => Promise<unknown>): Promise<void> {
  try {
    const result = await run();
    if (result && typeof result === "object") expect(result).toHaveProperty("error");
  } catch (error) {
    expect((error as Error).message).toMatch(/^redirect:|^notFound$/);
  }
}

describe("HUB-28 — Automatismes : couper le dit, avec la date et la personne (lot 74h, G10, 0246)", () => {
  it("critère 6 — la titulaire coupe le radar : la date et son prénom sont gardés ; la remise en marche les efface", async () => {
    const { organizationId, owner } = await agency("Camille");
    sessionToken = owner.token;
    const before = Date.now();
    expect(await setAutomationRunningAction({}, form({ key: "risk_radar" }))).toEqual({ success: true });
    const paused = await getAutomationGate(organizationId, "risk_radar");
    expect(paused.enabled).toBe(false);
    expect(paused.pausedBy).toBe(owner.userId);
    expect(paused.pausedAt!.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(await teamMemberFirstName(db, organizationId, paused.pausedBy)).toBe("Camille");

    // Couper ce qui est déjà coupé ne change ni la date ni l'auteur.
    await setAutomationEnabled(organizationId, "risk_radar", false, new Date(Date.now() + 60_000), null);
    expect((await getAutomationGate(organizationId, "risk_radar")).pausedAt).toEqual(paused.pausedAt);

    await resumeRiskRadarAction();
    const resumed = await getAutomationGate(organizationId, "risk_radar");
    expect(resumed).toMatchObject({ enabled: true, pausedAt: null, pausedBy: null });
    expect(resumed.resumedAt).not.toBeNull();
  });

  it("critère 7 (abus) — une collègue, le Comptable et l'Exploitation ne coupent ni ne remettent en marche", async () => {
    const { organizationId, owner, member, accountant } = await agency();
    for (const token of [member.token, accountant.token]) {
      sessionToken = token;
      await refused(() => setAutomationRunningAction({}, form({ key: "vendor_roadmap" })));
    }
    expect((await getAutomationGate(organizationId, "vendor_roadmap")).enabled).toBe(true);

    sessionToken = owner.token;
    await setAutomationRunningAction({}, form({ key: "risk_radar" }));
    const admin = await signedInAccount(db, { organizationId: null, role: "admin" });
    for (const token of [member.token, admin.token]) {
      sessionToken = token;
      await refused(() => resumeRiskRadarAction());
    }
    expect((await getAutomationGate(organizationId, "risk_radar")).enabled).toBe(false);
  });

  it("abus — la titulaire de A ne coupe que chez elle ; le prénom d'une personne de B n'est jamais rendu dans A", async () => {
    const a = await agency("Camille");
    const b = await agency("Bérénice");
    sessionToken = b.owner.token;
    await setAutomationRunningAction({}, form({ key: "risk_radar" }));
    expect((await getAutomationGate(a.organizationId, "risk_radar")).enabled).toBe(true);
    const inB = await getAutomationGate(b.organizationId, "risk_radar");
    expect(await teamMemberFirstName(db, a.organizationId, inB.pausedBy)).toBeNull();
    // Une clé inconnue est refusée, rien n'est écrit.
    expect(await setAutomationRunningAction({}, form({ key: "privacy_purge" }))).toEqual({ error: "invalid" });
  });
});

describe("CHR-03 — Le seuil de « Bientôt » se règle dans « Tâches : catégories et échéances » (lot 74h, G9, M10)", () => {
  it("critère 5 — de 1 à 30 jours ; hors de l'intervalle, l'erreur et rien d'enregistré ; la valeur change l'état « Bientôt »", async () => {
    const { organizationId, member } = await agency();
    // Toute l'équipe le règle (réglage de l'agence, garde de l'équipe comme les catégories).
    sessionToken = member.token;
    expect(await getTaskSoonDays(organizationId)).toBe(7);
    for (const wrong of ["0", "31", "45", "", "7.5", "abc", "-3"]) {
      expect(await saveTaskSoonDaysAction({}, form({ soonDays: wrong }))).toEqual({ error: "tasks.soonInvalid" });
    }
    expect(await getTaskSoonDays(organizationId)).toBe(7);
    const today = "2027-06-01";
    const task = { dueDate: "2027-06-11", done: false };
    expect(taskDueState(task, today, await getTaskSoonDays(organizationId))?.kind).not.toBe("soon");
    expect(await saveTaskSoonDaysAction({}, form({ soonDays: "10" }))).toEqual({ success: "saved" });
    expect(taskDueState(task, today, await getTaskSoonDays(organizationId))?.kind).toBe("soon");
    for (const bound of ["1", "30"]) {
      expect(await saveTaskSoonDaysAction({}, form({ soonDays: bound }))).toEqual({ success: "saved" });
      expect(await getTaskSoonDays(organizationId)).toBe(Number(bound));
    }
  });

  it("abus — le seuil de A ne change pas celui de B ; le Comptable n'y touche pas", async () => {
    const a = await agency();
    const b = await agency();
    sessionToken = a.owner.token;
    await saveTaskSoonDaysAction({}, form({ soonDays: "12" }));
    expect(await getTaskSoonDays(b.organizationId)).toBe(7);
    sessionToken = b.accountant.token;
    await refused(() => saveTaskSoonDaysAction({}, form({ soonDays: "3" })));
    expect(await getTaskSoonDays(b.organizationId)).toBe(7);
  });
});

describe("HUB-09 — « Mariages par an » se lit et se change dans la fiche de l'entreprise (lot 74h, G15, L74-D5)", () => {
  const sheet = { legalForm: "ei", siren: "", siret: "", vatNumber: "", registration: "", shareCapital: "", address: "12 rue des Lilas", postalCode: "74000", city: "Annecy", countryCode: "FR", contactEmail: "", contactPhone: "", website: "", metier: "wedding_planner", metierPrecision: "" };

  it("critère 4 — une valeur de l'assistant s'enregistre avec la fiche ; vide, elle s'efface ; une valeur inconnue est refusée", async () => {
    const { organizationId, member } = await agency();
    sessionToken = member.token;
    expect(await saveCompanySheetAction({}, form({ ...sheet, annualEventVolume: "11_to_25" }))).toEqual({ success: true });
    expect((await getOrganizationProfile(db, organizationId)).annualEventVolume).toBe("11_to_25");
    // Absent du formulaire : la valeur reste.
    expect(await saveCompanySheetAction({}, form(sheet))).toEqual({ success: true });
    expect((await getOrganizationProfile(db, organizationId)).annualEventVolume).toBe("11_to_25");
    const refusedSheet = await saveCompanySheetAction({}, form({ ...sheet, annualEventVolume: "un_million" }));
    expect(refusedSheet.error).toBeDefined();
    expect(refusedSheet.values?.annualEventVolume).toBe("un_million");
    expect((await getOrganizationProfile(db, organizationId)).annualEventVolume).toBe("11_to_25");
    expect(await saveCompanySheetAction({}, form({ ...sheet, annualEventVolume: "" }))).toEqual({ success: true });
    expect((await getOrganizationProfile(db, organizationId)).annualEventVolume).toBeNull();
  });

  it("abus — la fiche de A ne touche pas celle de B", async () => {
    const a = await agency();
    const b = await agency();
    sessionToken = a.owner.token;
    await saveCompanySheetAction({}, form({ ...sheet, annualEventVolume: "over_50" }));
    expect((await getOrganizationProfile(db, b.organizationId)).annualEventVolume).toBeNull();
  });
});
