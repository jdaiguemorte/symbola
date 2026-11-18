// Lot 46 (RDV-02 ; D2, D3, D4 ; ADR 0080) — lecture d'un agenda extérieur par son adresse secrète
// ICS (Google, Apple, Outlook), et garde réseau. L'adresse est un justificatif : elle n'apparaît dans
// aucun message d'erreur ni journal (une erreur ne porte que son genre). Garde (SSRF) :
// - https seulement (« webcal:// » est lu en https), sans identifiants dans l'adresse ;
// - toute adresse qui se résout vers un réseau privé, local, de lien local, de métadonnées ou réservé
//   est refusée, au moment même de la connexion (résolution DNS gardée : pas de seconde résolution
//   qu'un attaquant pourrait faire changer), et à chaque redirection (trois au plus) ;
// - 2 Mo au plus, 10 secondes au plus pour tout (redirections et lecture comprises).
// Lecture (ical.js, D3) : répétitions avec leurs exceptions et occurrences déplacées, fuseaux décrits
// dans le fichier. D4 : seules les plages occupées sont gardées (début, fin) — ni titre, ni lieu, ni
// participants ; un évènement « disponible » (TRANSP:TRANSPARENT) ou annulé n'occupe rien.
import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import { request } from "node:https";
import { BlockList, isIP } from "node:net";
import ICAL from "ical.js";
import type { CalendarSourceErrorKind } from "@symbola/contracts";
import { wallTimeToInstant } from "@/lib/calendar/ics";
import type { Range } from "./slots";

export const CALENDAR_MAX_BYTES = 2 * 1024 * 1024;
export const CALENDAR_TIMEOUT_MS = 10_000;
export const CALENDAR_MAX_REDIRECTS = 3;
const MAX_OCCURRENCES_PER_EVENT = 2000;
const MAX_INTERVALS = 20_000;
const URL_MAX_LENGTH = 2000;

// Une lecture échouée : son genre seulement, jamais l'adresse.
export class CalendarReadError extends Error {
  constructor(readonly kind: CalendarSourceErrorKind) {
    super(`lecture de l'agenda extérieur refusée ou échouée (${kind})`);
    this.name = "CalendarReadError";
  }
}

// Adresse saisie inutilisable (pas https, identifiants, trop longue…).
export class CalendarUrlInvalidError extends Error {
  constructor() {
    super("adresse d'agenda invalide");
    this.name = "CalendarUrlInvalidError";
  }
}

// Réseaux jamais joignables depuis le serveur (IPv4 et IPv6, RFC 6890 et suivantes).
const BLOCKED = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16], // lien local, dont 169.254.169.254 (métadonnées des hébergeurs)
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  BLOCKED.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["fc00::", 7], // dont fd00:ec2::254 (métadonnées)
  ["fe80::", 10],
  ["fec0::", 10],
  ["ff00::", 8],
] as const) {
  BLOCKED.addSubnet(network, prefix, "ipv6");
}

export function isBlockedAddress(address: string): boolean {
  const bare = address.replace(/^\[|\]$/g, "");
  const family = isIP(bare);
  if (family === 4) return BLOCKED.check(bare, "ipv4");
  if (family === 6) {
    // IPv4 inscrite dans une IPv6 (::ffff:10.0.0.1, ::10.0.0.1) : jugée comme IPv4.
    const mapped = /^(?:::ffff:|::)(\d+\.\d+\.\d+\.\d+)$/i.exec(bare);
    if (mapped) return BLOCKED.check(mapped[1]!, "ipv4");
    const hexMapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(bare);
    if (hexMapped) {
      const high = parseInt(hexMapped[1]!, 16);
      const low = parseInt(hexMapped[2]!, 16);
      return BLOCKED.check(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`, "ipv4");
    }
    return BLOCKED.check(bare, "ipv6");
  }
  return true; // pas une adresse : refusée
}

// L'adresse saisie, normalisée : « webcal:// » devient « https:// » ; tout le reste est refusé.
export function normalizeCalendarUrl(raw: string): URL {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > URL_MAX_LENGTH) throw new CalendarUrlInvalidError();
  let url: URL;
  try {
    url = new URL(trimmed.replace(/^webcals?:\/\//i, "https://"));
  } catch {
    throw new CalendarUrlInvalidError();
  }
  if (url.protocol !== "https:" || url.username || url.password || !url.hostname) throw new CalendarUrlInvalidError();
  if (url.hostname === "localhost" || url.hostname.endsWith(".localhost")) throw new CalendarUrlInvalidError();
  if (isIP(url.hostname.replace(/^\[|\]$/g, "")) && isBlockedAddress(url.hostname)) throw new CalendarUrlInvalidError();
  url.hash = "";
  return url;
}

// Ce qu'on peut montrer d'une adresse secrète : son hôte et ses quatre derniers caractères.
export function urlHint(url: URL): string {
  const tail = url.href.replace(/\/+$/, "").slice(-4);
  return `${url.hostname}/…${tail}`.slice(0, 120);
}

type LookupCallback = (error: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void;
type Resolver = (hostname: string) => Promise<LookupAddress[]>;

const systemResolver: Resolver = (hostname) =>
  new Promise((resolve, reject) => dnsLookup(hostname, { all: true, verbatim: true }, (error, addresses) => (error ? reject(error) : resolve(addresses))));

function blockedError(): NodeJS.ErrnoException {
  const error: NodeJS.ErrnoException = new Error("adresse réseau refusée");
  error.code = "ESYMBOLA_BLOCKED";
  return error;
}

// Résolution DNS gardée, appelée par la connexion elle-même : si l'une des adresses du nom est
// interdite, aucune n'est utilisée.
export function guardedLookup(resolver: Resolver = systemResolver) {
  return (hostname: string, options: { all?: boolean } | number | undefined, callback: LookupCallback): void => {
    resolver(hostname)
      .then((addresses) => {
        if (addresses.length === 0 || addresses.some((entry) => isBlockedAddress(entry.address))) {
          callback(blockedError(), []);
          return;
        }
        if (typeof options === "object" && options?.all) callback(null, addresses);
        else callback(null, addresses[0]!.address, addresses[0]!.family);
      })
      .catch((error: NodeJS.ErrnoException) => callback(error, []));
  };
}

export type TransportResponse = { status: number; location: string | null; contentLength: number | null; body: AsyncIterable<Uint8Array> };
export type Transport = (url: URL, signal: AbortSignal) => Promise<TransportResponse>;

// Transport réel : https de Node, résolution gardée ; une adresse IP écrite telle quelle est jugée
// avant la connexion (Node ne résout pas une adresse IP).
export function httpsTransport(resolver?: Resolver): Transport {
  const lookup = guardedLookup(resolver);
  return (url, signal) =>
    new Promise((resolve, reject) => {
      if (url.protocol !== "https:") return reject(new CalendarReadError("blocked"));
      const host = url.hostname.replace(/^\[|\]$/g, "");
      if (isIP(host) && isBlockedAddress(host)) return reject(new CalendarReadError("blocked"));
      const req = request(
        {
          hostname: host,
          port: url.port || 443,
          path: `${url.pathname}${url.search}`,
          method: "GET",
          headers: { accept: "text/calendar, text/plain;q=0.5", "user-agent": "Symbola-Agenda/1.0" },
          lookup: lookup as never,
          signal,
        },
        (response) => {
          const length = Number(response.headers["content-length"]);
          resolve({
            status: response.statusCode ?? 0,
            location: typeof response.headers.location === "string" ? response.headers.location : null,
            contentLength: Number.isFinite(length) ? length : null,
            body: response,
          });
        },
      );
      req.on("error", reject);
      req.end();
    });
}

function errorKind(error: unknown): CalendarSourceErrorKind {
  if (error instanceof CalendarReadError) return error.kind;
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  if (code === "ESYMBOLA_BLOCKED") return "blocked";
  if (code === "ABORT_ERR" || (error as Error | undefined)?.name === "AbortError" || code === "ETIMEDOUT") return "timeout";
  return "http";
}

// Lit le fichier ICS : redirections suivies et regardées une à une, taille et durée bornées.
export async function fetchCalendarText(
  url: URL,
  options: { transport?: Transport; timeoutMs?: number; maxBytes?: number; maxRedirects?: number } = {},
): Promise<string> {
  const transport = options.transport ?? httpsTransport();
  const maxBytes = options.maxBytes ?? CALENDAR_MAX_BYTES;
  const maxRedirects = options.maxRedirects ?? CALENDAR_MAX_REDIRECTS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? CALENDAR_TIMEOUT_MS);
  try {
    let current = url;
    for (let hop = 0; ; hop++) {
      if (current.protocol !== "https:" || current.username || current.password) throw new CalendarReadError("blocked");
      const response = await transport(current, controller.signal);
      if (response.status >= 300 && response.status < 400 && response.location) {
        if (hop >= maxRedirects) throw new CalendarReadError("http");
        let next: URL;
        try {
          next = new URL(response.location.replace(/^webcals?:\/\//i, "https://"), current);
        } catch {
          throw new CalendarReadError("http");
        }
        current = next;
        continue;
      }
      if (response.status < 200 || response.status >= 300) throw new CalendarReadError("http");
      if (response.contentLength !== null && response.contentLength > maxBytes) throw new CalendarReadError("too_large");
      const chunks: Uint8Array[] = [];
      let size = 0;
      for await (const chunk of response.body) {
        size += chunk.byteLength;
        if (size > maxBytes) throw new CalendarReadError("too_large");
        chunks.push(chunk);
      }
      return Buffer.concat(chunks).toString("utf8");
    }
  } catch (error) {
    if (controller.signal.aborted) throw new CalendarReadError("timeout");
    throw new CalendarReadError(errorKind(error));
  } finally {
    clearTimeout(timer);
  }
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function isValidZone(zone: string | undefined): zone is string {
  if (!zone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

// L'instant d'une heure du fichier. Une heure « flottante » (sans fuseau, ou d'un fuseau non décrit
// dans le fichier) est lue dans le fuseau nommé s'il est connu, sinon dans celui de l'organisation ;
// jamais dans celui du serveur.
function instantOf(time: ICAL.Time, fallbackZone: string): Date {
  const date = `${time.year}-${pad(time.month)}-${pad(time.day)}`;
  if (time.isDate) return wallTimeToInstant(date, "00:00", fallbackZone);
  if (time.zone && time.zone !== ICAL.Timezone.localTimezone) return time.toJSDate();
  const named = (time as unknown as { timezone?: string }).timezone;
  const zone = isValidZone(named) ? named : fallbackZone;
  const instant = wallTimeToInstant(date, `${pad(time.hour)}:${pad(time.minute)}`, zone);
  return new Date(instant.getTime() + time.second * 1000);
}

// Plages qui se touchent ou se chevauchent : réunies (moins de lignes, même effet).
export function mergeRanges(ranges: Range[]): Range[] {
  const sorted = [...ranges].sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: Range[] = [];
  for (const range of sorted) {
    const last = merged.at(-1);
    if (last && range.start.getTime() <= last.end.getTime()) {
      if (range.end.getTime() > last.end.getTime()) last.end = range.end;
    } else merged.push({ start: range.start, end: range.end });
  }
  return merged;
}

// Les plages occupées du fichier entre `from` et `to` ; rien d'autre n'en sort.
export function parseBusyRanges(text: string, window: { from: Date; to: Date; fallbackZone: string }): Range[] {
  let root: ICAL.Component;
  try {
    root = new ICAL.Component(ICAL.parse(text));
  } catch {
    throw new CalendarReadError("parse");
  }
  if (root.name !== "vcalendar") throw new CalendarReadError("parse");
  const from = window.from.getTime();
  const to = window.to.getTime();
  const ranges: Range[] = [];
  const keep = (start: Date, end: Date) => {
    if (end.getTime() <= start.getTime() || end.getTime() <= from || start.getTime() >= to) return;
    ranges.push({ start, end });
  };
  const free = (component: ICAL.Component) => {
    const transp = String(component.getFirstPropertyValue("transp") ?? "").toUpperCase();
    const status = String(component.getFirstPropertyValue("status") ?? "").toUpperCase();
    return transp === "TRANSPARENT" || status === "CANCELLED";
  };
  try {
    const vevents = root.getAllSubcomponents("vevent");
    // Occurrences déplacées ou annulées (RECURRENCE-ID) : rattachées à leur série.
    const exceptions = new Map<string, ICAL.Component[]>();
    for (const component of vevents) {
      if (!component.hasProperty("recurrence-id")) continue;
      const uid = String(component.getFirstPropertyValue("uid") ?? "");
      exceptions.set(uid, [...(exceptions.get(uid) ?? []), component]);
    }
    for (const component of vevents) {
      if (component.hasProperty("recurrence-id")) continue;
      if (!component.hasProperty("dtstart")) continue;
      const uid = String(component.getFirstPropertyValue("uid") ?? "");
      const event = new ICAL.Event(component, { strictExceptions: false });
      const related = exceptions.get(uid) ?? [];
      for (const exception of related) event.relateException(exception);
      if (!event.isRecurring()) {
        if (free(component)) continue;
        keep(instantOf(event.startDate, window.fallbackZone), instantOf(event.endDate, window.fallbackZone));
        continue;
      }
      const iterator = event.iterator();
      for (let count = 0; count < MAX_OCCURRENCES_PER_EVENT; count++) {
        const next = iterator.next();
        if (!next) break;
        const details = event.getOccurrenceDetails(next);
        const start = instantOf(details.startDate, window.fallbackZone);
        if (start.getTime() >= to) break;
        if (free(details.item.component)) continue;
        keep(start, instantOf(details.endDate, window.fallbackZone));
      }
      // Une occurrence déplacée hors de la série (après la fin de la règle) reste occupée.
      for (const exception of related) {
        if (free(exception)) continue;
        const moved = new ICAL.Event(exception);
        keep(instantOf(moved.startDate, window.fallbackZone), instantOf(moved.endDate, window.fallbackZone));
      }
      if (ranges.length > MAX_INTERVALS) throw new CalendarReadError("too_large");
    }
  } catch (error) {
    if (error instanceof CalendarReadError) throw error;
    throw new CalendarReadError("parse");
  }
  if (ranges.length > MAX_INTERVALS) throw new CalendarReadError("too_large");
  return mergeRanges(ranges);
}
