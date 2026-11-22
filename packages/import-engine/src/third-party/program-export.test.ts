import { describe, expect, it } from "vitest";
import { readImportCorpusFile } from "@symbola/testing/import-corpus";
import { planningSoftwareProfile } from "@symbola/starter-templates";
import { DEFAULT_PDF_LIMITS, readPdfText } from "../pdf";
import { matchProgramSpeaker, parseProgramContact, parseProgramExport, parseProgramTime } from "./program-export";

const { programExport: profile, eventSheet } = planningSoftwareProfile();
const calendar = { weekdays: eventSheet.weekdays, months: eventSheet.months };

async function program(name: string) {
  const read = await readPdfText(readImportCorpusFile(`logiciel-tiers/${name}`), { ...DEFAULT_PDF_LIMITS, maxPages: profile.maxPages });
  if (!read.ok) throw new Error(read.reason);
  const result = parseProgramExport(read.pages, profile, calendar);
  if (!result.ok) throw new Error(result.reason);
  return result.program;
}

const byTitle = async (file: string, title: string) => {
  const row = (await program(file)).rows.find((candidate) => candidate.title === title);
  if (!row) throw new Error(`séquence introuvable : ${title}`);
  return row;
};

describe("CHR-08 — Programme du jour J depuis le PDF de l'ancien logiciel (lecture, lot 63b)", () => {
  it("lit le jour, le début, la fin, le titre et la description de chaque séquence, jour par jour (veille et lendemain compris)", async () => {
    const { rows, title, eventDate } = await program("programme-jour-j.pdf");
    expect(title).toBe("Mariage Clémence & Bastien");
    expect(eventDate).toBe("2027-06-12");
    expect(rows.map((row) => [row.date, row.startTime, row.title])).toEqual([
      ["2027-06-11", "12:00", "Récupérer les clés"],
      ["2027-06-11", "12:15", "Installation espace cérémonie"],
      ["2027-06-11", "19:00", "Soirée de la veille"],
      ["2027-06-12", "10:00", "Arrivée d'Iris"],
      ["2027-06-12", "11:00", "Repas à la charge des mariés"],
      ["2027-06-12", "12:00", "Habillage du marié"],
      ["2027-06-12", "14:00", "Arrivée du DJ"],
      ["2027-06-12", "15:30", "Cérémonie laïque"],
      ["2027-06-12", "21:18", "Coucher du soleil"],
      ["2027-06-12", "21:30", "Animation surprise"],
      ["2027-06-13", "00:30", "Fin de soirée"],
      ["2027-06-13", "11:00", "Brunch"],
    ]);
    expect(rows.map((row) => row.line)).toEqual(rows.map((_, index) => index + 1));
    expect((await byTitle("programme-jour-j.pdf", "Installation espace cérémonie")).description).toBe("Mettre les housses sur les chaises\nInstaller l'arche");
  });

  it("une description qui passe sur la page suivante reste à sa séquence, le pied de page est ignoré", async () => {
    const ceremony = await byTitle("programme-jour-j.pdf", "Cérémonie laïque");
    expect(ceremony.description?.startsWith("Dans le jardin\nDurée prévue : 30 minutes")).toBe(true);
    expect(ceremony.description?.endsWith("Ligne 33\nFin du déroulé")).toBe(true);
    expect(ceremony.description).toContain("Ligne 20\nLigne 21");
    expect(ceremony.endTime).toBe("16:30");
    const { rows } = await program("programme-jour-j.pdf");
    expect(JSON.stringify(rows)).not.toMatch(/Mis à jour le|exemple\.invalid/);
  });

  it("piège 1 — une fin à 00:00 est absente, 00:00 seul n'est pas une heure, une fin plus tôt que le début passe au lendemain", async () => {
    expect(await byTitle("programme-jour-j.pdf", "Repas à la charge des mariés")).toMatchObject({ startTime: "11:00", endTime: null, endsNextDay: false });
    expect(await byTitle("programme-jour-j.pdf", "Soirée de la veille")).toMatchObject({ startTime: "19:00", endTime: "02:00", endsNextDay: true });
    expect(await byTitle("programme-jour-j-court.pdf", "Récupérer les marque-places")).toMatchObject({ startTime: null, endTime: null });
    // Juste avant et juste après minuit : de vraies heures.
    expect(parseProgramTime("23:59 - 00:01", profile.noTime)).toEqual({ startTime: "23:59", endTime: "00:01", endsNextDay: true });
    expect(parseProgramTime("00:30", profile.noTime)).toEqual({ startTime: "00:30", endTime: null, endsNextDay: false });
    expect(parseProgramTime("24:00", profile.noTime)).toBeNull();
  });

  it("piège 2 — une ligne sans interlocuteur devient un repère", async () => {
    expect(await byTitle("programme-jour-j.pdf", "Coucher du soleil")).toMatchObject({ marker: true, contacts: [] });
    expect((await byTitle("programme-jour-j.pdf", "Brunch")).marker).toBe(false);
  });

  it("piège 3 — un interlocuteur sans rôle reste en texte, jamais rattaché", async () => {
    const dressing = await byTitle("programme-jour-j.pdf", "Habillage du marié");
    expect(dressing.contacts[0]).toEqual({ text: "Gaspard", role: null, name: "Gaspard", kind: "free" });
    expect(matchProgramSpeaker(dressing.contacts[0]!, (await program("programme-jour-j.pdf")).speakers)).toBeNull();
  });

  it("piège 4 — un rôle en double se départage par le nom, et la planner elle-même est ignorée", async () => {
    const { speakers, rows } = await program("programme-jour-j-court.pdf");
    expect(speakers.map((speaker) => speaker.role)).toEqual(["Traiteur", "Traiteur", "Wedding Planner", "WeddingPlanner"]);
    const oysters = rows.find((row) => row.title === "Arrivée de la barque à huîtres")!;
    expect(speakers[matchProgramSpeaker(oysters.contacts[0]!, speakers)!]?.company).toBe("La Barque Fictive");
    const starter = rows.find((row) => row.title === "Service de l'entrée")!;
    expect(speakers[matchProgramSpeaker(starter.contacts[0]!, speakers)!]?.company).toBe("Les Saveurs d'Antan");
    const untimed = rows.find((row) => row.title === "Récupérer les marque-places")!;
    expect(untimed.contacts[0]).toMatchObject({ role: "Wedding Planner", kind: "planner" });
    expect(matchProgramSpeaker(untimed.contacts[0]!, speakers)).toBeNull();
    expect(parseProgramContact("WeddingPlanner - Julie", ["WeddingPlanner"], profile).kind).toBe("planner");
    expect(parseProgramContact("Mariée - Clémence", [], profile)).toMatchObject({ role: "Mariée", name: "Clémence", kind: "client" });
  });

  it("piège 5 — le nom après le rôle se cherche dans le prénom, le nom et la raison sociale", async () => {
    const { speakers, rows } = await program("programme-jour-j.pdf");
    const dj = rows.find((row) => row.title === "Arrivée du DJ")!;
    expect(dj.contacts[0]).toMatchObject({ role: "DJ", name: "ROUSSEL", kind: "vendor" });
    expect(speakers[matchProgramSpeaker(dj.contacts[0]!, speakers)!]?.company).toBe("Ondes Sonores");
    const surprise = rows.find((row) => row.title === "Animation surprise")!;
    expect(speakers[matchProgramSpeaker(surprise.contacts[0]!, speakers)!]?.contact).toBe("Félix ROUSSEL");
    expect(matchProgramSpeaker({ text: "DJ - Ondes", role: "DJ", name: "Ondes", kind: "vendor" }, speakers)).toBe(speakers.findIndex((speaker) => speaker.role === "DJ"));
    // Un rôle qui contient lui-même le séparateur.
    const iris = rows.find((row) => row.title === "Arrivée d'Iris")!;
    expect(iris.contacts[0]).toMatchObject({ role: "Coiffeur(se) - Maquilleur(se)", name: "Iris", kind: "vendor" });
    expect(speakers[matchProgramSpeaker(iris.contacts[0]!, speakers)!]?.company).toBe("Iris Beauté");
  });

  it("piège 6 — une ligne « Caché des mariés » est repérée pour ne pas être partagée avec eux", async () => {
    expect((await byTitle("programme-jour-j.pdf", "Animation surprise")).hiddenFromClients).toBe(true);
    expect((await byTitle("programme-jour-j-court.pdf", "Animation 1")).hiddenFromClients).toBe(true);
    expect((await byTitle("programme-jour-j.pdf", "Brunch")).hiddenFromClients).toBe(false);
  });

  it("piège 7 — le résumé des invités est ignoré, quelles que soient ses colonnes ; l'en-tête donne les intervenants", async () => {
    for (const file of ["programme-jour-j.pdf", "programme-jour-j-court.pdf"]) {
      const result = await program(file);
      expect(JSON.stringify(result)).not.toMatch(/Adultes?|Enfants|Invitation|"Total"/);
    }
    const { speakers } = await program("programme-jour-j.pdf");
    expect(speakers).toHaveLength(8);
    expect(speakers[1]).toEqual({ role: "DJ", company: "Ondes Sonores", contact: "Félix ROUSSEL", phone: "06 39 98 02 03" });
    // Le tableau des intervenants continue sur la deuxième page.
    expect(speakers.at(-1)).toMatchObject({ role: "WeddingPlanner", company: "Atelier Exemple" });
  });

  it("une fiche d'évènement n'est pas un programme : refusée avec un motif", async () => {
    const read = await readPdfText(readImportCorpusFile("logiciel-tiers/fiche-evenement-complete.pdf"));
    if (!read.ok) throw new Error(read.reason);
    expect(parseProgramExport(read.pages, profile, calendar)).toEqual({ ok: false, reason: "not_program_export" });
  });
});
