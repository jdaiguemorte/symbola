// Lot 46 (RDV-02 ; D2, D3, D4) — lecture d'un agenda extérieur : garde réseau (SSRF) et plages
// occupées tirées du fichier. Aucun accès réseau réel : les résolutions DNS et les réponses sont
// simulées ; le transport https réel est éprouvé jusqu'au refus, avant toute connexion.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CALENDAR_MAX_BYTES,
  CalendarReadError,
  CalendarUrlInvalidError,
  fetchCalendarText,
  guardedLookup,
  httpsTransport,
  isBlockedAddress,
  mergeRanges,
  normalizeCalendarUrl,
  parseBusyRanges,
  urlHint,
  type Transport,
} from "./ics-reader";

const SECRET = "https://calendar.example.test/calendar/ical/private-7f3a9c2e/basic.ics";

function body(text: string): AsyncIterable<Uint8Array> {
  return (async function* () {
    yield Buffer.from(text, "utf8");
  })();
}

const resolverOf = (table: Record<string, string>) => async (hostname: string) => {
  const address = table[hostname];
  if (!address) throw Object.assign(new Error("introuvable"), { code: "ENOTFOUND" });
  return [{ address, family: address.includes(":") ? 6 : 4 }];
};

async function kindOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return "none";
  } catch (error) {
    expect(error).toBeInstanceOf(CalendarReadError);
    expect(String((error as Error).message)).not.toContain("private-7f3a9c2e");
    return (error as CalendarReadError).kind;
  }
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("RDV-02 — Garde réseau de la lecture d'un agenda extérieur (SSRF)", () => {
  it("refuse http, les identifiants dans l'adresse, localhost et une adresse IP privée écrite telle quelle ; lit webcal:// en https", () => {
    for (const raw of ["http://calendar.example.test/a.ics", "ftp://calendar.example.test/a.ics", "https://user:secret@calendar.example.test/a.ics", "https://localhost/a.ics", "https://127.0.0.1/a.ics", "https://10.1.2.3/a.ics", "https://[::1]/a.ics", "https://169.254.169.254/latest/meta-data", "pas une adresse", ""]) {
      expect(() => normalizeCalendarUrl(raw), raw).toThrow(CalendarUrlInvalidError);
    }
    expect(normalizeCalendarUrl("webcal://p01-caldav.icloud.example.test/published/2/abc").href).toBe("https://p01-caldav.icloud.example.test/published/2/abc");
  });

  it("classe les réseaux privés, locaux, de lien local, de métadonnées et réservés comme interdits", () => {
    for (const address of ["127.0.0.1", "10.0.0.5", "172.16.4.2", "192.168.1.10", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "::", "fe80::1", "fd00:ec2::254", "fc00::1", "::ffff:127.0.0.1", "::ffff:a00:5", "224.0.0.1", "255.255.255.255"]) {
      expect(isBlockedAddress(address), address).toBe(true);
    }
    for (const address of ["142.250.74.110", "17.253.144.10", "2a00:1450:4007:80e::200e"]) {
      expect(isBlockedAddress(address), address).toBe(false);
    }
  });

  it("la résolution gardée refuse un nom qui pointe, même en partie, vers une adresse interdite", async () => {
    const lookup = guardedLookup(async () => [
      { address: "142.250.74.110", family: 4 },
      { address: "10.0.0.5", family: 4 },
    ]);
    const error = await new Promise<NodeJS.ErrnoException | null>((resolve) => lookup("calendar.example.test", { all: true }, (failure) => resolve(failure)));
    expect(error?.code).toBe("ESYMBOLA_BLOCKED");
    const ok = await new Promise<unknown>((resolve) => guardedLookup(resolverOf({ "calendar.example.test": "142.250.74.110" }))("calendar.example.test", {}, (_e, address) => resolve(address)));
    expect(ok).toBe("142.250.74.110");
  });

  it("le transport https réel refuse la connexion vers un nom résolu en adresse privée, et vers une IP privée, avant tout échange", async () => {
    const transport = httpsTransport(resolverOf({ "calendar.example.test": "127.0.0.1" }));
    expect(await kindOf(fetchCalendarText(new URL(SECRET), { transport }))).toBe("blocked");
    expect(await kindOf(fetchCalendarText(new URL("https://192.168.0.1/a.ics"), { transport }))).toBe("blocked");
  });

  it("une redirection vers une adresse privée est refusée ; vers http aussi ; au-delà de trois, la lecture échoue", async () => {
    const real = httpsTransport(resolverOf({ "interne.example.test": "10.0.0.5" }));
    const redirecting = (location: string): Transport => async (url, signal) => (url.hostname === "calendar.example.test" ? { status: 302, location, contentLength: null, body: body("") } : real(url, signal));
    expect(await kindOf(fetchCalendarText(new URL(SECRET), { transport: redirecting("https://interne.example.test/a.ics") }))).toBe("blocked");
    expect(await kindOf(fetchCalendarText(new URL(SECRET), { transport: redirecting("http://autre.example.test/a.ics") }))).toBe("blocked");
    const loop: Transport = async (url) => ({ status: 301, location: `${url.href}x`, contentLength: null, body: body("") });
    expect(await kindOf(fetchCalendarText(new URL(SECRET), { transport: loop }))).toBe("http");
  });

  it("refuse un fichier de plus de 2 Mo (annoncé ou lu) et une réponse en erreur", async () => {
    const announced: Transport = async () => ({ status: 200, location: null, contentLength: CALENDAR_MAX_BYTES + 1, body: body("") });
    expect(await kindOf(fetchCalendarText(new URL(SECRET), { transport: announced }))).toBe("too_large");
    const streamed: Transport = async () => ({
      status: 200,
      location: null,
      contentLength: null,
      body: (async function* () {
        for (let index = 0; index < 3; index++) yield new Uint8Array(1024 * 1024);
      })(),
    });
    expect(await kindOf(fetchCalendarText(new URL(SECRET), { transport: streamed }))).toBe("too_large");
    const missing: Transport = async () => ({ status: 404, location: null, contentLength: null, body: body("") });
    expect(await kindOf(fetchCalendarText(new URL(SECRET), { transport: missing }))).toBe("http");
  });

  it("abandonne au-delà du délai", async () => {
    const stalled: Transport = (_url, signal) => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(Object.assign(new Error("abandon"), { name: "AbortError" }))));
    expect(await kindOf(fetchCalendarText(new URL(SECRET), { transport: stalled, timeoutMs: 30 }))).toBe("timeout");
  });

  it("l'adresse secrète n'apparaît dans aucun journal ni message, et ne se montre que par son hôte et sa fin", async () => {
    const logs = [vi.spyOn(console, "error").mockImplementation(() => {}), vi.spyOn(console, "warn").mockImplementation(() => {}), vi.spyOn(console, "log").mockImplementation(() => {})];
    await kindOf(fetchCalendarText(new URL(SECRET), { transport: httpsTransport(resolverOf({ "calendar.example.test": "10.0.0.5" })) }));
    for (const spy of logs) for (const call of spy.mock.calls) expect(JSON.stringify(call)).not.toContain("private-7f3a9c2e");
    expect(urlHint(new URL(SECRET))).toBe("calendar.example.test/….ics");
  });

  it("rend le fichier lu quand tout est en règle", async () => {
    const ok: Transport = async () => ({ status: 200, location: null, contentLength: 12, body: body("BEGIN:VCALENDAR") });
    expect(await fetchCalendarText(new URL(SECRET), { transport: ok })).toBe("BEGIN:VCALENDAR");
  });
});

const WINDOW = { from: new Date("2027-03-01T00:00:00Z"), to: new Date("2027-05-01T00:00:00Z"), fallbackZone: "Europe/Paris" };

function calendar(...blocks: string[]): string {
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Test//FR", ...blocks, "END:VCALENDAR"].join("\r\n");
}

const iso = (ranges: { start: Date; end: Date }[]) => ranges.map((range) => [range.start.toISOString(), range.end.toISOString()]);

describe("RDV-02 — Plages occupées lues dans un agenda extérieur (D3, D4)", () => {
  it("garde le début et la fin, jamais le titre, le lieu ni les participants", () => {
    const ranges = parseBusyRanges(
      calendar("BEGIN:VEVENT", "UID:1", "DTSTART:20270302T090000Z", "DTEND:20270302T100000Z", "SUMMARY:Rendez-vous médical", "LOCATION:Cabinet", "ATTENDEE:mailto:docteur@example.test", "END:VEVENT"),
      WINDOW,
    );
    expect(iso(ranges)).toEqual([["2027-03-02T09:00:00.000Z", "2027-03-02T10:00:00.000Z"]]);
    expect(Object.keys(ranges[0]!).sort()).toEqual(["end", "start"]);
  });

  it("une journée entière occupe la journée de Paris ; « disponible » et « annulé » n'occupent rien", () => {
    const ranges = parseBusyRanges(
      calendar(
        "BEGIN:VEVENT", "UID:1", "DTSTART;VALUE=DATE:20270303", "DTEND;VALUE=DATE:20270304", "END:VEVENT",
        "BEGIN:VEVENT", "UID:2", "DTSTART:20270305T090000Z", "DTEND:20270305T100000Z", "TRANSP:TRANSPARENT", "END:VEVENT",
        "BEGIN:VEVENT", "UID:3", "DTSTART:20270306T090000Z", "DTEND:20270306T100000Z", "STATUS:CANCELLED", "END:VEVENT",
      ),
      WINDOW,
    );
    expect(iso(ranges)).toEqual([["2027-03-02T23:00:00.000Z", "2027-03-03T23:00:00.000Z"]]);
  });

  it("une répétition hebdomadaire avec une exception (EXDATE) et une occurrence déplacée (RECURRENCE-ID), dans le fuseau du fichier, heure d'été comprise", () => {
    const ranges = parseBusyRanges(
      calendar(
        "BEGIN:VEVENT",
        "UID:serie",
        "DTSTART;TZID=Europe/Paris:20270315T100000",
        "DTEND;TZID=Europe/Paris:20270315T110000",
        "RRULE:FREQ=WEEKLY;COUNT=4",
        "EXDATE;TZID=Europe/Paris:20270322T100000",
        "END:VEVENT",
        "BEGIN:VEVENT",
        "UID:serie",
        "RECURRENCE-ID;TZID=Europe/Paris:20270405T100000",
        "DTSTART;TZID=Europe/Paris:20270406T150000",
        "DTEND;TZID=Europe/Paris:20270406T160000",
        "END:VEVENT",
      ),
      WINDOW,
    );
    expect(iso(ranges)).toEqual([
      ["2027-03-15T09:00:00.000Z", "2027-03-15T10:00:00.000Z"], // heure d'hiver
      ["2027-03-29T08:00:00.000Z", "2027-03-29T09:00:00.000Z"], // heure d'été : toujours 10 h à Paris
      ["2027-04-06T13:00:00.000Z", "2027-04-06T14:00:00.000Z"], // occurrence déplacée au mardi 15 h
    ]);
  });

  it("un fuseau Windows décrit dans le fichier (export Outlook) est lu par sa définition", () => {
    const ranges = parseBusyRanges(
      calendar(
        "BEGIN:VTIMEZONE",
        "TZID:Romance Standard Time",
        "BEGIN:STANDARD",
        "DTSTART:16010101T030000",
        "TZOFFSETFROM:+0200",
        "TZOFFSETTO:+0100",
        "RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=10",
        "END:STANDARD",
        "BEGIN:DAYLIGHT",
        "DTSTART:16010101T020000",
        "TZOFFSETFROM:+0100",
        "TZOFFSETTO:+0200",
        "RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=3",
        "END:DAYLIGHT",
        "END:VTIMEZONE",
        "BEGIN:VEVENT",
        "UID:outlook",
        "DTSTART;TZID=Romance Standard Time:20270401T140000",
        "DTEND;TZID=Romance Standard Time:20270401T153000",
        "END:VEVENT",
      ),
      WINDOW,
    );
    expect(iso(ranges)).toEqual([["2027-04-01T12:00:00.000Z", "2027-04-01T13:30:00.000Z"]]);
  });

  it("une heure sans fuseau décrit est lue à Paris, jamais dans le fuseau du serveur", () => {
    const ranges = parseBusyRanges(calendar("BEGIN:VEVENT", "UID:f", "DTSTART:20270310T140000", "DTEND:20270310T150000", "END:VEVENT"), WINDOW);
    expect(iso(ranges)).toEqual([["2027-03-10T13:00:00.000Z", "2027-03-10T14:00:00.000Z"]]);
  });

  it("ne garde que la fenêtre demandée et réunit les plages qui se chevauchent", () => {
    const ranges = parseBusyRanges(
      calendar(
        "BEGIN:VEVENT", "UID:old", "DTSTART:20260101T090000Z", "DTEND:20260101T100000Z", "END:VEVENT",
        "BEGIN:VEVENT", "UID:a", "DTSTART:20270302T090000Z", "DTEND:20270302T100000Z", "END:VEVENT",
        "BEGIN:VEVENT", "UID:b", "DTSTART:20270302T093000Z", "DTEND:20270302T110000Z", "END:VEVENT",
        "BEGIN:VEVENT", "UID:daily", "DTSTART:20270301T120000Z", "DTEND:20270301T121500Z", "RRULE:FREQ=DAILY", "END:VEVENT",
      ),
      { ...WINDOW, to: new Date("2027-03-03T00:00:00Z") },
    );
    expect(iso(ranges)).toEqual([
      ["2027-03-01T12:00:00.000Z", "2027-03-01T12:15:00.000Z"],
      ["2027-03-02T09:00:00.000Z", "2027-03-02T11:00:00.000Z"],
      ["2027-03-02T12:00:00.000Z", "2027-03-02T12:15:00.000Z"],
    ]);
    expect(mergeRanges([])).toEqual([]);
  });

  it("un fichier illisible est une erreur de lecture, sans en reprendre le contenu", () => {
    expect(() => parseBusyRanges("<html>Connexion requise</html>", WINDOW)).toThrow(CalendarReadError);
  });
});
