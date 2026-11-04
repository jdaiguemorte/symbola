// ADR 0027 — fichier privé servi par l'app après contrôle des droits
// (document signé, devis joint, export RGPD). Le contenu ne quitte jamais le
// stockage par une URL : la route de l'app le transmet elle-même.
export type FileDownload = {
  data: Uint8Array;
  contentType: string;
  fileName: string;
};
