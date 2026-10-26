// Noms de colonnes qui déclenchent le contrôle du registre (SOC-07), tirés
// littéralement de la liste de l'acceptation : email, phone, first_name,
// last_name, address… Liste volontairement limitée (pas de "name" seul,
// qui donnerait de faux positifs sur des noms d'organisation).
const SUSPICIOUS_PATTERNS = [
  /^email$/i,
  /^phone$/i,
  /^telephone$/i,
  /^first_?name$/i,
  /^last_?name$/i,
  /^address$/i,
  /^adresse$/i,
  /^prenom$/i,
  /^nom$/i,
  /^birth_?date$/i,
  /^date_naissance$/i,
];

export function isSuspiciousPersonalField(fieldName: string): boolean {
  return SUSPICIOUS_PATTERNS.some((pattern) => pattern.test(fieldName));
}
