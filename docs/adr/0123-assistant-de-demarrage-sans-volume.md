# ADR 0123 — L'assistant de démarrage ne demande plus le volume annuel

- Statut : accepté (lot 74a ; décision L74-D5 de Julien du 27/11/2026, tranchée par la règle « la décision la
  plus récente l'emporte » ; spécification `docs/lots/lot-74-premiers-pas-aide-parametres.md` validée le même
  jour)
- Date : 2026-11-27
- Diverge de : `docs/CAHIER_DES_CHARGES.md`, HUB-09 (le questionnaire d'accueil cite le nombre d'évènements
  par an parmi ses questions) et SC-01 étape 2 (« douze par an »).
- Complète : ADR 0103 (« L'essentiel », une question par écran) ; lot 71b (fin de l'assistant, I5, R3).
- Exigences : HUB-09, HUB-10, PAR-01, UX-04 ; scénario SC-01 ; maquette 22 du lot 68 (choix B2 à B6 de la
  note `docs/audits/2026-11-ux-parcours/11-maquettes-premiers-pas-aide.md`, tranchés le 26/11).

## Contexte

L'assistant du lot 33b posait cinq questions : métier, types d'évènements, régime de TVA, nombre
d'évènements par an (« De 11 à 25 » coché d'avance) et outils remplacés. Le panel de l'audit (PC-01, PC-02)
a montré trois choses : la planner valide la tranche cochée sans la lire (Camille en fait douze) ; la
réponse n'était lue par rien ; et la question qui comptait pour la suite, « avez-vous déjà des mariages en
cours ? », manquait (D6 : elle choisit le premier pas et le parcours des tutoriels). La maquette 22 garde
cinq questions au plus et remplace le volume par cette question (B2, B3).

## Décision

1. **Le volume annuel sort de l'assistant.** La colonne `hub.organization_profiles.annual_event_volume`
   reste ; une valeur déjà donnée se garde, et le champ se montre dans la fiche de l'entreprise (lot 74h,
   G15). HUB-09 dit que « tout reste modifiable dans les réglages » : la réponse reste possible, hors du
   premier quart d'heure.
2. **Cinq questions au plus** : métier, types d'évènements, « Avez-vous déjà des mariages en cours ? »,
   « Où les suivez-vous aujourd'hui ? » (seulement après « Oui »), « Vos devis portent-ils la TVA ? ». La
   réponse aux mariages en cours est gardée dans `has_ongoing_events` (migration 0244).
3. **Aucune réponse de fait n'est proposée d'avance** (M13) : seuls le métier et les types du métier le
   sont, dans `onboarding.json`, dont le schéma refuse désormais toute autre valeur de départ.
4. **« Je ne sais pas encore » est une réponse pour la TVA** (B5, L74-D4) : la franchise en base est
   gardée, `vat_answer_pending` est posé, et aucun devis ne s'envoie tant que la planner n'a pas répondu
   « Non » ou « Oui » ; « L'essentiel » redemande la TVA. Le brouillon d'un devis se crée et s'enregistre.

## Conséquences

- SC-01 se rejoue sans « douze par an » ; l'écart est noté dans `docs/recette/SC-01.md`, `docs/gap.csv`
  (HUB-09) et Q51 de `docs/QUESTIONS.md`.
- Rien ne lit le volume annuel ; s'il doit servir (forfaits, statistiques), ce sera un autre lot.
- Le point fiscal de « Je ne sais pas encore » (un devis sous franchise porte l'article 293 B du CGI) est
  tenu par le blocage de l'envoi, pas par une mention provisoire ; à faire confirmer par l'expert-comptable
  avant la première donnée réelle (L74-D4).
