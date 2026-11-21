// Lot 63e (PRE-01, HUB-20 ; ADR 0105) — reprise des types combinés (« Photographe et vidéaste »,
// « Coiffure et maquillage »…), après les migrations 0198 et 0199 :
//   pnpm --filter @symbola/app vendors:split-types [-- --out <fichier>]   rapport, rien n'est écrit ;
//   pnpm --filter @symbola/app vendors:split-types -- --appliquer [--out <fichier>]   application.
// Organisation par organisation : chaque type combiné, le nombre de fiches qui le portent, le métier
// dans lequel il est fusionné (ou qu'il devient), les métiers ajoutés (trouvés ou créés). Rejouable :
// une fois repris, un type n'est plus combiné. Le rapport ne cite aucune fiche ni aucune donnée
// personnelle : des libellés de métiers et des nombres (SEC-20).
import { writeFileSync } from "node:fs";
import { appDatabase, closeAppDatabase } from "@symbola/db/client";
import { listOrganizations } from "@/modules/hub/service";
import { previewVendorTypeSplit, splitCombinedVendorTypes, type VendorTypeSplitStep } from "@/modules/vendors/service";
import { organizesWeddings, vendorCatalogInput } from "@/lib/vendors/catalog";

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function describeStep(step: VendorTypeSplitStep): string {
  const first = step.first.action === "merge" ? `fusionné dans « ${step.first.into.label} »` : `renommé « ${step.first.to} »`;
  const others = step.others.map((part) => (part.existing ? `« ${part.label} »` : `« ${part.label} » (créé)`)).join(", ");
  return `- « ${step.label} » — ${step.vendorCount} fiche(s) : ${first} ; ajoute ${others}`;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((argument) => argument !== "--");
  const apply = args.includes("--appliquer");
  const out = option(args, "--out");
  const lines: string[] = [apply ? "# Reprise des types combinés : application" : "# Reprise des types combinés : rapport (rien n'est écrit)", ""];
  let steps = 0;
  let vendors = 0;
  for (const organization of await listOrganizations(appDatabase())) {
    const locale = organization.language === "en" ? "en" : "fr";
    const catalog = vendorCatalogInput(locale, { weddings: await organizesWeddings(organization.id) });
    const plan = await previewVendorTypeSplit(organization.id, catalog, locale);
    lines.push(`## ${organization.name} (${organization.id})`, "");
    if (plan.length === 0) {
      lines.push("Aucun type combiné.", "");
      continue;
    }
    for (const step of plan) lines.push(describeStep(step));
    steps += plan.length;
    vendors += plan.reduce((sum, step) => sum + step.vendorCount, 0);
    if (apply) {
      const result = await splitCombinedVendorTypes(organization.id, catalog, locale);
      lines.push("", `Appliqué : ${result.length} type(s) repris, ${result.reduce((sum, entry) => sum + entry.vendors, 0)} fiche(s) ; métiers créés : ${result.flatMap((entry) => entry.createdTypes).join(", ") || "aucun"}.`);
    }
    lines.push("");
  }
  lines.push(`Total : ${steps} type(s) combiné(s), ${vendors} fiche(s).`);
  const text = `${lines.join("\n")}\n`;
  if (out) writeFileSync(out, text, { mode: 0o600 });
  console.log(text);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? `Erreur : ${error.message}` : error);
    process.exitCode = 1;
  })
  .finally(() => closeAppDatabase());
