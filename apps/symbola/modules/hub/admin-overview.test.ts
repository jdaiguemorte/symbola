import { describe, expect, it } from "vitest";
import { backupState, type BackupRunView } from "./admin-overview";

const run = (status: BackupRunView["status"], finishedAt: string | null, startedAt = "2026-11-07T02:00:00Z"): BackupRunView => ({
  startedAt: new Date(startedAt),
  finishedAt: finishedAt ? new Date(finishedAt) : null,
  status,
  sizeBytes: null,
});

describe("HUB-18 — Dernière sauvegarde signalée", () => {
  const night = run("succeeded", "2026-11-07T02:12:00Z");

  it("étant donné la sauvegarde de cette nuit réussie, alors l'état est « faite »", () => {
    expect(backupState(night, night, new Date("2026-11-07T09:00:00Z"))).toBe("ok");
  });

  it("étant donné la dernière réussie la veille il y a moins de 26 h, alors l'état reste « faite »", () => {
    expect(backupState(night, night, new Date("2026-11-08T04:11:00Z"))).toBe("ok");
  });

  it("étant donné aucune réussite depuis plus de 26 h, alors l'état est en alerte « aucune depuis plus de 26 h »", () => {
    expect(backupState(night, night, new Date("2026-11-08T04:13:00Z"))).toBe("stale");
  });

  it("étant donné la dernière exécution en échec, alors l'état est « échec », même si la précédente a réussi", () => {
    const failed = run("failed", "2026-11-08T02:05:00Z", "2026-11-08T02:00:00Z");
    expect(backupState(failed, night, new Date("2026-11-08T07:00:00Z"))).toBe("failed");
  });

  it("étant donné une sauvegarde en cours après une réussite récente, alors l'état reste « faite »", () => {
    const running = run("running", null, "2026-11-08T02:00:00Z");
    expect(backupState(running, night, new Date("2026-11-08T02:01:00Z"))).toBe("ok");
  });

  it("étant donné aucune sauvegarde signalée, alors l'état est « aucune »", () => {
    expect(backupState(null, null, new Date("2026-11-08T02:01:00Z"))).toBe("none");
  });

  it("au passage à l'heure d'hiver (nuit du 25 octobre), le délai de 26 h se compte en heures réelles", () => {
    const beforeChange = run("succeeded", "2026-10-25T00:30:00Z");
    expect(backupState(beforeChange, beforeChange, new Date("2026-10-26T02:29:00Z"))).toBe("ok");
    expect(backupState(beforeChange, beforeChange, new Date("2026-10-26T02:31:00Z"))).toBe("stale");
  });
});
