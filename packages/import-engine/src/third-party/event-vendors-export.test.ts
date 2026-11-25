// Lot 67e (HUB-14, PRE-02 ; recette du 24/11/2026, R07) — lecture du PDF « Export des Prestataires »
// d'un évènement, sur un fichier fictif de même forme que l'export réel (jamais versé au dépôt).
import { describe, expect, it } from "vitest";
import { readImportCorpusFile } from "@symbola/testing/import-corpus";
import { planningSoftwareProfile } from "@symbola/starter-templates";
import { DEFAULT_PDF_LIMITS, readPdfText } from "../pdf";
import { parseEventVendorsExport } from "./event-vendors-export";

const { eventVendorsExport: profile, eventSheet, programExport } = planningSoftwareProfile();
const context = { calendar: { weekdays: eventSheet.weekdays, months: eventSheet.months }, footerPrefix: programExport.footerPrefix, plannerRoles: programExport.plannerRoles };

async function pagesOf(name: string) {
  const read = await readPdfText(readImportCorpusFile(`logiciel-tiers/${name}`), { ...DEFAULT_PDF_LIMITS, maxPages: 30 });
  if (!read.ok) throw new Error(read.reason);
  return read.pages;
}

async function vendors() {
  const result = parseEventVendorsExport(await pagesOf("prestataires-evenement.pdf"), profile, context);
  if (!result.ok) throw new Error(result.reason);
  return result.export;
}

describe("HUB-14, PRE-02 — Prestataires retenus d'un évènement depuis le PDF de l'ancien logiciel (lecture, lot 67e)", () => {
  it("lit la date de l'évènement et ses clients dans l'en-tête", async () => {
    const { eventDate, clients } = await vendors();
    expect(eventDate).toBe("2027-06-12");
    expect(clients).toEqual(["Clémence MARTIN", "Bastien LEROY"]);
  });

  it("lit une ligne par prestataire, dans l'ordre du fichier : type et nom", async () => {
    const { rows } = await vendors();
    expect(rows.map((row) => [row.line, row.type, row.name])).toEqual([
      [1, "Baby-Sitter", "Les P'tits Loups"],
      [2, "Brunch", "Douceurs d'Ambre"],
      [3, "Coiffeur(se) - Maquilleur(se)", "Iris Beauté"],
      [4, "DJ", "Nuit Blanche Sono"],
      [5, "Décorateur", "Au Fil des Détails"],
      [6, "Fleuriste", "Pétales & Compagnie"],
      [7, "Fleuriste", "Fleurs du Clain"],
      [8, "Lieu", "Domaine des Tilleuls"],
      [9, "Photobooth", "FlashBooth"],
      [10, "Photographe", "Studio Lumière"],
      [11, "Robe de mariée", "Atelier de Margot"],
      [12, "Vidéaste", "La Boîte à Films"],
      [13, "Wedding Planner", "Belle Journée"],
    ]);
  });

  it("une cellule vide reste vide, sans décaler la ligne", async () => {
    const { rows } = await vendors();
    expect(rows.find((row) => row.name === "FlashBooth")).toMatchObject({ contact: null, email: null, phone: "06 39 98 01 08", instagram: null });
    expect(rows.find((row) => row.name === "Douceurs d'Ambre")).toMatchObject({ contact: "Ambre SOULIER", email: "douceurs@exemple.invalid", phone: null });
    expect(rows.find((row) => row.name === "La Boîte à Films")).toMatchObject({ email: null, phone: "0639980110", instagram: "@laboiteafilms" });
  });

  it("l'Instagram écrit plus petit, un point plus bas, reste sur la ligne de son prestataire", async () => {
    const { rows } = await vendors();
    expect(rows.find((row) => row.name === "Au Fil des Détails")?.instagram).toBe("@au.fildesdetails");
    expect(rows.find((row) => row.name === "Studio Lumière")?.instagram).toBe("@studio_lumiere_mariage");
  });

  it("signale la ligne de la planner elle-même, et elle seule", async () => {
    const { rows } = await vendors();
    expect(rows.filter((row) => row.planner).map((row) => row.name)).toEqual(["Belle Journée"]);
  });

  it("le pied de page (mentions légales, pagination, « Mis à jour le ») n'est jamais une ligne", async () => {
    const { rows } = await vendors();
    expect(rows).toHaveLength(13);
    expect(rows.some((row) => /Siret|Mis à jour|1\/1/.test(`${row.type} ${row.name}`))).toBe(false);
  });

  it("un autre PDF du même logiciel (le programme) n'est pas pris pour cet export", async () => {
    expect(parseEventVendorsExport(await pagesOf("programme-jour-j.pdf"), profile, context)).toEqual({ ok: false, reason: "not_event_vendors_export" });
  });
});
