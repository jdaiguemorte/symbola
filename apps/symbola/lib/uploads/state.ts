// Lot 16 (SEC-02, ADR 0044) — réponse d'une route d'envoi de fichier, lue par
// le formulaire (app/ui/use-upload.ts) comme il lisait l'état d'une action
// serveur : un message d'erreur, une réussite, ou l'adresse où continuer.
export type UploadState = { error?: string; success?: boolean; redirect?: string };
