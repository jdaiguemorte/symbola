// HUB-02 / DEV-03 — le bloc « Encaissements à venir » ne bloque jamais le
// tableau de bord : au-delà de 2 secondes ou en cas d'erreur, il est
// « indisponible » (null), sans erreur pour la page.
import { describe, expect, it, vi } from "vitest";

vi.mock("@/modules/quotes/service", () => ({ getQuoteSettings: vi.fn(), listUnpaidPayments: vi.fn() }));

const { loadDashboardPayments } = await import("./dashboard-block");

const EMPTY = { overdue: [], upcoming: [], overdueTotalCents: 0, months: [] };

describe("HUB-02 / DEV-03 — Bloc Encaissements à venir", () => {
  it("rend les données quand le module répond à temps", async () => {
    expect(await loadDashboardPayments("org", 50, async () => EMPTY)).toEqual(EMPTY);
  });

  it("est indisponible s'il ne répond pas dans le délai", async () => {
    vi.useFakeTimers();
    const pending = loadDashboardPayments("org", 2000, () => new Promise(() => undefined));
    await vi.advanceTimersByTimeAsync(2000);
    expect(await pending).toBeNull();
    vi.useRealTimers();
  });

  it("est indisponible si le module échoue, sans faire échouer la page", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(await loadDashboardPayments("org", 50, async () => Promise.reject(new Error("panne")))).toBeNull();
    warn.mockRestore();
  });
});
