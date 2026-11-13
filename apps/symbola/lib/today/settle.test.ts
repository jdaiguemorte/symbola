// Lot 32a (HUB-08, ARC-06, ARC-07) — une source de « Aujourd'hui » (un module) ne bloque jamais
// l'écran : au-delà du délai ou en cas d'erreur, elle est « indisponible », sans erreur pour la
// page ; les autres sources restent affichées. Reprend la garde du bloc « Encaissements à venir »
// (PRD-HUB-02, DEV-03).
import { describe, expect, it, vi } from "vitest";
import { settleWithin } from "./settle";

describe("HUB-08 / ARC-07 — Une source lente ou en panne ne bloque pas « Aujourd'hui »", () => {
  it("rend les données quand la source répond à temps", async () => {
    expect(await settleWithin(async () => [1, 2], 50)).toEqual({ ok: true, value: [1, 2] });
  });

  it("est indisponible si la source ne répond pas dans le délai", async () => {
    vi.useFakeTimers();
    const pending = settleWithin(() => new Promise<number[]>(() => undefined), 2000);
    await vi.advanceTimersByTimeAsync(2000);
    expect(await pending).toEqual({ ok: false });
    vi.useRealTimers();
  });

  it("est indisponible si la source échoue, sans faire échouer la page ; le journal ne dit que la source", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(await settleWithin(async () => Promise.reject(new Error("panne")), 50, "quotes")).toEqual({ ok: false });
    expect(warn).toHaveBeenCalledWith("« Aujourd'hui » : source quotes indisponible");
    warn.mockRestore();
  });
});
