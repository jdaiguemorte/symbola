// Lot 38b (HUB-29 ; D11 ; ADR 0072) — écriture d'un calendrier iCalendar (RFC 5545), sans
// dépendance : texte échappé, lignes pliées à 75 octets sans couper un caractère, fins de ligne CRLF.
// Lot 64 : un évènement daté est sa plage occupée (heures locales, TRANSP) ; une séquence du programme porte des instants UTC,
// calculés depuis l'heure locale dans le fuseau de l'évènement (heure d'été comprise) : l'agenda
// les montre à l'heure de celui qui le lit.

export type IcsMoment = { date: string } | { dateTime: Date };

export type IcsEvent = {
  uid: string;
  summary: string;
  start: IcsMoment;
  end?: IcsMoment;
  location?: string | null;
  description?: string | null;
  url?: string | null;
  status?: "TENTATIVE" | "CONFIRMED" | null;
  // Lot 64 (HUB-29) : OPAQUE = occupé (bloque l'agenda et les outils de réservation), TRANSPARENT =
  // affiché sans bloquer. Absent : la règle de l'agenda (une journée entière y est souvent libre).
  transparency?: "OPAQUE" | "TRANSPARENT" | null;
};

export function escapeIcsText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

// Plie une ligne de contenu : au plus 75 octets par ligne, la suite commence par une espace.
export function foldIcsLine(line: string): string {
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  for (const character of line) {
    const size = Buffer.byteLength(character, "utf8");
    const limit = parts.length === 0 ? 75 : 74;
    if (bytes + size > limit) {
      parts.push(current);
      current = "";
      bytes = 0;
    }
    current += character;
    bytes += size;
  }
  parts.push(current);
  return parts.map((part, index) => (index === 0 ? part : ` ${part}`)).join("\r\n");
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function utcStamp(instant: Date): string {
  return `${instant.getUTCFullYear()}${pad(instant.getUTCMonth() + 1)}${pad(instant.getUTCDate())}T${pad(instant.getUTCHours())}${pad(instant.getUTCMinutes())}${pad(instant.getUTCSeconds())}Z`;
}

function nextDay(date: string): string {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

function momentLine(name: "DTSTART" | "DTEND", moment: IcsMoment): string {
  return "date" in moment ? `${name};VALUE=DATE:${moment.date.replace(/-/g, "")}` : `${name}:${utcStamp(moment.dateTime)}`;
}

// Décalage (minutes) du fuseau à un instant donné.
function offsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(instant);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return (Date.UTC(value("year"), value("month") - 1, value("day"), value("hour"), value("minute"), value("second")) - instant.getTime()) / 60_000;
}

// L'instant d'une heure locale (« 15:30 » le « 2027-06-12 ») dans un fuseau IANA.
export function wallTimeToInstant(date: string, time: string, timeZone: string): Date {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  const [hours, minutes] = time.split(":").map(Number) as [number, number];
  const asUtc = Date.UTC(year, month - 1, day, hours, minutes);
  const first = asUtc - offsetMinutes(new Date(asUtc), timeZone) * 60_000;
  return new Date(asUtc - offsetMinutes(new Date(first), timeZone) * 60_000);
}

export function buildIcs(input: { name: string; events: IcsEvent[]; now: Date }): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Symbola//Calendrier//FR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${escapeIcsText(input.name)}`];
  for (const event of input.events) {
    lines.push("BEGIN:VEVENT", `UID:${event.uid}`, `DTSTAMP:${utcStamp(input.now)}`, momentLine("DTSTART", event.start));
    if (event.end) lines.push(momentLine("DTEND", event.end));
    else if ("date" in event.start) lines.push(momentLine("DTEND", { date: nextDay(event.start.date) }));
    lines.push(`SUMMARY:${escapeIcsText(event.summary)}`);
    if (event.location) lines.push(`LOCATION:${escapeIcsText(event.location)}`);
    if (event.description) lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
    if (event.url) lines.push(`URL:${event.url}`);
    if (event.status) lines.push(`STATUS:${event.status}`);
    if (event.transparency) lines.push(`TRANSP:${event.transparency}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}
