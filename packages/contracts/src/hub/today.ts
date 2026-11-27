// Lot 72a (HUB-08, UX-01, UX-13 ; décisions A1, A2, A4, M15 de la note 09 du lot 68) — ce que l'accueil
// « Aujourd'hui » lit des règles : un point est une ligne ; le compte du haut est la somme des lignes ;
// chaque partie de la carte dit combien elle en montre sur combien. Constantes d'affichage (choix d'écran,
// pas données métier : note du § 7 de la spécification du lot 72).

// EVT-02 : « échéances des quatorze jours » ; HUB-08.
export const TODAY_HORIZON_DAYS = 14;
// M15 : « À traiter en premier » tient en sept lignes au plus ; le reste s'ouvre par « Tout afficher ».
export const HOME_FIRST_COUNT = 7;

// UX-13 (J7) : qui appeler quand la ligne attend les mariés (le premier client) ou un prestataire (sa
// fiche). Lu à l'affichage depuis des champs déjà déclarés au registre ; jamais journalisé.
export type TodayContact = { name: string; phone: string | null; email: string | null };

// A1 : « 7 points à traiter d'ici 14 jours, dont 2 en retard ».
export type TodayCount = { points: number; late: number };
