// Lot 16 (ARC-01, ADR 0043) : le code de l'app emprunte la réserve de
// connexions partagée du processus. Chaque fichier de tests d'intégration la
// rend à la fin, pour ne pas accumuler de connexions ouvertes d'un fichier à
// l'autre.
import { afterAll } from "vitest";
import { closeAppDatabase } from "@symbola/db/client";

afterAll(async () => {
  await closeAppDatabase();
});
