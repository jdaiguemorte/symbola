# ADR 0029 — Assistance de l'Admin, mot de passe oublié et statistiques d'usage

- Statut : accepté
- Date : 2026-11-04
- Précise : [0013](0013-auth-maison-pour-le-mvp.md) (authentification maison) et le principe
  « l'Admin n'a aucun accès aux données métier » (CLAUDE.md § 5)

## Contexte

Lors des premiers essais sur le staging (04/11/2026), Julien a relevé trois manques :

1. un utilisateur bloqué (double authentification inutilisable, invitation perdue ou expirée,
   mot de passe oublié) ne pouvait être aidé qu'en modifiant la base ;
2. l'Admin ne voyait pas l'état des comptes (double authentification configurée, verrouillage,
   dernière connexion) ;
3. l'Admin ne pouvait pas juger de l'usage réel de l'application.

Le principe actuel interdit à l'Admin tout accès aux données métier des organisations, ce qui
reste essentiel (confidentialité des mariages, RGPD).

## Décision

Choix de Julien du 04/11/2026 : les quatre outils d'assistance et des indicateurs agrégés.

1. **Mot de passe oublié** (sans l'Admin) : lien sur l'écran de connexion. Le lien envoyé par
   e-mail est à usage unique et valable 30 minutes ; seul le hachage du jeton est stocké
   (`hub.password_resets`). La réponse est identique, que l'adresse ait un compte ou non. Un
   nouvel e-mail ne part pas plus d'une fois toutes les 5 minutes par compte. Le nouveau lien
   annule les précédents. Le mot de passe fait au moins 12 caractères (règle appliquée aussi à
   l'acceptation d'une invitation). Toutes les sessions sont fermées et un verrouillage en cours
   est levé ; la double authentification reste demandée.
2. **État des comptes** (`/admin/comptes`) : pour chaque organisation, les comptes de
   l'**équipe** (titulaire, membres) avec leur adresse, leur rôle, l'état de la double
   authentification, un verrouillage en cours et la dernière connexion, et les invitations en
   attente. Les comptes des mariés n'y figurent pas.
3. **Réinitialiser la double authentification** d'un compte d'équipe (téléphone perdu ou
   changé) : la clé est effacée et les sessions fermées ; à la connexion suivante, mot de passe
   puis nouveau QR code. Jamais pour un marié ni pour un Admin. Une case de confirmation est
   exigée, l'action est inscrite au journal (`hub.audit_log`, nouveau champ `target_user_id`) et
   la personne est prévenue par e-mail.
4. **Renvoyer l'invitation** d'une titulaire : nouveau lien valable 7 jours, l'ancien cesse de
   fonctionner ; action journalisée.
5. **Statistiques d'usage** (`/admin/activite`) : par organisation, nombre de comptes d'équipe
   et de comptes mariés, comptes connectés sur 30 jours, dernière connexion, et sur 6 mois le
   nombre d'événements créés, de devis créés et de factures émises. Ce sont **des nombres
   seulement** : jamais un nom, un montant, un contenu ni l'adresse d'un marié, et les données
   d'essai (`is_demo`) sont exclues. Les comptages passent par le `service.ts` de chaque module
   (`countEventsCreatedByMonth`, `countQuotesAndInvoicesByMonth`), dans le contexte RLS de
   l'organisation concernée.

Le principe devient : **l'Admin n'a aucun accès aux données métier des organisations ; il voit
seulement les comptes de leur équipe (pour l'assistance) et des statistiques d'usage
agrégées.**

## Conséquences

- RGPD : les statistiques sont des mesures d'usage du service, sans donnée des clients des
  organisations. Elles sont à mentionner dans la politique de confidentialité et les conditions
  du service proposées aux wedding planners. Les lignes de `hub.password_resets` sont supprimées
  avec le compte (suppression en cascade) ; une entrée du journal survit à la suppression d'un
  compte (lien remis à nul).
- Les e-mails (mot de passe oublié, invitation renvoyée, double authentification
  réinitialisée) sont composés par l'app dans la langue du compte ou de l'organisation ; les
  services du hub et de `packages/auth` n'envoient rien eux-mêmes et restent testables sans
  serveur Next.
- Une session encore ouverte ailleurs est fermée par la réinitialisation du mot de passe ou de
  la double authentification.
- Reste à faire plus tard si besoin : invitation de membres d'équipe par la titulaire, et un
  vrai écran du journal d'audit.
