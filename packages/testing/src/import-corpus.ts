// Corpus de fichiers d'import (lot 5, PRD §7 « Robustesse ») : fichiers
// fictifs variés, produits par import-corpus/generate.py et commités.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const FILES_DIR = fileURLToPath(new URL("../import-corpus/files/", import.meta.url));

export function readImportCorpusFile(name: string): Uint8Array {
  return new Uint8Array(readFileSync(`${FILES_DIR}${name}`));
}
