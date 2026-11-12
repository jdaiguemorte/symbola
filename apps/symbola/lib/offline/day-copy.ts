// Lot 29a (ARC-09, JRJ-02, NFR-09 ; ADR 0064, décisions D3 et D4) — règles de la copie
// du jour J gardée sur un appareil. Aucune dépendance au navigateur ni au serveur : le
// serveur calcule l'échéance, les écrans (lib/offline/device-copies.ts) et le service
// worker (public/sw.js) la lisent.
import { z } from "zod";

// Noms repris tels quels par public/sw.js (day-copy.test.ts les compare).
export const DAY_CACHE = "symbola-jour-j-v1";
export const DAY_STATIC_CACHE = "symbola-jour-j-statique-v1";
export const OFFLINE_PAGE_PATH = "/hors-ligne";
export const DAY_COPY_SUFFIX = "/__copie";

export function dayPagePath(eventId: string): string {
  return `/jour-j/${eventId}`;
}

// PDF du programme (version de l'équipe), servi en ligne et gardé avec la page.
export function dayProgramPath(eventId: string): string {
  return `${dayPagePath(eventId)}/programme`;
}

// Fiche de la copie, rangée dans le cache à côté de la page.
export function dayCopyKey(eventId: string): string {
  return `${dayPagePath(eventId)}${DAY_COPY_SUFFIX}`;
}

// Place libre demandée avant de copier (page, fichiers de l'application, PDF).
export const DAY_COPY_MIN_FREE_BYTES = 10 * 1024 * 1024;

function parisParts(instant: Date): { date: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return { date: `${part("year")}-${part("month")}-${part("day")}`, hour: Number(part("hour")) };
}

function addDays(date: string, days: number): string {
  const day = new Date(`${date}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() + days);
  return day.toISOString().slice(0, 10);
}

// Minuit à Paris, le jour dit : une heure (hiver) ou deux (été) avant minuit UTC. L'heure
// change à 2 h ou à 3 h du matin : minuit existe toujours, une seule fois.
export function parisMidnight(date: string): Date {
  for (const offset of ["+01:00", "+02:00"]) {
    const instant = new Date(`${date}T00:00:00${offset}`);
    const paris = parisParts(instant);
    if (paris.date === date && paris.hour === 0) return instant;
  }
  throw new RangeError(`Date invalide : ${date}`);
}

// D4 : la copie s'efface le lendemain de l'évènement à minuit, heure de Paris, soit au
// début du surlendemain.
export function dayCopyExpiresAt(eventDate: string): Date {
  return parisMidnight(addDays(eventDate, 2));
}

export function isDayCopyExpired(expiresAt: string | Date, now: Date = new Date()): boolean {
  return now.getTime() >= new Date(expiresAt).getTime();
}

const pathSchema = z.string().startsWith("/").max(2048);

const dayCopySchema = z.object({
  version: z.literal(1),
  eventId: z.uuid(),
  userId: z.uuid(),
  title: z.string().max(500),
  eventDate: z.iso.date(),
  expiresAt: z.iso.datetime(),
  syncedAt: z.iso.datetime(),
  pages: z.array(pathSchema).max(10),
  documents: z.array(pathSchema).max(200),
  assets: z.array(pathSchema).max(1000),
});

export type DayCopy = z.infer<typeof dayCopySchema>;

// Une fiche illisible (ancienne forme, cache abîmé) compte comme absente.
export function parseDayCopy(value: unknown): DayCopy | null {
  const parsed = dayCopySchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

// D4 : copies à effacer à l'ouverture d'un écran : les périmées, et celles d'un autre
// compte quand on sait qui est connecté (la page « Hors ligne » ne le sait pas).
export function copiesToPurge(copies: DayCopy[], input: { userId: string | null; now: Date }): DayCopy[] {
  return copies.filter(
    (copy) => isDayCopyExpired(copy.expiresAt, input.now) || (input.userId !== null && copy.userId !== input.userId),
  );
}

// Fichiers de l'application cités par une page (scripts, feuilles de style, polices, et
// morceaux annoncés dans ses données de rendu) : copiés avec elle, sans quoi la page servie
// hors ligne ne s'animerait pas.
export function staticAssetsIn(html: string): string[] {
  return [...new Set(html.match(/\/_next\/static\/[A-Za-z0-9_\-./~%@]+/g) ?? [])];
}

// Fichiers de l'application encore utiles : ceux des copies gardées ; les autres
// s'effacent (une version déployée remplace les noms à empreinte).
export function assetsInUse(copies: DayCopy[]): Set<string> {
  return new Set(copies.flatMap((copy) => copy.assets));
}
