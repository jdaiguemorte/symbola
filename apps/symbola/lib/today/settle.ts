// Lot 32a (HUB-08, ARC-06, ARC-07) — dégradation propre de « Aujourd'hui » : chaque source (un
// module) a son délai ; lente ou en panne, elle est « indisponible » et l'écran garde les autres.
// Reprend la garde de l'ancien bloc « Encaissements à venir » (PRD-HUB-02, DEV-03). Le journal ne
// nomme que la source, jamais une donnée.
export const TODAY_SOURCE_TIMEOUT_MS = 2000;

export type Settled<T> = { ok: true; value: T } | { ok: false };

export async function settleWithin<T>(load: () => Promise<T>, timeoutMs: number = TODAY_SOURCE_TIMEOUT_MS, source = "inconnue"): Promise<Settled<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<Settled<T>>((resolve) => {
    timer = setTimeout(() => resolve({ ok: false }), timeoutMs);
  });
  try {
    return await Promise.race([load().then((value): Settled<T> => ({ ok: true, value })), timeout]);
  } catch {
    console.warn(`« Aujourd'hui » : source ${source} indisponible`);
    return { ok: false };
  } finally {
    clearTimeout(timer);
  }
}
