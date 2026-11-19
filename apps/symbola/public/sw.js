// Lot 29a (ARC-09, JRJ-02, NFR-09 ; ADR 0064, décisions D2 et D6) — service worker de
// Symbola, écrit à la main et limité au jour J. Il n'est enregistré que sur un appareil où
// un jour J est gardé (lib/offline/device-copies.ts), et désinscrit quand il n'y en a plus.
// Les copies sont faites par l'écran du jour J lui-même ; ce fichier ne fait que les servir.
//
// Il ne répond qu'à trois sortes de requêtes ; toutes les autres passent au réseau, sans
// copie, comme sans service worker :
// - les fichiers statiques de Next (/_next/static/, noms à empreinte, jamais modifiés) :
//   la copie d'abord, le réseau sinon ;
// - la navigation vers l'écran d'un jour J gardé, son PDF ou ses documents : le réseau d'abord ; la
//   copie si le réseau, le serveur (NFR-09) ou la session ne répondent pas ;
// - toute autre navigation : le réseau, et la page « Hors ligne » s'il ne répond pas.
//
// Lot 53 (ARC-09, HUB-15 ; D4 ; ADR 0095, ADR 0096) : il affiche aussi les notifications push et ouvre,
// au clic, l'écran où agir. Le message arrive chiffré (le navigateur le déchiffre) ; il ne contient que
// la sorte en mots et un chemin de l'app. Sa portée hors ligne ne change pas : le jour J seulement. Un
// appareil abonné au push garde le service worker même sans jour J gardé.
//
// Interrupteur d'arrêt : docs/runbooks/deploiement.md (§ Service worker).
// Les quatre noms ci-dessous sont aussi dans lib/offline/day-copy.ts (un test les compare).
"use strict";

const DAY_CACHE = "symbola-jour-j-v1";
const DAY_STATIC_CACHE = "symbola-jour-j-statique-v1";
const OFFLINE_PAGE_PATH = "/hors-ligne";
const DAY_COPY_SUFFIX = "/__copie";

// L'écran, son PDF du programme et (lot 29b) ses documents embarqués.
const DAY_PATH = /^\/jour-j\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/programme|\/documents\/[a-z_]+\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?$/i;
// Au-delà, un serveur qui ne répond pas est tenu pour injoignable (NFR-09).
const SERVER_TIMEOUT_MS = 5000;

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Une ancienne forme des copies ne serait plus lue : elle s'efface.
      for (const name of await caches.keys()) {
        if (name.startsWith("symbola-") && name !== DAY_CACHE && name !== DAY_STATIC_CACHE) await caches.delete(name);
      }
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(staticAsset(request));
    return;
  }
  if (request.mode !== "navigate") return;
  const day = DAY_PATH.exec(url.pathname);
  event.respondWith(day ? dayNavigation(event, url.pathname, day[1].toLowerCase()) : navigation(event));
});

// Lire sans jamais créer un cache : caches.open() en ferait renaître un vide après un
// effacement (déconnexion, « Retirer »), tant que cette version contrôle encore la page.
async function cached(cacheName, request) {
  return (await caches.has(cacheName)) ? (await caches.open(cacheName)).match(request) : undefined;
}

async function staticAsset(request) {
  return (await cached(DAY_STATIC_CACHE, request)) || fetch(request);
}

async function fromNetwork(event) {
  const preloaded = await event.preloadResponse;
  return preloaded || fetch(event.request);
}

async function offlinePage() {
  return (await cached(DAY_CACHE, OFFLINE_PAGE_PATH)) || Response.error();
}

async function navigation(event) {
  try {
    return await fromNetwork(event);
  } catch {
    return offlinePage();
  }
}

async function dayNavigation(event, path, eventId) {
  if (!(await caches.has(DAY_CACHE))) return navigation(event);
  const cache = await caches.open(DAY_CACHE);
  const copy = await readCopy(cache, eventId);
  if (!copy) return navigation(event);
  // D4 : le lendemain de l'évènement à minuit, la copie s'efface, même sans réseau.
  if (Date.now() >= Date.parse(copy.expiresAt)) {
    await removeCopy(cache, copy);
    return navigation(event);
  }
  try {
    const response = await withTimeout(fromNetwork(event), SERVER_TIMEOUT_MS);
    // Une erreur du serveur, ou un renvoi vers la connexion (session expirée) : la copie.
    const redirected = response.type === "opaqueredirect" || (response.status >= 300 && response.status < 400);
    if (response.status < 500 && !redirected) return response;
  } catch {
    // Pas de réseau, ou serveur trop lent : la copie.
  }
  return (await cache.match(path)) || offlinePage();
}

async function readCopy(cache, eventId) {
  const response = await cache.match(`/jour-j/${eventId}${DAY_COPY_SUFFIX}`);
  if (!response) return null;
  try {
    const copy = await response.json();
    return copy && typeof copy.expiresAt === "string" && Array.isArray(copy.pages) && Array.isArray(copy.documents) ? copy : null;
  } catch {
    return null;
  }
}

async function removeCopy(cache, copy) {
  for (const path of [...copy.pages, ...copy.documents]) await cache.delete(path);
  await cache.delete(`/jour-j/${copy.eventId}${DAY_COPY_SUFFIX}`);
}

function withTimeout(promise, milliseconds) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), milliseconds);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

// —— Notifications push (lot 53) ——————————————————————————————————————————————————————————————

const PUSH_ICON = "/icons/192.png";
const PUSH_FALLBACK_PATH = "/notifications";

// Un chemin de l'app (« /devis/… »), jamais une adresse d'ailleurs.
function safePath(value) {
  return typeof value === "string" && /^\/[^/\\]/.test(value) && value.length <= 500 ? value : PUSH_FALLBACK_PATH;
}

function shortText(value, max) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : "";
}

function pushContent(data) {
  const source = data && typeof data === "object" ? data : {};
  return {
    title: shortText(source.title, 100) || "Symbola",
    body: shortText(source.body, 200),
    tag: shortText(source.tag, 100) || undefined,
    url: safePath(source.url),
  };
}

self.addEventListener("push", (event) => {
  let data = null;
  try {
    data = event.data ? event.data.json() : null;
  } catch {
    data = null;
  }
  const content = pushContent(data);
  event.waitUntil(self.registration.showNotification(content.title, { body: content.body, tag: content.tag, icon: PUSH_ICON, badge: PUSH_ICON, data: { url: content.url } }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = safePath(event.notification.data && event.notification.data.url);
  event.waitUntil(openTarget(target));
});

// Une fenêtre de Symbola déjà sur cet écran prend la main ; sinon, l'écran s'ouvre.
async function openTarget(path) {
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of windows) {
    const url = new URL(client.url);
    if (url.origin === self.location.origin && url.pathname + url.search === path && "focus" in client) return client.focus();
  }
  return self.clients.openWindow(path);
}
