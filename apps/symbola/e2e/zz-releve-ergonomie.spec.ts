// Outil de relevé (lot 62), hors suite : ne se lance qu'avec RELEVE_DIR. Visite chaque écran de l'équipe
// trouvé en suivant les liens depuis l'accueil (une adresse par route, un onglet par fiche), le mesure
// en 1440 et en 375 px et le capture. Aucun envoi de formulaire : des lectures seulement.
// Lot 68 (audit UX des parcours) : la grille de détail s'ajoute aux mesures (zones d'action, libellés sur
// deux lignes, troncatures, affordance, libellés des commandes, cibles de 44 px, écran vide, aide), avec
// une capture de la première hauteur d'écran. Réglages : RELEVE_ORIGIN (app servie ailleurs que sur le
// port 3000), RELEVE_SESSION (jeton d'une session déjà ouverte, quand le fournisseur d'identité ne
// connaît pas ce port), RELEVE_SCOPE (motif des adresses à garder), RELEVE_START (adresses de départ,
// séparées par des virgules), RELEVE_ZOOM=1 (troisième taille : 1 366 px à 150 %, soit 911 × 512).
import { mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

const OUT = process.env.RELEVE_DIR ?? "";
const EMAIL = process.env.RELEVE_EMAIL ?? "camille.roussel@exemple.test";
const ORIGIN = process.env.RELEVE_ORIGIN ?? "http://localhost:3000";
const SESSION = process.env.RELEVE_SESSION ?? "";
const SCOPE = process.env.RELEVE_SCOPE ? new RegExp(process.env.RELEVE_SCOPE) : null;
const START = (process.env.RELEVE_START ?? "/").split(",").map((item) => item.trim()).filter(Boolean);
const ZOOM = process.env.RELEVE_ZOOM === "1";
// Les paramètres d'adresse qui ouvrent un autre état du même écran (panneau, vue) : chacun est relevé.
const STATE_PARAMS = ["nouveau", "modifier", "tache", "fiche", "vue", "importer", "reprendre"];
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
    // ——— Lot 68 : grille de détail ———
    const fold = window.innerHeight;
    const textOf = (element: Element) => (element.textContent ?? "").replace(/\s+/g, " ").trim();
    const transparent = (color: string) => color === "transparent" || /rgba\([^)]*,\s*0\)$/.test(color);
    // Un lien qui a la forme d'un bouton : un fond ou un bord, et la hauteur d'une commande.
    const buttonLike = (element: Element) => {
      const style = getComputedStyle(element);
      const rect = box(element);
      return rect.height >= 28 && /flex|inline-block|block/.test(style.display) && (!transparent(style.backgroundColor) || parseFloat(style.borderTopWidth) > 0);
    };
    // Un même nœud de texte posé sur deux lignes ou plus : le libellé est passé à la ligne.
    const wraps = (element: Element) => {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!(node.textContent ?? "").trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        const tops: number[] = [];
        for (const rect of range.getClientRects()) {
          if (rect.width < 1 || rect.height < 1) continue;
          if (!tops.some((top) => Math.abs(top - rect.top) < rect.height * 0.6)) tops.push(rect.top);
        }
        if (tops.length > 1) return true;
      }
      return false;
    };
    const interactiveSelector = 'a[href], button, input, select, textarea, summary, label, [role="button"], [role="tab"], [role="link"], [role="checkbox"], [role="switch"], [role="menuitem"]';
    const badgeLike = (element: Element) => /badge|pill|chip|tag|status|pastille|etiquette|label-/i.test(element.getAttribute("class") ?? "");
    const wrapKinds: [string, Element[]][] = [
      ["bouton", all('button, [type="submit"], [role="button"]').concat(all("a[href]").filter(buttonLike))],
      ["onglet", all('[role="tab"], nav a')],
      ["colonne", all("thead th")],
      // Le titre d'une ligne de liste ou de tableau : sa lecture naturelle tient sur une ligne.
      ["ligne", all('tbody th, tbody td a, li > a, [role="row"] a').filter((element) => textOf(element).length <= 90)],
      ["champ", all("label").filter((label) => !label.querySelector('input[type="checkbox"], input[type="radio"]'))],
      ["pastille", all("span, strong, em, small, li, div").filter((element) => badgeLike(element) && element.children.length <= 1 && textOf(element).length <= 40)],
      ["menu", [...document.querySelectorAll("nav a")].filter((link) => !main.contains(link) && visible(link))],
    ];
    const wrapped: { kind: string; text: string }[] = [];
    for (const [kind, elements] of wrapKinds) {
      for (const element of new Set(elements)) {
        const text = textOf(element);
        if (text && wraps(element) && !wrapped.some((item) => item.text === text.slice(0, 60))) wrapped.push({ kind, text: text.slice(0, 60) });
      }
    }
    const truncated = all("*").filter((element) => {
      const style = getComputedStyle(element);
      const html = element as HTMLElement;
      const clamp = style.getPropertyValue("-webkit-line-clamp");
      return (
        (style.textOverflow === "ellipsis" && html.scrollWidth > html.clientWidth + 1) ||
        (clamp !== "" && clamp !== "none" && html.scrollHeight > html.clientHeight + 1)
      );
    });
    // Affordance : liens sans signe (ni soulignés, ni d'une autre couleur que le texte autour, ni en
    // forme de bouton) ; éléments au curseur « main » qui ne sont ni lien ni bouton ; éléments inertes
    // qui ont le fond, le bord et l'arrondi d'un vrai bouton de l'écran.
    const plainLinks = all("a[href]").filter((link) => {
      if (link.closest("nav") || buttonLike(link) || !textOf(link)) return false;
      const style = getComputedStyle(link);
      const around = link.parentElement ? getComputedStyle(link.parentElement).color : "";
      return !style.textDecorationLine.includes("underline") && style.color === around;
    });
    const pointerOnly = all("*").filter((element) => {
      if (element.matches(interactiveSelector) || element.closest(interactiveSelector)) return false;
      if (getComputedStyle(element).cursor !== "pointer") return false;
      return !element.parentElement || getComputedStyle(element.parentElement).cursor !== "pointer";
    });
    const signature = (element: Element) => {
      const style = getComputedStyle(element);
      return `${style.backgroundColor}|${style.borderTopColor}|${style.borderTopWidth}|${style.borderTopLeftRadius}`;
    };
    const realButtons = new Set(all('button, [type="submit"]').map(signature));
    const fakeButtons = all("span, div, p, strong").filter((element) => {
      if (element.matches(interactiveSelector) || element.closest(interactiveSelector) || element.querySelector(interactiveSelector)) return false;
      const rect = box(element);
      const text = textOf(element);
      return rect.height >= 24 && rect.height <= 52 && text.length > 0 && text.length <= 30 && realButtons.has(signature(element));
    });
    // Zones d'action de la première hauteur d'écran : les actions de ligne d'une même liste font une
    // zone, un formulaire fait une zone, une barre (onglets, navigation, outils) fait une zone ; les
    // commandes restantes sont regroupées par voisinage (même ligne, moins de 80 px d'écart).
    const controls = all('button, [type="submit"], select, input:not([type="hidden"]), textarea, summary, [role="tab"], [role="button"], a[href]').filter((element) => {
      const rect = box(element);
      if (rect.top >= fold || rect.bottom <= 0) return false;
      if (element.tagName !== "A") return true;
      return buttonLike(element) || element.closest('nav, [role="tablist"], [role="toolbar"]') !== null;
    });
    const zoneOf = new Map<Element | string, Element[]>();
    const loose: Element[] = [];
    for (const control of controls) {
      const row = control.closest('tr, li, [role="row"]');
      const list = row?.closest('table, ul, ol, [role="table"], [role="list"]');
      const bar = control.closest('nav, [role="tablist"], [role="toolbar"]');
      const form = control.closest("form");
      const formIsZone = form !== null && form.querySelectorAll('input:not([type="hidden"]), select, textarea').length >= 2;
      const anchor: Element | null = row && list && main.contains(list) ? list : bar && main.contains(bar) ? bar : formIsZone ? form : null;
      if (!anchor) loose.push(control);
      else zoneOf.set(anchor, [...(zoneOf.get(anchor) ?? []), control]);
    }
    const clusters: Element[][] = [];
    for (const control of loose.sort((a, b) => box(a).top - box(b).top || box(a).left - box(b).left)) {
      const rect = box(control);
      const near = clusters.find((cluster) =>
        cluster.some((other) => {
          const otherRect = box(other);
          const sameLine = Math.abs(rect.top + rect.height / 2 - (otherRect.top + otherRect.height / 2)) < 28;
          const gap = Math.max(rect.left - otherRect.right, otherRect.left - rect.right);
          return sameLine && gap < 80;
        }),
      );
      if (near) near.push(control);
      else clusters.push([control]);
    }
    const labelOf = (element: Element) => (textOf(element) || element.getAttribute("aria-label") || element.getAttribute("placeholder") || element.getAttribute("name") || element.tagName.toLowerCase()).slice(0, 28);
    const zones = [
      ...[...zoneOf.entries()].map(([anchor, members]) => ({
        kind: typeof anchor === "string" ? "?" : anchor.matches("form") ? "formulaire" : anchor.matches('nav, [role="tablist"], [role="toolbar"]') ? "barre" : "liste",
        top: Math.round(Math.min(...members.map((member) => box(member).top))),
        count: members.length,
        labels: [...new Set(members.map(labelOf))].slice(0, 4),
      })),
      ...clusters.map((members) => ({ kind: "groupe", top: Math.round(Math.min(...members.map((member) => box(member).top))), count: members.length, labels: [...new Set(members.map(labelOf))].slice(0, 4) })),
    ].sort((a, b) => a.top - b.top);
    const commandLabels = [...new Set(all('button, [type="submit"], [role="button"]').concat(all("a[href]").filter(buttonLike)).map((element) => textOf(element) || element.getAttribute("aria-label") || "").filter((label) => label && label.length <= 40))].slice(0, 80);
    const emptyStates = all(".empty-state");
    const helpButton = document.querySelector(".help-button");
    const firstPrimary = primary[0] ? box(primary[0]) : null;
    const grid = {
      zones: zones.length,
      zoneList: zones.slice(0, 12),
      controlsInFold: controls.length,
      wrapped: wrapped.length,
      wrappedList: wrapped.slice(0, 15),
      wrappedByKind: Object.fromEntries(["bouton", "onglet", "colonne", "ligne", "champ", "pastille", "menu"].map((kind) => [kind, wrapped.filter((item) => item.kind === kind).length])),
      truncated: truncated.length,
      truncatedNoTitle: truncated.filter((element) => !element.getAttribute("title") && !element.closest("[title]")).length,
      truncatedList: [...new Set(truncated.map((element) => textOf(element).slice(0, 50)))].slice(0, 8),
      plainLinks: plainLinks.length,
      plainLinkList: [...new Set(plainLinks.map((link) => textOf(link).slice(0, 40)))].slice(0, 8),
      pointerOnly: pointerOnly.length,
      pointerOnlyList: [...new Set(pointerOnly.map((element) => `${element.tagName.toLowerCase()}.${(element.getAttribute("class") ?? "").split(" ")[0]} ${textOf(element).slice(0, 30)}`))].slice(0, 6),
      fakeButtons: fakeButtons.length,
      fakeButtonList: [...new Set(fakeButtons.map((element) => textOf(element)))].slice(0, 8),
      commandLabels,
      primaryInFold: primary.filter((element) => box(element).top < fold).length,
      primaryTop: firstPrimary ? Math.round((firstPrimary.top / fold) * 100) / 100 : null,
      smallTargets44: all("button, select, summary, input:not([type='hidden']), a[href]").filter((element) => {
        const rect = box(element);
        const type = element.getAttribute("type");
        if (type === "checkbox" || type === "radio") return false;
        if (element.tagName === "A" && !buttonLike(element)) return false;
        return rect.height < 44 || rect.width < 44;
      }).length,
      emptyStates: emptyStates.length,
      emptyWithAction: emptyStates.filter((state) => state.querySelector("a[href], button") !== null).length,
      help: !helpButton ? "absente" : helpButton.tagName === "A" ? "centre d'aide" : "aide de l'écran",
    };
    return {
      grid,
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
  if (SESSION) {
    // Session déjà ouverte en base (app servie sur un autre port que celui du fournisseur d'identité).
    await page.context().addCookies([
      { name: "symbola_session", value: SESSION, url: ORIGIN, httpOnly: true, sameSite: "Lax" },
      { name: "symbola_visites_auto", value: "0", url: ORIGIN },
    ]);
  } else {
    await signIn(page, EMAIL, /\/$/);
  }

  const queue: string[] = [...START];
  const seen = new Set<string>();
  const results: { key: string; url: string; desktop: Metrics; mobile: Metrics; zoom?: Metrics }[] = [];
  const keyOf = (url: URL): string | null => {
    if (EXCLUDED.test(url.pathname) || /\/(export|pdf|nouveau|new)$/.test(url.pathname) && url.pathname.split("/").length > 3) return null;
    if (/\/prestataires\/export$/.test(url.pathname)) return null;
    const found = patterns.find((pattern) => pattern.test.test(url.pathname));
    if (!found) return null;
    if (SCOPE && !SCOPE.test(url.pathname)) return null;
    // Une fiche d'évènement a ses onglets : chacun est un écran.
    const tab = found.route === "/events/[id]" || found.route === "/budget/[eventId]" || found.route === "/prestataires/[id]" ? url.searchParams.get("onglet") : null;
    // Un panneau ouvert se relève une fois par écran, quelle que soit la vue derrière lui.
    const panel = STATE_PARAMS.find((name) => name !== "vue" && url.searchParams.has(name));
    const state = panel ?? (url.searchParams.has("vue") ? `vue=${url.searchParams.get("vue")}` : null);
    const base = tab ? `${found.route}?onglet=${tab}` : found.route;
    return state ? `${base}${tab ? "&" : "?"}${state}` : base;
  };
  for (const start of START) seen.add(keyOf(new URL(start, ORIGIN)) ?? start);
  // Les écrans à adresse fixe sont visités même si aucun lien n'y mène depuis les écrans relevés.
  for (const pattern of patterns) {
    if (pattern.route !== "/" && !pattern.route.includes("[") && (!SCOPE || SCOPE.test(pattern.route)) && !seen.has(pattern.route)) {
      seen.add(pattern.route);
      queue.push(pattern.route);
    }
  }
  while (queue.length > 0) {
    const target = queue.shift()!;
    const key = keyOf(new URL(target, ORIGIN)) ?? target;
    try {
      await page.setViewportSize({ width: 1440, height: 900 });
      const response = await page.goto(new URL(target, ORIGIN).href, { waitUntil: "networkidle", timeout: 30_000 });
      if (!response || response.status() >= 400) {
        results.push({ key, url: target, desktop: { status: response?.status() ?? 0 }, mobile: {} });
        continue;
      }
      // Arrivée ailleurs (redirection) : l'écran d'arrivée est relevé sous sa propre route.
      const landed = keyOf(new URL(page.url()));
      if (landed !== key && landed !== null && seen.has(landed)) continue;
      const name = (landed ?? key).replace(/^\//, "").replace(/[/?=&[\]]+/g, "_") || "accueil";
      const desktop = await measure(page);
      await page.screenshot({ path: join(OUT, "shots", `${name}--1440-haut.jpg`), type: "jpeg", quality: 60 });
      await page.screenshot({ path: join(OUT, "shots", `${name}--1440.jpg`), fullPage: true, type: "jpeg", quality: 55 });
      const links = await page.evaluate(() => [...document.querySelectorAll("a[href]")].map((anchor) => (anchor as HTMLAnchorElement).href));
      await page.setViewportSize({ width: 375, height: 812 });
      await page.waitForTimeout(250);
      const mobile = await measure(page);
      await page.screenshot({ path: join(OUT, "shots", `${name}--375-haut.jpg`), type: "jpeg", quality: 60 });
      await page.screenshot({ path: join(OUT, "shots", `${name}--375.jpg`), fullPage: true, type: "jpeg", quality: 55 });
      let zoom: Metrics | undefined;
      if (ZOOM) {
        await page.setViewportSize({ width: 911, height: 512 });
        await page.waitForTimeout(250);
        zoom = await measure(page);
        await page.screenshot({ path: join(OUT, "shots", `${name}--zoom150-haut.jpg`), type: "jpeg", quality: 60 });
      }
      results.push({ key: landed ?? key, url: target, desktop, mobile, ...(zoom ? { zoom } : {}) });
      if (landed) seen.add(landed);
      for (const href of links) {
        const url = new URL(href);
        if (url.origin !== ORIGIN) continue;
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
