import { describe, expect, it } from "vitest";
import { buildIcs, escapeIcsText, foldIcsLine, wallTimeToInstant } from "./ics";

const NOW = new Date("2027-03-01T08:00:00Z");

describe("HUB-29 — Flux ICS par utilisateur et par évènement (lot 38b, RFC 5545)", () => {
  it("le texte est échappé : barre oblique inverse, point-virgule, virgule et retour à la ligne", () => {
    expect(escapeIcsText("Dîner; vin, fromage\\dessert\nsoirée")).toBe("Dîner\\; vin\\, fromage\\\\dessert\\nsoirée");
  });

  it("une ligne de plus de 75 octets est pliée, sans couper un caractère accentué ; les suites commencent par une espace", () => {
    const line = `SUMMARY:${"é".repeat(60)}`;
    const folded = foldIcsLine(line).split("\r\n");
    expect(folded.length).toBeGreaterThan(1);
    for (const part of folded) expect(Buffer.byteLength(part, "utf8")).toBeLessThanOrEqual(75);
    for (const part of folded.slice(1)) expect(part.startsWith(" ")).toBe(true);
    expect(folded.map((part, index) => (index === 0 ? part : part.slice(1))).join("")).toBe(line);
  });

  it("un évènement daté est une journée entière ; chaque ligne finit par CRLF", () => {
    const ics = buildIcs({ name: "Atelier", now: NOW, events: [{ uid: "e1@symbola", summary: "Mariage — Léa & Maxime", start: { date: "2027-06-12" }, url: "https://symbola.test/events/e1" }] });
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART;VALUE=DATE:20270612\r\n");
    expect(ics).toContain("DTEND;VALUE=DATE:20270613\r\n");
    expect(ics).toContain("SUMMARY:Mariage — Léa & Maxime\r\n");
    expect(ics).toContain("DTSTAMP:20270301T080000Z\r\n");
    expect(ics.split("\r\n").filter(Boolean).every((line) => !line.includes("\n"))).toBe(true);
  });

  it("les heures du programme sont celles du fuseau de l'évènement, passage à l'heure d'été compris", () => {
    expect(wallTimeToInstant("2027-03-27", "14:00", "Europe/Paris").toISOString()).toBe("2027-03-27T13:00:00.000Z");
    expect(wallTimeToInstant("2027-03-28", "14:00", "Europe/Paris").toISOString()).toBe("2027-03-28T12:00:00.000Z");
    expect(wallTimeToInstant("2027-06-12", "15:30", "Europe/Paris").toISOString()).toBe("2027-06-12T13:30:00.000Z");
    expect(wallTimeToInstant("2027-06-12", "15:30", "America/Martinique").toISOString()).toBe("2027-06-12T19:30:00.000Z");
    const ics = buildIcs({ name: "Programme", now: NOW, events: [{ uid: "p1@symbola", summary: "Cérémonie", start: { dateTime: wallTimeToInstant("2027-06-12", "15:30", "Europe/Paris") }, end: { dateTime: wallTimeToInstant("2027-06-12", "16:15", "Europe/Paris") }, location: "Jardin, Domaine des Tilleuls" }] });
    expect(ics).toContain("DTSTART:20270612T133000Z\r\n");
    expect(ics).toContain("DTEND:20270612T141500Z\r\n");
    expect(ics).toContain("LOCATION:Jardin\\, Domaine des Tilleuls\r\n");
  });
});

describe("HUB-29 — Plages occupées : « occupé » ou provisoire dans l'agenda (lot 64, ADR 0108)", () => {
  const now = new Date("2026-11-21T10:00:00Z");
  const range = { start: { dateTime: new Date("2027-06-12T06:00:00Z") }, end: { dateTime: new Date("2027-06-12T20:00:00Z") } };

  it("une plage qui bloque porte TRANSP:OPAQUE, en heures UTC", () => {
    const ics = buildIcs({ name: "Agenda", now, events: [{ uid: "a@symbola", summary: "Mariage — Kévin & Kévina", ...range, status: "CONFIRMED", transparency: "OPAQUE" }] });
    expect(ics).toContain("DTSTART:20270612T060000Z\r\n");
    expect(ics).toContain("DTEND:20270612T200000Z\r\n");
    expect(ics).toContain("TRANSP:OPAQUE\r\n");
  });

  it("une option qui ne bloque pas est provisoire et libre ; sans réglage, aucune ligne TRANSP", () => {
    const ics = buildIcs({ name: "Agenda", now, events: [{ uid: "b@symbola", summary: "Option", ...range, status: "TENTATIVE", transparency: "TRANSPARENT" }, { uid: "c@symbola", summary: "Sans réglage", ...range }] });
    expect(ics).toContain("STATUS:TENTATIVE\r\nTRANSP:TRANSPARENT\r\n");
    expect(ics.match(/TRANSP:/g)).toHaveLength(1);
  });
});
