// Lot 40c (NFR-18, ADR 0078) — quand un cookie de Symbola part en « Secure ». En production, toujours,
// sauf si l'adresse publique de l'app est http://localhost (ou 127.0.0.1, [::1]) : c'est le banc
// d'essai local et la CI, où l'app compilée tourne en production sans HTTPS. Chromium et Firefox y
// acceptent un cookie « Secure », WebKit (le moteur de Safari) le refuse : sans cette exception, aucun
// parcours ne se connecte sous WebKit. Une adresse en HTTP qui n'est pas locale garde « Secure ».
// Sans dépendance Node : le middleware s'exécute hors de Node.
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

// Sans adresse publique connue (variable absente, ou illisible par le middleware), « Secure » : la
// règle sûre. Le banc d'essai déclare donc son adresse (APP_PUBLIC_URL du job e2e de la CI).
export function secureCookies(nodeEnv: string | undefined = process.env.NODE_ENV, appPublicUrl: string | undefined = process.env.APP_PUBLIC_URL): boolean {
  if (nodeEnv !== "production") return false;
  if (!appPublicUrl) return true;
  try {
    const url = new URL(appPublicUrl);
    return !(url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname));
  } catch {
    return true;
  }
}
