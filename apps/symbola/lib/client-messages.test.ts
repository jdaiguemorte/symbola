// NFR-02 (lot 65) : les espaces de textes retirés du navigateur ne servent à aucun composant client.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import frMessages from "@symbola/i18n/messages/fr.json";
import { SERVER_ONLY_NAMESPACES, clientMessages } from "./client-messages";

const ROOT = join(__dirname, "..");
const SKIP = new Set(["node_modules", ".next", "e2e", "test-results", "playwright-report"]);

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (SKIP.has(name)) return [];
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("NFR-02 — Le navigateur ne reçoit que les textes de ses composants", () => {
  it("aucun useTranslations ne lit un espace réservé au serveur ; aucun espace dynamique hors de ceux connus", () => {
    const used = new Map<string, string>();
    const dynamic: string[] = [];
    for (const file of [...sources(join(ROOT, "app")), ...sources(join(ROOT, "lib")), ...sources(join(ROOT, "modules")), ...sources(join(ROOT, "..", "..", "packages", "ui", "src"))]) {
      for (const match of readFileSync(file, "utf8").matchAll(/useTranslations\(([^)]*)\)/g)) {
        const literal = /^\s*["'`]([^"'`.]+)/.exec(match[1] ?? "");
        if (literal) used.set(literal[1]!, file);
        else if (!file.endsWith("link-request-form.tsx")) dynamic.push(file);
      }
    }
    expect(SERVER_ONLY_NAMESPACES.filter((namespace) => used.has(namespace))).toEqual([]);
    expect(dynamic).toEqual([]);
  });

  it("les espaces réservés au serveur existent et sont retirés ; les autres restent", () => {
    for (const namespace of SERVER_ONLY_NAMESPACES) expect(frMessages).toHaveProperty(namespace);
    const sent = clientMessages(frMessages);
    for (const namespace of SERVER_ONLY_NAMESPACES) expect(sent).not.toHaveProperty(namespace);
    expect(sent).toHaveProperty("Events");
    expect(sent).toHaveProperty("Login");
  });
});
