// Outil de relevé (lot 62), hors suite : ne se lance qu'avec RELEVE_DIR. Visite chaque écran de l'équipe
// trouvé en suivant les liens depuis l'accueil (une adresse par route, un onglet par fiche), le mesure
// en 1440 et en 375 px et le capture. Aucun envoi de formulaire : des lectures seulement.
import { mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

const OUT = process.env.RELEVE_DIR ?? "";
const EMAIL = process.env.RELEVE_EMAIL ?? "camille.roussel@exemple.test";
const EXCLUDED = /^\/(exploitation|portail|lien|rsvp|reserver|prestataire\/|partage|comptable|signature-fictive|invitations|propriete|contact\/|rdv\/|calendrier|auth|inscription|login|hors-ligne|securite\/pas-moi|api)/;

// Les routes de l'app (dossiers qui portent un page.tsx), en motifs.
function routes(dir: string, base = ""): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) found.push(...routes(path, `${base}/${name}`));
    else if (name === "page.tsx") found.push(base === "" ? "/" : base);
  }
  return found;
}

function matcher(route: string): RegExp {
  return new RegExp(`^${route.replace(/\[[^\]]+\]/g, "[^/]+")}$`);
}

type Metrics = Record<string, unknown>;

async function measure(page: Page): Promise<Metrics> {
  return page.evaluate(() => {
    const main = (document.querySelector("main") ?? document.body) as HTMLElement;
    const box = (element: Element) => element.getBoundingClientRect();
    const visible = (element: Element) => {
      const rect = box(element);
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const all = (selector: string) => [...main.querySelectorAll(selector)].filter(visible);
    const fields = all('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]), select, textarea');
    const mainBox = box(main);
    // Champs empilés : la plus longue suite de champs qui partagent le même bord gauche, un par ligne.
    let run = 0;
    let longestRun = 0;
    let previous: DOMRect | null = null;
    for (const field of fields) {
      const rect = box(field);
      run = previous && Math.abs(rect.left - previous.left) < 3 && rect.top > previous.bottom - 2 ? run + 1 : 1;
      longestRun = Math.max(longestRun, run);
      previous = rect;
    }
    const primary = all('button, a, input[type="submit"]').filter((element) => getComputedStyle(element).backgroundColor === "rgb(15, 110, 92)");
    const submitLabels: Record<string, number> = {};
    for (const button of all('button[type="submit"], button:not([type])')) {
      const label = (button.textContent ?? "").trim().slice(0, 40);
      submitLabels[label] = (submitLabels[label] ?? 0) + 1;
    }
    const headings = all("h1, h2, h3, h4").map((heading) => Number(heading.tagName.slice(1)));
    let skipped = 0;
    for (let index = 1; index < headings.length; index += 1) if (headings[index]! - headings[index - 1]! > 1) skipped += 1;
    const columnEnd = all("form").filter((form) => {
      const style = getComputedStyle(form);
      return style.display === "flex" && style.flexDirection === "column" && style.alignItems === "flex-end";
    }).length;
    const small = all("button, select, summary, input:not([type='hidden'])").filter((element) => {
      const rect = box(element);
      const type = element.getAttribute("type");
      return type !== "checkbox" && type !== "radio" && (rect.height < 40 || rect.width < 40);
    }).length;
    const wideTables = all("table").filter((table) => {
      let parent = table.parentElement;
      while (parent && parent !== main) {
        if (/(auto|scroll)/.test(getComputedStyle(parent).overflowX)) return false;
        parent = parent.parentElement;
      }
      return box(table).width > mainBox.width + 2;
    }).length;
    return {
      h1: (document.querySelector("h1")?.textContent ?? "").trim().slice(0, 80),
      h1Count: document.querySelectorAll("h1").length,
      screens: Math.round((document.documentElement.scrollHeight / window.innerHeight) * 10) / 10,
      overflowX: document.documentElement.scrollWidth - window.innerWidth,
      mainWidth: Math.round(mainBox.width),
      fields: fields.length,
      stackedRun: longestRun,
      wideShortFields: fields.filter((field) => ["number", "date", "time"].includes(field.getAttribute("type") ?? "") && box(field).width > 260).length,
      wideFields: fields.filter((field) => box(field).width > 600 && field.tagName !== "TEXTAREA").length,
      forms: all("form").length,
      primary: primary.length,
      primaryLabels: [...new Set(primary.map((element) => (element.textContent ?? "").trim().slice(0, 30)))].slice(0, 6),
      repeatedSubmits: Object.entries(submitLabels).filter(([, count]) => count > 3),
      headingSkips: skipped,
      details: all("details").length,
      columnEndForms: columnEnd,
      smallTargets: small,
      wideTables,
      tables: all("table").length,
      longParagraphs: all("p").filter((paragraph) => box(paragraph).width > 860 && (paragraph.textContent ?? "").length > 220).length,
      textLength: (main.innerText ?? "").length,
      settingsNav: document.querySelector(".settings-nav") !== null,
      error: /Une erreur|Application error|404|introuvable/i.test(main.innerText.slice(0, 300)),
    };
  });
}

test("relevé d'ergonomie — tous les écrans de l'équipe", async ({ page }) => {
  test.skip(OUT === "", "outil de relevé : définir RELEVE_DIR");
  test.setTimeout(45 * 60_000);
  mkdirSync(join(OUT, "shots"), { recursive: true });
  const patterns = routes(join(process.cwd(), "app"))
    .filter((route) => !EXCLUDED.test(route))
    // Les routes fixes avant les fiches : « /devis/catalogue » n'est pas un devis.
    .sort((a, b) => (a.match(/\[/g)?.length ?? 0) - (b.match(/\[/g)?.length ?? 0) || b.length - a.length)
    .map((route) => ({ route, test: matcher(route) }));
  await signIn(page, EMAIL, /\/$/);

  const queue: string[] = ["/"];
  const seen = new Set<string>();
  const results: { key: string; url: string; desktop: Metrics; mobile: Metrics }[] = [];
  const keyOf = (url: URL): string | null => {
    if (EXCLUDED.test(url.pathname) || /\/(export|pdf|nouveau|new)$/.test(url.pathname) && url.pathname.split("/").length > 3) return null;
    if (/\/prestataires\/export$/.test(url.pathname)) return null;
    const found = patterns.find((pattern) => pattern.test.test(url.pathname));
    if (!found) return null;
    // Une fiche d'évènement a ses onglets : chacun est un écran.
    const tab = found.route === "/events/[id]" || found.route === "/budget/[eventId]" || found.route === "/prestataires/[id]" ? url.searchParams.get("onglet") : null;
    return tab ? `${found.route}?onglet=${tab}` : found.route;
  };
  seen.add("/");
  // Les écrans à adresse fixe sont visités même si aucun lien n'y mène depuis les écrans relevés.
  for (const pattern of patterns) {
    if (pattern.route !== "/" && !pattern.route.includes("[")) {
      seen.add(pattern.route);
      queue.push(pattern.route);
    }
  }
  while (queue.length > 0) {
    const target = queue.shift()!;
    const key = keyOf(new URL(target, "http://localhost:3000"))!;
    try {
      await page.setViewportSize({ width: 1440, height: 900 });
      const response = await page.goto(target, { waitUntil: "networkidle", timeout: 30_000 });
      if (!response || response.status() >= 400) {
        results.push({ key, url: target, desktop: { status: response?.status() ?? 0 }, mobile: {} });
        continue;
      }
      // Arrivée ailleurs (redirection) : l'écran d'arrivée est relevé sous sa propre route.
      const landed = keyOf(new URL(page.url()));
      if (landed !== key && landed !== null && seen.has(landed)) continue;
      const name = (landed ?? key).replace(/^\//, "").replace(/[/?=[\]]+/g, "_") || "accueil";
      const desktop = await measure(page);
      await page.screenshot({ path: join(OUT, "shots", `${name}--1440.jpg`), fullPage: true, type: "jpeg", quality: 55 });
      const links = await page.evaluate(() => [...document.querySelectorAll("a[href]")].map((anchor) => (anchor as HTMLAnchorElement).href));
      await page.setViewportSize({ width: 375, height: 812 });
      await page.waitForTimeout(250);
      const mobile = await measure(page);
      await page.screenshot({ path: join(OUT, "shots", `${name}--375.jpg`), fullPage: true, type: "jpeg", quality: 55 });
      results.push({ key: landed ?? key, url: target, desktop, mobile });
      if (landed) seen.add(landed);
      for (const href of links) {
        const url = new URL(href);
        if (url.origin !== "http://localhost:3000") continue;
        const linkKey = keyOf(url);
        if (!linkKey || seen.has(linkKey)) continue;
        seen.add(linkKey);
        queue.push(url.pathname + url.search);
      }
    } catch (error) {
      results.push({ key, url: target, desktop: { failed: String(error).slice(0, 160) }, mobile: {} });
    }
    writeFileSync(join(OUT, "releve.json"), JSON.stringify({ results, missing: patterns.map((pattern) => pattern.route).filter((route) => ![...seen].some((item) => item === route || item.startsWith(`${route}?`))) }, null, 1));
  }
});
