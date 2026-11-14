// Lot 33 (HUB-02) — organisation choisie en dernier, retenue d'une connexion à l'autre. Le
// cookie n'ouvre rien par lui-même : signInWithIdentity ne le suit que si le compte y a une
// adhésion active, et l'organisation de la session est relue à chaque requête.
export const ORGANIZATION_COOKIE_NAME = "symbola_organisation";
export const ORGANIZATION_COOKIE_MAX_AGE_S = 365 * 24 * 60 * 60;
