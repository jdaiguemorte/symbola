// Lot 74h (D7, G8, P-22 ; page 30 des maquettes du lot 68) — l'en-tête commun d'un écran de réglage.
//
// Réemploi (vagues 74i et 74j) : rendu côté serveur, sans texte à lui ; l'écran lui passe
// - `title` : le libellé de la rubrique dans le menu, mot pour mot (`SettingsMenu.rubrics.<clé>.label`) ;
// - `hint` : la phrase qui dit ce que la rubrique règle et où cela se voit ;
// - `scope` : la portée et qui la change, en mots, déjà assemblée par `settingsScopeLine`
//   (lib/settings/settings-header-texts.ts) : « Pour toute l'agence · Seule la titulaire la change ·
//   chaque changement s'enregistre seul » ;
// - `notice` (facultatif) : une ligne « À compléter » ou « À vérifier » sous la portée (fiche vide, radar
//   coupé) ; `actions` (facultatif) : un bouton secondaire, ou le seul bouton plein de l'écran quand une
//   action est l'objet de l'écran (« Inviter une personne »).
// Le « ? » de la barre du haut donne l'aide de l'écran : l'en-tête n'en porte pas.
import type { ReactNode } from "react";

export function SettingsHeader({ title, hint, scope, notice, actions }: { title: string; hint: string; scope: string; notice?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="settings-header">
      <div className="settings-header-text">
        <h1>{title}</h1>
        <p className="settings-header-hint">{hint}</p>
        <p className="settings-header-scope">{scope}</p>
      </div>
      {actions ? <div className="settings-header-actions">{actions}</div> : null}
      {notice ? <div className="settings-header-notice">{notice}</div> : null}
    </header>
  );
}
