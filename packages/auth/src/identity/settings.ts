// Lot 33 (ADR 0067) — réglages du fournisseur d'identité, appliqués par configure-identity.
// Fonctions pures, testées : ce que Symbola attend de Logto, écrit une fois.
import { dictionary } from "@zxcvbn-ts/language-common";

export const WEB_APPLICATION_NAME = "Symbola";

// ADR 0063 et 0067 : la liste locale des mots de passe les plus répandus, plus les années (« motdepasse2027 »).
export function forbiddenPasswordWords(): string[] {
  const words = new Set(dictionary["passwords-common"].map((password) => String(password).toLowerCase()));
  for (let year = 1900; year <= 2099; year += 1) words.add(String(year));
  return [...words];
}

// Couleur principale de DESIGN.md (ADR 0057), reprise sur les pages du fournisseur.
export const BRAND_PRIMARY_COLOR = "#5B3E8F";

export function signInExperience(words: string[]) {
  return {
    // HUB-01 : une seule donnée à l'inscription, l'adresse e-mail, vérifiée.
    signUp: { identifiers: ["email"], password: false, verify: true },
    // Lien magique (envoyé par Symbola), code par e-mail, mot de passe en option, clé d'accès.
    signIn: { methods: [{ identifier: "email", password: true, verificationCode: true, isPasswordPrimary: false }] },
    passkeySignIn: { enabled: true, showPasskeyButton: true, allowAutofill: true },
    // D4 : Logto ne propose jamais la double authentification de lui-même ; Symbola l'exige
    // pour la Propriétaire et l'Exploitation (déclaration acr).
    mfa: { factors: ["Totp", "WebAuthn", "BackupCode"], policy: "NoPrompt" },
    // Q22 : aucun appel sortant (Have I Been Pwned coupé) ; la liste locale à la place.
    passwordPolicy: {
      length: { min: 12, max: 256 },
      characterTypes: { min: 1 },
      rejects: { pwned: false, repetitionAndSequence: true, userInfo: true, words },
    },
    languageInfo: { autoDetect: true, fallbackLanguage: "fr" },
    color: { primaryColor: BRAND_PRIMARY_COLOR, isDarkModeEnabled: false, darkPrimaryColor: BRAND_PRIMARY_COLOR },
  };
}

export function webApplication(appPublicUrl: string) {
  const base = appPublicUrl.replace(/\/+$/, "");
  return {
    name: WEB_APPLICATION_NAME,
    type: "Traditional",
    oidcClientMetadata: { redirectUris: [`${base}/auth/callback`], postLogoutRedirectUris: [`${base}/login`] },
  };
}

export type SmtpSettings = { host: string; port: number; user?: string | undefined; password?: string | undefined; from: string; secure: boolean };

// E-mails que Logto envoie lui-même (code de connexion, mot de passe oublié), par le serveur
// d'envoi de Symbola. Le lien magique, lui, part de Symbola avec ses propres textes.
export function smtpConnector(smtp: SmtpSettings) {
  const template = (usageType: string, subject: string) => ({
    usageType,
    contentType: "text/plain",
    subject,
    content: "Votre code Symbola : {{code}}\nIl est valable dix minutes. Si vous n'avez rien demandé, ignorez ce message.\n\nYour Symbola code: {{code}}\nIt is valid for ten minutes.",
  });
  return {
    host: smtp.host,
    port: smtp.port,
    auth: { type: "login", user: smtp.user || "symbola", pass: smtp.password || "symbola" },
    fromEmail: smtp.from,
    ...(smtp.secure ? { secure: true } : { ignoreTLS: !smtp.user }),
    templates: [
      template("SignIn", "Votre code de connexion · Your sign-in code"),
      template("Register", "Votre code d'inscription · Your sign-up code"),
      template("ForgotPassword", "Votre code de réinitialisation · Your reset code"),
      template("Generic", "Votre code Symbola · Your Symbola code"),
    ],
  };
}
