// Lot 16 (L16-ARC-01, ADR 0043) — le traitement de fond des imports ne visite que
// les organisations signalées ; un tour complet au démarrage, puis toutes les
// 5 minutes.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hub = vi.hoisted(() => {
  const awakened = new Set<string>();
  return {
    awakened,
    visited: [] as string[],
    listOrganizations: vi.fn(async () => ["org-a", "org-b", "org-c"].map((id) => ({ id }))),
  };
});

vi.mock("@symbola/db/client", () => ({ appDatabase: () => ({}) }));
vi.mock("@/modules/vendors/service", () => ({ placeVendors: vi.fn() }));
vi.mock("@/modules/hub/service", () => ({
  listOrganizations: hub.listOrganizations,
  listActiveImportJobs: async (_db: unknown, organizationId: string) => {
    hub.visited.push(organizationId);
    return [];
  },
  takeAwakenedImportOrganizations: () => {
    const ids = [...hub.awakened];
    hub.awakened.clear();
    return ids;
  },
  wakeImportJobs: (organizationId: string) => hub.awakened.add(organizationId),
  advanceImportJob: vi.fn(),
  readNextSheet: vi.fn(),
  updateImportJob: vi.fn(),
}));

describe("L16-ARC-01 — Traitement de fond des imports ciblé", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-08T10:00:00Z"));
    hub.awakened.clear();
    hub.visited = [];
    hub.listOrganizations.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("le premier passage fait le tour de toutes les organisations (reprise après redémarrage)", async () => {
    const { runImportJobsOnce } = await import("./import-jobs");
    await runImportJobsOnce();
    expect(hub.visited).toEqual(["org-a", "org-b", "org-c"]);
  });

  it("ensuite, un passage ne visite que les organisations signalées", async () => {
    const { runImportJobsOnce } = await import("./import-jobs");
    await runImportJobsOnce();
    hub.visited = [];
    await runImportJobsOnce();
    expect(hub.visited).toEqual([]);
    hub.awakened.add("org-b");
    await runImportJobsOnce();
    expect(hub.visited).toEqual(["org-b"]);
    expect(hub.listOrganizations).toHaveBeenCalledTimes(1);
  });

  it("le tour complet revient toutes les 5 minutes", async () => {
    const { FULL_SCAN_INTERVAL_MS, runImportJobsOnce } = await import("./import-jobs");
    await runImportJobsOnce();
    vi.setSystemTime(Date.now() + FULL_SCAN_INTERVAL_MS - 1000);
    await runImportJobsOnce();
    expect(hub.listOrganizations).toHaveBeenCalledTimes(1);
    vi.setSystemTime(Date.now() + 1000);
    hub.visited = [];
    await runImportJobsOnce();
    expect(hub.listOrganizations).toHaveBeenCalledTimes(2);
    expect(hub.visited).toEqual(["org-a", "org-b", "org-c"]);
  });

  it("des organisations désignées (tests) sont visitées sans tour complet", async () => {
    const { runImportJobsOnce } = await import("./import-jobs");
    await runImportJobsOnce(1000, ["org-c"]);
    expect(hub.visited).toEqual(["org-c"]);
    expect(hub.listOrganizations).not.toHaveBeenCalled();
  });
});
