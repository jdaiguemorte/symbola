// HUB-02 — nom du cookie qui retient la durée affichée de l'agenda (3, 6
// ou 12 mois). Fichier sans « use client » : le composant serveur qui lit le
// cookie et le composant client qui l'écrit importent la même chaîne.
export const AGENDA_SPAN_COOKIE = "symbola_agenda_mois";
