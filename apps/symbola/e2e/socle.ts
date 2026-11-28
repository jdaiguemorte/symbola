// Lot 76 (ARC-20, SEC-36 ; ADR 0124) — le socle des parcours : une vingtaine de parcours essentiels,
// choisis dans l'existant, rejoués sur chaque pull request (voie rapide de la CI), en taille ordinateur
// et en 375 px, avec les fichiers de parcours que la PR modifie ou ajoute. La suite complète tourne
// sur main après chaque fusion, la nuit et à la demande.
//
// Le socle est tenu ici, et non par une étiquette `@socle` dans chaque fichier : une étiquette
// modifierait une vingtaine de fichiers de parcours (que d'autres branches touchent), et chacun
// deviendrait alors « modifié » aux yeux de la voie rapide. Chaque entrée nomme un fichier et le
// début exact du titre d'un parcours ; `lib/parcours-socle.test.ts` vérifie que le titre existe
// toujours dans son fichier, et la CI que le socle sélectionne exactement un parcours par entrée.
//
// Choix (durées mesurées sur main, 28/11/2026, 6c8f2b5c) : environ 2 min en ordinateur et 1 min 40
// en 375 px. Un parcours du socle est court, indépendant (aucun mode « serial ») et couvre un des
// gestes que la planner fait chaque semaine.

export type SocleEntry = { fichier: string; titre: string; pourquoi: string };

export const SOCLE: SocleEntry[] = [
  // Connexion (SEC-07, HUB-01)
  { fichier: "sec-01-07-connexion.spec.ts", titre: "HUB-01, SEC-07 — inscription par la seule adresse", pourquoi: "inscription et connexion par lien" },
  { fichier: "sec-01-07-connexion.spec.ts", titre: "SEC-07 — la page de connexion", pourquoi: "page de connexion" },
  // Accueil (HUB-08)
  { fichier: "lot-72b-aujourdhui.spec.ts", titre: "critère 2 — espace rempli", pourquoi: "écran « Aujourd'hui »" },
  { fichier: "hub-08-sc-03-lundi-matin.spec.ts", titre: "SC-03 / HUB-08 / UX-01 / UX-06 / EVT-02 — lundi matin", pourquoi: "scénario SC-03, le lundi matin" },
  // Création d'un évènement (EVT-05, HUB-07)
  { fichier: "prd-evt-01-02-07.spec.ts", titre: "PRD-EVT-01/02 / EVT-05 — un prospect apparaît", pourquoi: "évènement créé, confirmé, annulé" },
  { fichier: "hub-07-creation-rapide.spec.ts", titre: "HUB-07 / UX-03 / CRM-04 — créer un prospect", pourquoi: "création rapide depuis n'importe quel écran" },
  // Tâches (CHR-02, CHR-03)
  { fichier: "lot-70d-ecran-taches.spec.ts", titre: "CHR-03 crit. 1 — « Nouvelle tâche »", pourquoi: "écran « Tâches »" },
  { fichier: "chr-02-03-hub-08-lot-63d-taches.spec.ts", titre: "CHR-02, UX-07 — tâches : « Fait » annulable", pourquoi: "cocher, annuler, actions groupées" },
  // Budget (BUD-01)
  { fichier: "bud-01-02-cinq-montants.spec.ts", titre: "BUD-01 — une ligne complète", pourquoi: "ligne de budget" },
  // Devis et facture (DEV-01, DEV-04)
  { fichier: "dev-01-devis.spec.ts", titre: "DEV-01 — composer un devis", pourquoi: "devis composé, envoyé, téléchargé" },
  { fichier: "dev-04-factures.spec.ts", titre: "DEV-04 — facturer un devis signé", pourquoi: "facture, avoir, e-reporting" },
  // Prestataires (PRE)
  { fichier: "lot-11-prestataires.spec.ts", titre: "L11-PRE-01 à L11-PRE-07 / L11-HUB-12 — créer ses fiches", pourquoi: "carnet de prestataires" },
  // Import (HUB-14)
  { fichier: "hub-14-lot-63b-import.spec.ts", titre: "HUB-14 — import de prestataires", pourquoi: "import d'un fichier" },
  // Jour J (JRJ-01, JRJ-03)
  { fichier: "jrj-01-03-mode-jour-j.spec.ts", titre: "JRJ-01 / JRJ-03 / SC-08 étapes 1 et 2", pourquoi: "mode jour J" },
  // Liens des tiers (UX-11, POR)
  { fichier: "por-02-05-portail-client.spec.ts", titre: "POR-02 / POR-05 — l'accueil du portail", pourquoi: "lien et portail des mariés" },
  { fichier: "por-01-lien-prestataire.spec.ts", titre: "UX-11 / POR-01 — lien d'un prestataire retenu", pourquoi: "lien d'un prestataire avec code" },
  // Contrôles d'accès (SEC-12, SEC-13, SEC-36)
  { fichier: "sec-36-suite-abus.spec.ts", titre: "SC-S1 — un identifiant d'une autre organisation", pourquoi: "accès croisé entre organisations" },
  { fichier: "sec-36-suite-abus.spec.ts", titre: "SC-S3 — avec le lien d'un prestataire", pourquoi: "portée du lien d'un prestataire" },
  { fichier: "sec-36-suite-abus.spec.ts", titre: "SC-S4 — un lien de marié expiré", pourquoi: "lien expiré ou d'un autre évènement" },
  { fichier: "hub-admin.spec.ts", titre: "PRD-HUB-03-02 — un utilisateur non-Admin", pourquoi: "l'exploitation fermée aux autres rôles" },
];

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Playwright compare `--grep` à « projet fichier description titre étiquettes » : le fichier, puis le
// début du titre du parcours (précédé d'une espace : celui d'une description ou du parcours).
export const SOCLE_GREP: RegExp[] = SOCLE.map((entry) => new RegExp(`${escapeRegExp(entry.fichier)} (.* )?${escapeRegExp(entry.titre)}`));

// Voie rapide : les fichiers de parcours modifiés ou ajoutés par la PR, chacun en entier.
export function fileGrep(files: string[]): RegExp[] {
  return files.map((file) => new RegExp(`(^|[ /])${escapeRegExp(file)} `));
}
