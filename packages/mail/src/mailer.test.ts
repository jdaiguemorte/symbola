import { createECDH } from "node:crypto";
import { parseEnv } from "@symbola/env";
import { describe, expect, it } from "vitest";
import { buildTransportOptions, senderAddress } from "./mailer";
import { renderMailHtml, renderMailText, type MailLayout } from "./layout";

const vapid = createECDH("prime256v1");
vapid.setPrivateKey(Buffer.alloc(32, 3));
const VAPID = { VAPID_PUBLIC_KEY: vapid.getPublicKey().toString("base64url"), VAPID_PRIVATE_KEY: vapid.getPrivateKey().toString("base64url") };

function envWith(overrides: Record<string, string>) {
  return parseEnv({
    POSTGRES_APP_PASSWORD: "x",
    S3_ACCESS_KEY: "x",
    S3_SECRET_KEY: "x",
    MFA_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
    DATA_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString("base64"),
    // Lot 53 (ADR 0096) : paire VAPID de test (P-256, clé privée fixe).
    ...VAPID,
    LOGTO_M2M_SECRET: "secret-machine-a-machine-de-test-32c",
    ...overrides,
  });
}

describe("@symbola/mail — buildTransportOptions", () => {
  it("active la connexion chiffrée dès l'ouverture sur le port 465", () => {
    const options = buildTransportOptions(envWith({ SMTP_PORT: "465" }));
    expect(options.secure).toBe(true);
  });

  it("n'active pas la connexion chiffrée dès l'ouverture sur un autre port (ex. 587, STARTTLS)", () => {
    const options = buildTransportOptions(envWith({ SMTP_PORT: "587" }));
    expect(options.secure).toBe(false);
  });

  it("n'envoie aucune authentification quand SMTP_USER est vide (Mailpit)", () => {
    const options = buildTransportOptions(envWith({}));
    expect(options.auth).toBeUndefined();
  });

  it("Scaleway TEM sur le port 587 : STARTTLS exigé avec une authentification ; rien d'exigé pour Mailpit (lot 55)", () => {
    expect(buildTransportOptions(envWith({ SMTP_HOST: "smtp.tem.scaleway.com", SMTP_PORT: "587", SMTP_USER: "projet", SMTP_PASSWORD: "cle" })).requireTLS).toBe(true);
    expect(buildTransportOptions(envWith({ SMTP_PORT: "465", SMTP_USER: "projet", SMTP_PASSWORD: "cle" })).requireTLS).toBe(false);
    expect(buildTransportOptions(envWith({})).requireTLS).toBe(false);
  });

  it("envoie l'authentification quand SMTP_USER est renseigné", () => {
    const options = buildTransportOptions(envWith({ SMTP_USER: "alertes@symbola.fr", SMTP_PASSWORD: "secret" }));
    expect(options.auth).toEqual({ user: "alertes@symbola.fr", pass: "secret" });
  });
});

describe("MSG-01, HUB-18 (lot 38a) — mise en page d'un e-mail à l'image de l'organisation", () => {
  const layout: MailLayout = {
    lang: "fr",
    subject: "Votre espace",
    senderName: "Atelier <Camille> & Cie",
    logoCid: null,
    accent: "#7a2e4d",
    textOnAccent: "#ffffff",
    blocks: [
      { kind: "paragraph", text: "Bonjour Léa,\nvoici <votre> lien : https://symbola.test/lien#abc" },
      { kind: "button", url: "https://symbola.test/lien#abc", label: "Ouvrir mon espace" },
    ],
    footerLines: ["contact@atelier.test", "06 12 34 56 78"],
    footerNote: "Envoyé avec Symbola",
  };

  it("échappe tout texte, garde les sauts de ligne, rend les adresses http(s) cliquables et le bouton à la couleur de l'organisation", () => {
    const html = renderMailHtml(layout);
    expect(html).toContain("Atelier &lt;Camille&gt; &amp; Cie");
    expect(html).toContain("Bonjour Léa,<br>voici &lt;votre&gt; lien : <a href=\"https://symbola.test/lien#abc\"");
    expect(html).toContain("background:#7a2e4d;color:#ffffff");
    expect(html).toContain(">Ouvrir mon espace</a>");
    expect(html).toContain("contact@atelier.test<br>06 12 34 56 78");
    expect(html).not.toContain("<votre>");
  });

  it("le logo, quand il existe, remplace le nom en tête ; une couleur invalide ou une adresse non http(s) est écartée", () => {
    const html = renderMailHtml({ ...layout, logoCid: "logo@symbola", accent: "red;background:url(x)", blocks: [{ kind: "button", url: "javascript:alert(1)", label: "x" }] });
    expect(html).toContain('<img src="cid:logo@symbola" alt="Atelier &lt;Camille&gt; &amp; Cie"');
    expect(html).not.toContain("red;background");
    expect(html).not.toContain("javascript:");
  });

  it("la version texte reprend paragraphes, bouton (intitulé puis adresse), coordonnées et le bandeau d'essai", () => {
    expect(renderMailText({ ...layout, banner: "Essai" })).toBe(
      "Essai\n\nBonjour Léa,\nvoici <votre> lien : https://symbola.test/lien#abc\n\nOuvrir mon espace\nhttps://symbola.test/lien#abc\n\n--\ncontact@atelier.test\n06 12 34 56 78\nEnvoyé avec Symbola\n",
    );
  });

  it("l'adresse d'expédition reste celle de Symbola, quel que soit le nom affiché", () => {
    expect(senderAddress("Symbola <no-reply@symbola.fr>")).toBe("no-reply@symbola.fr");
    expect(senderAddress(" no-reply@symbola.fr ")).toBe("no-reply@symbola.fr");
  });
});

