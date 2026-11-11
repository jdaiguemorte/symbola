// Lot 24a (SEC-20) — contrôle d'un journal technique (sortie du serveur pendant
// les parcours e2e de la CI) : échoue s'il y trouve une adresse e-mail ou un
// numéro de téléphone. N'affiche que le numéro de la ligne et la ligne masquée.
import { readFileSync } from "node:fs";
import { findPersonalData, redactPersonalData } from "../src/log-redaction";

const files = process.argv.slice(2).filter((argument) => argument !== "--");
if (files.length === 0) {
  console.error("Préciser le ou les journaux à contrôler.");
  process.exit(2);
}

let found = 0;
for (const file of files) {
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, index) => {
      if (findPersonalData(line).length === 0) return;
      found += 1;
      console.error(`${file}:${index + 1}  ${redactPersonalData(line).slice(0, 300)}`);
    });
}

if (found > 0) {
  console.error(`\nSEC-20 : ${found} ligne(s) de journal contiennent une adresse e-mail ou un numéro de téléphone. Journaliser des identifiants.`);
  process.exit(1);
}
console.log(`Journaux sans adresse e-mail ni numéro de téléphone (${files.length} fichier(s)).`);
