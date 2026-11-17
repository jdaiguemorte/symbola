// Lot 40b (Q27, NFR-16, décision D14, ADR 0077) — envoi des erreurs au service de suivi (GlitchTip,
// protocole des kits Sentry : une « enveloppe » par erreur), sans dépendance : l'app choisit champ
// par champ ce qui sort (SEC-20). Sortent : la référence courte (celle de l'écran et du journal), le
// type de l'erreur, sa pile d'appels (fichiers, fonctions, lignes), la route sans identifiant ni
// jeton, la version de l'app et l'origine (serveur ou navigateur). Jamais : le message de l'erreur
// (il peut citer une valeur saisie), l'adresse complète, la personne, les en-têtes ni les cookies.
// Sans adresse de projet (ERROR_TRACKING_DSN vide), rien ne part.
import { ERROR_REFERENCE } from "./error-reference";

export type ErrorSource = "serveur" | "navigateur";
export type ErrorReport = { reference: string; name: string; stack?: string | null; route?: string | null; source: ErrorSource; release: string };
type Frame = { function?: string; filename: string; lineno: number; colno: number };

const MAX_FRAMES = 40;
const SEND_TIMEOUT_MS = 3000;

// « http://<clé>@glitchtip:8000/<projet> » → adresse de l'enveloppe et clé publique du projet.
export function parseDsn(dsn: string): { endpoint: string; key: string } | null {
  try {
    const url = new URL(dsn);
    const project = url.pathname.replace(/^\/+|\/+$/g, "");
    if (!url.username || !/^\d+$/.test(project) || !/^https?:$/.test(url.protocol)) return null;
    return { endpoint: `${url.protocol}//${url.host}/api/${project}/envelope/`, key: decodeURIComponent(url.username) };
  } catch {
    return null;
  }
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

// La route sans requête ni fragment, sans identifiant (UUID, nombre) ni jeton (segment long : un
// lien personnel porte son secret dans l'adresse), en caractères simples.
export function scrubRoute(route: string | null | undefined): string | null {
  if (!route) return null;
  const path = route.split(/[?#]/)[0] ?? "";
  const segments = path
    .replace(UUID, "[id]")
    .split("/")
    .map((segment) => {
      if (/^\d+$/.test(segment)) return "[n]";
      // Une adresse e-mail (ou tout « @ ») dans l'adresse de la page n'en sort pas.
      if (segment.includes("@") || segment.includes("%40")) return "[valeur]";
      if (segment.length > 24 && !segment.startsWith("[")) return "[jeton]";
      return segment.replace(/[^\w\-.[\]]/g, "");
    });
  const cleaned = segments.join("/").slice(0, 200);
  return cleaned.startsWith("/") ? cleaned : `/${cleaned}`;
}

// Pile d'appels : « at fonction (fichier:ligne:colonne) » (Node, Chromium) ou « fonction@fichier:l:c »
// (Firefox, Safari). La première ligne (« Type: message ») n'est jamais lue. Les fichiers perdent
// leur origine et leurs paramètres. Ordre de Sentry : le plus ancien appel d'abord.
export function parseStack(stack: string | null | undefined): Frame[] {
  if (!stack) return [];
  const frames: Frame[] = [];
  for (const line of stack.split("\n")) {
    const v8 = /^\s*at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?\s*$/.exec(line);
    const gecko = v8 ? null : /^\s*([^@\s]*)@(.+?):(\d+):(\d+)\s*$/.exec(line);
    const match = v8 ?? gecko;
    if (!match) continue;
    const filename = (match[2] ?? "")
      .replace(/^file:\/\//, "")
      .replace(/^https?:\/\/[^/]+/, "")
      .split(/[?#]/)[0]!
      .slice(-200);
    frames.push({ ...(match[1] ? { function: match[1].slice(0, 200) } : {}), filename, lineno: Number(match[3]), colno: Number(match[4]) });
    if (frames.length === MAX_FRAMES) break;
  }
  return frames.reverse();
}

export function buildEnvelope(report: ErrorReport, now: Date = new Date(), eventId: string = globalThis.crypto.randomUUID().replace(/-/g, "")): string {
  const route = scrubRoute(report.route);
  const frames = parseStack(report.stack);
  const event = {
    event_id: eventId,
    timestamp: now.getTime() / 1000,
    platform: report.source === "navigateur" ? "javascript" : "node",
    level: "error",
    release: report.release.slice(0, 64),
    ...(route ? { transaction: route } : {}),
    tags: { reference: report.reference, source: report.source, ...(route ? { route } : {}) },
    exception: { values: [{ type: report.name.replace(/[^\w.]/g, "").slice(0, 100) || "Error", value: "", ...(frames.length > 0 ? { stacktrace: { frames } } : {}) }] },
  };
  return `${JSON.stringify({ event_id: eventId, sent_at: now.toISOString() })}\n${JSON.stringify({ type: "event", content_type: "application/json" })}\n${JSON.stringify(event)}\n`;
}

// Envoie l'erreur ; ne lève jamais (le suivi ne doit pas aggraver une erreur). true : reçue.
export async function reportError(report: ErrorReport, options: { dsn?: string; fetchImpl?: typeof fetch; now?: Date } = {}): Promise<boolean> {
  const target = parseDsn(options.dsn ?? process.env.ERROR_TRACKING_DSN ?? "");
  if (!target || !ERROR_REFERENCE.test(report.reference)) return false;
  try {
    const response = await (options.fetchImpl ?? fetch)(target.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-sentry-envelope", "X-Sentry-Auth": `Sentry sentry_version=7, sentry_client=symbola/1.0, sentry_key=${target.key}` },
      body: buildEnvelope(report, options.now),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    return response.ok;
  } catch (error) {
    console.error("suivi des erreurs : envoi impossible", error instanceof Error ? error.name : "inconnue");
    return false;
  }
}
