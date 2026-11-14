// Lot 29a (ARC-09, JRJ-02 ; ADR 0064, décisions D3 et D4) — copies du jour J sur
// l'appareil, côté navigateur : garder, mettre à jour, lire, effacer. Le service worker
// (public/sw.js) ne fait que servir ce que ce fichier range ; il n'existe que sur un
// appareil qui garde au moins un jour J.
import {
  DAY_CACHE,
  DAY_COPY_MIN_FREE_BYTES,
  DAY_COPY_SUFFIX,
  DAY_STATIC_CACHE,
  OFFLINE_PAGE_PATH,
  assetsInUse,
  copiesToPurge,
  dayCopyKey,
  dayPagePath,
  parseDayCopy,
  staticAssetsIn,
  type DayCopy,
} from "./day-copy";

export function offlineSupported(): boolean {
  return typeof window !== "undefined" && window.isSecureContext && "caches" in window && "serviceWorker" in navigator;
}

export async function readDayCopies(): Promise<DayCopy[]> {
  if (!offlineSupported() || !(await caches.has(DAY_CACHE))) return [];
  const cache = await caches.open(DAY_CACHE);
  const copies: DayCopy[] = [];
  for (const request of await cache.keys()) {
    if (!new URL(request.url).pathname.endsWith(DAY_COPY_SUFFIX)) continue;
    const response = await cache.match(request);
    const copy = parseDayCopy(await response?.json().catch(() => null));
    if (copy) copies.push(copy);
  }
  return copies;
}

export async function readDayCopy(eventId: string): Promise<DayCopy | null> {
  return (await readDayCopies()).find((copy) => copy.eventId === eventId) ?? null;
}

async function deleteCopy(cache: Cache, copy: DayCopy): Promise<void> {
  for (const path of [...copy.pages, ...copy.documents]) await cache.delete(path);
  await cache.delete(dayCopyKey(copy.eventId));
}

// Fichiers de l'application qu'aucune copie n'emploie plus (version remplacée).
async function pruneStaticAssets(remaining: DayCopy[]): Promise<void> {
  if (!(await caches.has(DAY_STATIC_CACHE))) return;
  const keep = assetsInUse(remaining);
  const cache = await caches.open(DAY_STATIC_CACHE);
  for (const request of await cache.keys()) {
    const url = new URL(request.url);
    if (!keep.has(url.pathname + url.search)) await cache.delete(request);
  }
}

// Plus aucune copie : les caches et le service worker s'en vont.
async function clearDevice(): Promise<void> {
  await caches.delete(DAY_CACHE);
  await caches.delete(DAY_STATIC_CACHE);
  const registration = await navigator.serviceWorker.getRegistration("/");
  await registration?.unregister();
}

async function keepOnly(copies: DayCopy[], removed: DayCopy[]): Promise<void> {
  const remaining = copies.filter((copy) => !removed.includes(copy));
  if (remaining.length === 0) {
    await clearDevice();
    return;
  }
  if (removed.length === 0) return;
  const cache = await caches.open(DAY_CACHE);
  for (const copy of removed) await deleteCopy(cache, copy);
  await pruneStaticAssets(remaining);
}

// « Retirer de cet appareil ».
export async function removeDayCopy(eventId: string): Promise<void> {
  const copies = await readDayCopies();
  await keepOnly(copies, copies.filter((copy) => copy.eventId === eventId));
}

// D4 : à l'ouverture d'un écran, les copies périmées, et celles d'un autre compte quand on
// sait qui est connecté. Ne lève jamais : un écran ne doit pas tomber pour un cache.
export async function purgeDayCopies(input: { userId: string | null; now?: Date }): Promise<void> {
  try {
    if (!offlineSupported()) return;
    const copies = await readDayCopies();
    if (copies.length === 0) {
      if ((await caches.has(DAY_CACHE)) || (await navigator.serviceWorker.getRegistration("/"))) await clearDevice();
      return;
    }
    await keepOnly(copies, copiesToPurge(copies, { userId: input.userId, now: input.now ?? new Date() }));
  } catch {
    // Cache indisponible (navigation privée, quota) : rien à effacer.
  }
}

// D4 : déconnexion depuis cet appareil. Ne bloque jamais la déconnexion.
export async function purgeAllDayCopies(): Promise<void> {
  try {
    if (offlineSupported()) await clearDevice();
  } catch {
    // Rien à effacer.
  }
}

// Fichiers de l'application que la page a chargés : sans eux, la copie s'afficherait sans
// mise en forme ni interactions.
export function collectPageAssets(): string[] {
  const urls = new Set<string>();
  const add = (value: string | null | undefined) => {
    if (!value) return;
    const url = new URL(value, window.location.href);
    if (url.origin === window.location.origin && url.pathname.startsWith("/_next/static/")) urls.add(url.pathname + url.search);
  };
  for (const entry of performance.getEntriesByType("resource")) add(entry.name);
  document.querySelectorAll<HTMLScriptElement>("script[src]").forEach((script) => add(script.src));
  document.querySelectorAll<HTMLLinkElement>("link[href]").forEach((link) => add(link.href));
  return [...urls];
}

async function registerWorker(): Promise<void> {
  await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  await navigator.serviceWorker.ready;
}

// Le service worker sert les copies ; il est réenregistré à chaque ouverture en ligne pour
// prendre une nouvelle version déployée.
export async function ensureDayWorker(): Promise<void> {
  try {
    if (offlineSupported()) await registerWorker();
  } catch {
    // Sans service worker, la copie reste en cache ; la page le dira hors ligne.
  }
}

export type DayDocument = { path: string; label: string };

export type SyncOutcome =
  | { status: "ready"; copy: DayCopy; missingDocuments: string[]; missingAssets: number }
  // Pas de réseau, ou serveur injoignable (NFR-09).
  | { status: "offline" }
  // Session expirée : la copie reste lisible, se reconnecter pour la mettre à jour.
  | { status: "session" }
  | { status: "space" }
  // Le navigateur refuse le service worker (réglage, navigateur intégré) : sans lui, la
  // copie ne s'ouvrirait pas sans réseau ; rien n'est copié.
  | { status: "unsupported" }
  // L'écran n'est plus ouvert à ce compte (évènement annulé, droits retirés).
  | { status: "unavailable" };

// D3 : garder le jour J sur l'appareil, ou le mettre à jour. La page se copie en dernier :
// une fiche n'existe que pour une copie complète.
export async function syncDayCopy(input: {
  eventId: string;
  userId: string;
  title: string;
  eventDate: string;
  expiresAt: string;
  documents: DayDocument[];
  // Lot 29b : taille connue des documents embarqués.
  requiredBytes?: number;
  firstTime: boolean;
}): Promise<SyncOutcome> {
  if (input.firstTime) await navigator.storage?.persist?.().catch(() => false);
  const estimate = await navigator.storage?.estimate?.().catch(() => null);
  if (estimate?.quota !== undefined && estimate.usage !== undefined && estimate.quota - estimate.usage < DAY_COPY_MIN_FREE_BYTES + (input.requiredBytes ?? 0)) {
    return { status: "space" };
  }

  const page = dayPagePath(input.eventId);
  let pageResponse: Response;
  try {
    pageResponse = await fetch(page, { cache: "no-store", credentials: "same-origin" });
  } catch {
    return { status: "offline" };
  }
  if (pageResponse.redirected) {
    const target = new URL(pageResponse.url).pathname;
    return target === "/login" || target === "/securite" ? { status: "session" } : { status: "unavailable" };
  }
  if (pageResponse.status >= 500) return { status: "offline" };
  if (!pageResponse.ok) return { status: "unavailable" };

  try {
    await registerWorker();
  } catch {
    return { status: "unsupported" };
  }
  const cache = await caches.open(DAY_CACHE);
  const staticCache = await caches.open(DAY_STATIC_CACHE);

  const documents: string[] = [];
  const missingDocuments: string[] = [];
  for (const document of input.documents) {
    try {
      const response = await fetch(document.path, { cache: "no-store", credentials: "same-origin" });
      if (!response.ok || response.redirected) throw new Error("document");
      await cache.put(document.path, response);
      documents.push(document.path);
    } catch {
      missingDocuments.push(document.label);
    }
  }

  // La page « Hors ligne » d'abord : ses propres fichiers s'ajoutent à ceux de l'écran.
  const pageHtml = await pageResponse.clone().text();
  let offlineHtml = "";
  try {
    const offline = await fetch(OFFLINE_PAGE_PATH, { cache: "no-store", credentials: "same-origin" });
    if (offline.ok && !offline.redirected) {
      offlineHtml = await offline.clone().text();
      await cache.put(OFFLINE_PAGE_PATH, offline);
    }
  } catch {
    // La page « Hors ligne » d'une copie précédente reste.
  }

  const assets: string[] = [];
  let missingAssets = 0;
  const wanted = new Set([...collectPageAssets(), ...staticAssetsIn(pageHtml), ...staticAssetsIn(offlineHtml)]);
  for (const asset of wanted) {
    try {
      const response = await fetch(asset);
      if (!response.ok) throw new Error("asset");
      await staticCache.put(asset, response);
      assets.push(asset);
    } catch {
      missingAssets += 1;
    }
  }

  await cache.put(page, pageResponse);
  const copy: DayCopy = {
    version: 1,
    eventId: input.eventId,
    userId: input.userId,
    title: input.title,
    eventDate: input.eventDate,
    expiresAt: input.expiresAt,
    syncedAt: new Date().toISOString(),
    pages: [page],
    documents,
    assets,
  };
  await cache.put(dayCopyKey(input.eventId), new Response(JSON.stringify(copy), { headers: { "Content-Type": "application/json" } }));
  await pruneStaticAssets(await readDayCopies());
  return { status: "ready", copy, missingDocuments, missingAssets };
}
