# ADR 0078 — Le temps de réponse mesuré et l'accessibilité contrôlée à chaque version

- Statut : accepté (lot 40c, décisions D15 à D19 validées par Julien le 17/11/2026)
- Date : 2026-11-17
- Exigences : NFR-01, NFR-02, NFR-17, NFR-18, NFR-19, UX-14, UX-15, HUB-12, JUR-17 de
  `docs/CAHIER_DES_CHARGES.md` ; spécification `docs/lots/lot-40-exploitation-mesures.md`
  (partie 40c).

## Contexte

Le cahier des charges veut un affichage en 2,5 s sur un téléphone de milieu de gamme en 4G, une
réaction à un geste en 200 ms, mesurés à chaque version (NFR-01) ; 95 % des requêtes en 300 ms et
une recherche en 500 ms (NFR-02) ; WCAG 2.2 AA contrôlé à chaque version, avec une revue manuelle au
clavier et au lecteur d'écran (NFR-17, UX-14, JUR-17) ; les scénarios joués sous trois navigateurs
(NFR-18), de 360 à 1 920 px, zoom à 200 % sans perte de fonction et SC-10 à 150 % (NFR-19).
Jusqu'au lot 40b, rien n'était mesuré ; axe-core tournait avec ses règles par défaut (WCAG 2.1), sous
Chromium seul, à 1 280 et 375 px.

## Décision

1. **Mesures dans le job de bout en bout, sans dépendance nouvelle** (D15) —
   `apps/symbola/e2e/nfr-01-02-mesures.spec.ts`, sur l'app compilée, Chromium seul (le bridage
   passe par le protocole des outils de développement) :
   - **affichage** : chaque écran des parcours P0 (« Aujourd'hui », Tâches, synthèse et
     rétroplanning d'un évènement, budget, devis, contacts, jour J, portail des mariés) ouvert dans
     un contexte neuf, sans cache, à 375 px, en profil « téléphone de milieu de gamme en 4G » (celui
     de Lighthouse pour mobile : 1,6 Mbit/s, latence 150 ms, processeur ralenti quatre fois) ; le
     plus grand affichage (LCP, lu par un `PerformanceObserver`) sous 2,5 s, et aucune erreur dans
     la page ;
   - **interaction** : mesurée dans la page (de l'activation à la mutation visible, sans l'aller et
     retour de Playwright), processeur ralenti quatre fois : la coche optimiste d'une tâche sous
     100 ms (UX-15), ⌘K qui met la palette en saisie sous 200 ms ;
   - **serveur** : neuf pages des parcours P0 (dont le portail), huit tours après un tour de
     chauffe, 95e centile sous 300 ms ; dix recherches de la palette, deux fois, 95e centile sous
     500 ms (HUB-12).

   Un atelier dédié (`e2e/atelier-40c.ts`) donne à chaque mesure le même mariage confirmé : huit
   tâches, deux postes au budget, un paiement, un lien des mariés.
2. **Un dépassement fait échouer la CI** (D16) ; les chiffres vont au résumé du job
   (`GITHUB_STEP_SUMMARY`). Une mesure ne vaut que seule : elle ne tourne que si Playwright joue un
   parcours à la fois (la CI ; `--workers=1` en local), sinon elle est mise de côté avec ce motif
   (en local, sous la charge de cinq parcours en parallèle, le serveur passait de 130 à 314 ms). La CI rejoue un parcours en échec deux fois : une mesure qui ne passe
   qu'au second essai apparaît « instable » dans le rapport. Si les machines de la CI se révèlent
   trop irrégulières, le seuil bloquant passera à la médiane de trois essais (avenant à cet ADR).
3. **Navigateurs** (D17) — les dix fichiers des parcours des scénarios (SC-01, SC-03, SC-10, devis,
   contrat, portail, jour J, documents embarqués, saisie, reprise d'import) tournent aussi sous
   Firefox et WebKit (moteur de Safari), à 360 px et à 1 920 px ; le reste de la suite reste sous
   Chromium, qui couvre aussi Edge. La CI les joue en deux volets parallèles (matrice du job
   `e2e`) pour ne pas allonger le premier, déjà proche de 30 minutes. Safari d'un iPhone simulé
   est rejoué en local sur SC-03 et le portail.
4. **Zoom par la taille de la fenêtre** (D18) — un navigateur zoomé recompose la page dans moins de
   pixels CSS : 1 280 × 800 à 200 % donne 640 × 400, à 150 % 853 × 533 (même principe que la méthode
   de WCAG pour la redistribution, 1.4.10). `e2e/nfr-19-zoom.spec.ts` ouvre chaque écran des
   parcours P0 et le portail à 640 × 400 et à 360 × 780 : titre visible, aucun défilement
   horizontal de la page, menu joignable, axe-core sans violation ; le projet `zoom-150` rejoue
   SC-10. Un tableau large défile dans son propre cadre (exception de 1.4.10 pour les tableaux de
   données), jamais la page. Le premier passage a relevé le budget à 200 % : deux textes réservés aux
   lecteurs d'écran, en position absolue, sortaient du cadre qui défile et élargissaient la page ;
   le cadre (`.list-table-wrap`) est désormais leur référence de position.
5. **WCAG 2.2 AA partout** (D19) — `e2e/axe.ts` règle axe-core sur les étiquettes WCAG 2.0, 2.1 et
   2.2 de niveaux A et AA, plus les bonnes pratiques qu'il appliquait déjà ; tous les parcours
   l'importent. S'y ajoutent :
   - un lien d'évitement « Aller au contenu », premier arrêt du clavier (2.4.1) ;
   - `prefers-reduced-motion` qui coupe transitions et animations (2.3.3) ;
   - `e2e/nfr-17-clavier.spec.ts` : lien d'évitement, focus visible, Échap qui ferme la palette et
     le panneau d'édition, PAR-03 et PAR-06 au clavier ;
   - une revue de l'arbre d'accessibilité et du clavier des écrans P0 par Claude Code, consignée
     dans `docs/recette/accessibilite.md` ; une revue du portail à VoiceOver par Julien, selon
     `docs/recette/voiceover-portail.md` ;
   - une déclaration d'accessibilité volontaire du portail, rédigée sur le modèle public
     (`docs/conformite/declaration-accessibilite.md`) ; la page publique `/accessibilite` attend la
     relecture de l'avocat (question 13), l'analyse d'exemption et le contact.
6. **L'erreur d'hydratation de la fiche d'un évènement** (React #418) venait d'un formulaire (le
   type de l'évènement) placé dans le paragraphe du sous-titre de l'en-tête : le navigateur
   corrigeait le HTML et React reconstruisait l'écran. Le sous-titre est désormais un bloc ; la
   mesure de l'affichage échoue sur toute erreur dans la page.

7. **Ce que Firefox et WebKit ont révélé** :
   - **Firefox** : la copie du jour J sur l'appareil attendait la réponse à
     `navigator.storage.persist()` ; Firefox la pose à la personne, et la copie restait sur
     « Copie en cours… » tant qu'elle n'avait pas répondu. La demande part désormais sans être
     attendue (`lib/offline/device-copies.ts`).
   - **WebKit** : l'app compilée tourne en production, même sur le banc d'essai ; ses cookies
     partaient donc en « Secure » sur `http://localhost`, que Chromium et Firefox acceptent et que
     WebKit refuse : aucune connexion n'aboutissait. `lib/cookie-security.ts` décide désormais pour
     tous les cookies de Symbola : « Secure » en production, sauf si l'adresse publique déclarée
     (`APP_PUBLIC_URL`) est `http://localhost`, `127.0.0.1` ou `[::1]` (un cookie de `localhost` ne
     passe jamais par le réseau). Une adresse absente, illisible, en HTTP mais pas locale, ou qui
     imite `localhost`, garde « Secure » (tests SEC-05 et NFR-18) ; le job de bout en bout de la CI
     déclare donc `APP_PUBLIC_URL=http://localhost:3000`. La production fixe toujours une adresse
     en `https://` (Compose).
8. **Cibles de 24 px** (2.5.8) : la suite en WCAG 2.2 a relevé l'historique des versions d'un devis
   (résumé de 19 px de haut, lien du PDF collé) ; corrigé. Dans l'agenda, le menu d'une date ouverte
   recouvre des dates voisines : on les rejoint en le refermant (Échap, clic ailleurs), exception
   « équivalent » de 2.5.8 ; le parcours contrôle la page menus fermés, puis le menu ouvert seul.

## Conséquences

- Mesures locales du 17/11/2026 (Mac, app compilée) : affichage de 1,1 à 1,2 s sur les neuf écrans,
  coche en 11 ms, ⌘K en 12 ms, serveur à 130 ms au 95e centile, recherche à 57 ms
  (`docs/recette/NFR-01-02.md`).
- Les mesures ne valent que pour Chromium ; WebKit sous Linux n'est pas Safari d'un iPhone : le
  rejeu sur un iPhone simulé reste nécessaire. Le profil 4G imite un réseau, pas un vrai téléphone.
- Le second volet de la CI installe Firefox et WebKit ; si les miroirs Ubuntu refusent leurs
  dépendances système, les navigateurs s'installent sans elles et un navigateur qui ne démarre pas
  fait échouer ses parcours, avec un message clair.
- Un audit par un tiers reste utile avant la porte 3 (hors périmètre).

## Avenant du 22/11/2026 (lot 65, décision de Julien)

Une série de 72 requêtes, sur une machine de CI partagée, variait de 212 à 343 ms d'une version à
l'autre, sur main comme sur les branches : NFR-02 échouait au hasard. La mesure du serveur se fait
désormais en **trois séries** (chacune : huit tours des neuf pages, puis les vingt recherches) ; le
seuil (300 ms pour les pages, 500 ms pour la recherche) vaut pour la **médiane des trois 95e
centiles**. Les trois valeurs vont au résumé du job. Les seuils ne changent pas. Chaque mesure est
aussi rejouée à part par les reprises de la CI (elle ne dépend plus du succès de la précédente).

