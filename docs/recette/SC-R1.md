# Rejeu SC-R1 — Reprendre un mariage en cours

Scénario local du lot 71 (décision I11 de Julien du 27/11/2026 ; son entrée au § 17 du cahier des
charges reste ouverte, Q48) : Camille (SU-01) reprend « Juliette & Romain » de son tableur, puis Sophie
(SU-04) le refait à 150 %. Rejoué à chaque paquet du lot qui touche le parcours ; les écrans arrivent
aux paquets 71b à 71g.

## Lot 71a — le socle et les règles de fond

- Date : 27/11/2026, en local, par Claude Code. Base de test dédiée (`symbola_lot71a`, migrations
  jusqu'à 0223), stockage Garage et ClamAV du socle de dev. **Aucun écran** : le paquet 71a ne change
  que les règles d'écriture de l'import ; le parcours est rejoué par les services, sur les fichiers
  fictifs du tableur de la planner (`packages/testing/import-corpus/files/tableur-planner/`) et la
  fiche PDF fictive du logiciel (`logiciel-tiers/fiche-evenement-complete.pdf`), dans
  `apps/symbola/lib/import/takeovers-71a.integration.test.ts`.

| Étape du parcours | Ce qui est vérifié | Résultat |
| --- | --- | --- |
| Commencer la reprise avant le mariage | Six lignes dans l'ordre R2, « 0 fichier sur 6 », ligne du carnet déjà faite au deuxième mariage | Tenu |
| Le mariage (fiche PDF « Signé, en préparation ») | Confirmé ; statut « date non renseignée » ; aucune source ; le type de l'espace ; note dans « Notes » ; 21 650,50 € dont 3 200,00 € à répartir ; rien dans « Champs importés » ; la reprise reçoit son mariage | Tenu |
| Le budget (`budget.csv`, « Oui, payés ») | 8 727,00 € réglés, 18 775,00 € à payer, aucune échéance en retard au 24/11/2026 ; avec « Non », 6 en retard | Tenu |
| Rien n'est fondu | 14 lignes, 36 450,00 € prévus ; les trois lignes « Traiteur » sous un seul poste | Tenu |
| Les prestataires du budget | Retenus, contrat déclaré (signé, non signé, non renseigné) ; « Aujourd'hui » n'a aucun « Contrat de … à faire signer » né de l'import | Tenu |
| La liste « à faire » (`a-faire.csv`) | Les 5 tâches cochées « x » arrivent faites, date de fin non renseignée, sans auteur | Tenu (colonnes choisies à la main : « Quoi » et « Pour quand » seront reconnus au paquet 71c) |
| Les noms | « Léa MARTIN », « POITIERS » → « Léa Martin », « Poitiers » ; « Garder les capitales » les laisse | Tenu |

Mesures :

- **Le lendemain d'une reprise, aucune fausse alerte née de l'import** : tenu pour les acomptes et les
  contrats (règles de fond) ; la page « Aujourd'hui » elle-même est rejouée au paquet 71f.
- **30 minutes par mariage** : non mesuré (aucun écran) ; la cible reste au rejeu des paquets 71b à 71g.
- Sophie à 150 % : sans objet pour ce paquet (aucun écran).

## Lot 71b — la page de reprise et ses portes

- Date : 27/11/2026, en local, par Claude Code. Base de test dédiée (`symbola_lot71b`, migrations
  jusqu'à 0223), socle de dev (Garage, ClamAV, Mailpit, Logto). Rejoué **à l'écran**, à 1 440 et à
  375 px, par le parcours `apps/symbola/e2e/lot-71b-page-de-reprise.spec.ts` (16 parcours verts) et à
  la main dans le navigateur, sur les fichiers fictifs du tableur de la planner
  (`packages/testing/import-corpus/files/tableur-planner/`). Camille seulement : Sophie à 150 % reste au
  paquet 71g (messages d'erreur) et au rejeu d'ensemble.

| Étape du parcours | Ce qui est vérifié | Résultat |
| --- | --- | --- |
| Arriver sur la reprise | Par « Nouvel évènement › Reprendre ses fichiers », la fin de l'assistant (réponse « un tableur »), la recherche, l'état « À vérifier » de « Tâches » | Tenu |
| La page vide | Six lignes dans l'ordre (carnet, mariage, budget, prestataires retenus, liste « à faire », programme), « 0 fichier sur 6 », seule action principale sur la ligne 1, lignes 3 à 6 « Après le mariage » sans bouton ; rien n'est écrit avant le premier geste | Tenu |
| Le carnet | « Je n'ai pas ce fichier » règle la ligne (« Pas de fichier · Choisi le … ») et se défait par « Déposer un fichier », qui ouvre l'import du carnet avec « ‹ Reprendre un mariage en cours » en tête | Tenu |
| Le mariage | « Saisir les noms et la date » : « Juliette & Romain », 20/03/2027 ; Confirmé, d'origine « reprise », statut « date non renseignée », aucune tâche ; message de retour « Mariage enregistré » | Tenu |
| Le budget (`budget.csv`) | Déposé depuis sa ligne : rattaché au mariage (« Les lignes iront dans l'évènement « Juliette & Romain » »), la ligne « En cours », « Arrêté à « Colonnes » », « Continuer » en bouton plein ; la ligne 4 « Avec le budget : votre budget nomme 7 prestataires » dès le dépôt ; « 3 fichiers sur 6 » | Tenu |
| Un import laissé en plan | En tête de « Reprendre et importer » (« Import en cours : budget.csv, pour « Juliette & Romain » ») ; « Abandonner cet import… » demande confirmation et rend la ligne | Tenu |
| La fin | Six lignes réglées : « Reprise terminée. Il reste 3 points à compléter à la main. » (les tâches, le lien des mariés, les invités), « Ouvrir « À compléter » », jamais « à jour » ; « Reprendre un autre mariage » repart d'une page où le carnet est déjà fait | Tenu |

Mesures :

- **Aucune commande sous 44 px, aucun défilement de côté à 375 px** sur la page vide, en cours, terminée,
  « Saisir les noms et la date », « Reprendre et importer » et la fin de l'assistant (qui avait un
  bouton « Ouvrir l'exemple » de 40 px, corrigé).
- **axe-core** : aucune violation sur la page vide, en cours, terminée, « Reprendre et importer » et la fin
  de l'assistant.
- **30 minutes par mariage** : non mesuré ; l'assistant d'import lui-même change aux paquets 71c à 71e.
- Ce qui reste provisoire jusqu'au 71c : chaque ligne ouvre l'assistant d'import d'avant (sans l'étape
  « Questions ») ; les PDF des prestataires retenus et du programme s'ouvrent sur la fiche du mariage et
  cochent leur ligne sans bilan (paquet 71e).

## Lot 71c — l'assistant qui demande

- Date : 27/11/2026, en local, par Claude Code. Base de test dédiée (`symbola_lot71c`, migrations
  jusqu'à 0235 de `main`, aucune nouvelle), socle de dev (Garage, ClamAV, Mailpit). Rejoué **à l'écran**,
  à 1 440 et à 375 px, par le parcours `apps/symbola/e2e/lot-71c-questions.spec.ts` (version compilée
  sur le port 3071, session ouverte en base faute du port 3000), et par les services dans
  `apps/symbola/lib/import/questions-71c.integration.test.ts` (horloge simulée au 25/11/2026), sur les
  fichiers fictifs du tableur de la planner et la fiche PDF fictive du logiciel. Camille seulement :
  Sophie à 150 % reste au paquet 71g et au rejeu d'ensemble.

| Étape du parcours | Ce qui est vérifié | Résultat |
| --- | --- | --- |
| Le budget déposé hors de la reprise (« Reprendre et importer ») | La première question est « Pour quel mariage est ce budget ? » (les mariages à venir avec l'état de leur budget, et « Un mariage qui n'est pas encore dans Symbola ») ; aucune ligne rejetée « introuvable » ; le mariage « Clara & Yanis » est créé à l'écriture, d'origine « reprise », avec sa page de reprise où le budget est fait | Tenu |
| Le budget déposé depuis la page de reprise | Le mariage n'est pas demandé : « Pour « Juliette & Romain », 20 mars 2027 : choisi depuis la page de reprise. » | Tenu |
| Les acomptes (`budget.csv`) | Aucune réponse cochée ; « Oui » annonce et écrit 8 727,00 € réglés, 18 775,00 € à payer, aucune en retard ; « Non », 0,00 €, 27 502,00 €, 6 en retard ; « Certains seulement » : 5 payés sur 6, le total suit ; « Continuer » sans réponse écrit sous chaque question ce qui manque | Tenu |
| Les contrats (I1) | « Leurs contrats sont-ils signés ? » posée pour les 7 prestataires du budget (Tous, Aucun, Ligne par ligne) ; aucune relance « à faire signer » ensuite | Tenu |
| La fiche d'un logiciel | « Où en est-il ? » sans réponse cochée, type posé quand l'espace n'en a qu'un et demandé sinon, source facultative laissée « non renseignée » ; « Ce qui sera écrit » : « Léa Martin · Hugo Bernard » (« Écrits ainsi dans le fichier : « Léa MARTIN », « Hugo BERNARD » »), 21 650,50 € dont 3 200,00 € réglés à répartir | Tenu |
| La liste « à faire » | « Fait ? », « Quoi », « Pour quand », « Qui » reconnus d'office ; « 2 tâches non faites ont une échéance déjà passée » ; les garder (2 en retard), les redater (2 redatées, date obligatoire et à venir), les dire faites (7 faites au lieu de 5, date de fin non renseignée) ; « Ce que Symbola a compris » : « x » → Faite, « moi » → Vous, « mariés » → Les mariés | Tenu |
| « Partir d'un modèle » (I3) | Sur un mariage repris, les tâches du modèle déjà passées posent la même question ; sans réponse, rien n'est appliqué ; aucun modèle n'est appliqué d'office à un mariage repris | Tenu (services ; l'écran est le formulaire du modèle de l'onglet « Tâches ») |
| « Abandonner cet import… » | Un bouton à chaque étape, la fenêtre de niveau 2 qui nomme le fichier (« Continuer l'import », « Abandonner l'import ») ; retour à la page de reprise avec « Import abandonné : rien n'a été importé. » | Tenu |

Mesures :

- **Aucune commande sous 44 px, aucun défilement de côté à 375 px** sur chaque question ; sur téléphone,
  la frise se lit « Étape 3 sur 5 · Questions ».
- **axe-core** : aucune violation sur chaque question, avant et après « Continuer » sans réponse, et sur la
  fenêtre d'abandon.
- **30 minutes par mariage** : non mesuré ; « Vérifier », les doublons et le bilan changent au paquet 71d.
- Ce qui reste provisoire jusqu'aux paquets 71d et 71e : l'étape « Doublons » et « Vérifier » d'avant (le
  choix des acomptes payés et de la nouvelle échéance se fait à l'étape « Questions », la maquette les
  met à « Vérifier ») ; les prestataires retenus et le programme hors de l'assistant commun.

## Lot 71d — Doublons, « Vérifier », bilan et retrait

- Date : 28/11/2026, en local, par Claude Code. Base de dev (migrations jusqu'à 0235 de `main`, aucune
  nouvelle), socle de dev (Garage, ClamAV, Mailpit). Rejoué **à l'écran**, à 1 440 et à 375 px, par le
  parcours `apps/symbola/e2e/lot-71d-doublons-bilan.spec.ts` (serveur sur le port 3071, session ouverte
  en base faute du port 3000), et par les services dans
  `apps/symbola/lib/import/doublons-bilan-71d.integration.test.ts` (16 tests, horloge simulée pour la date
  limite), sur `tableur-planner/budget.csv`, la fiche PDF fictive et un carnet fictif de 7 fiches où
  « Élodie Beauté » est écrite « Élodie Perrot · Beauté ». Camille seulement.

| Étape du parcours | Ce qui est vérifié | Résultat |
| --- | --- | --- |
| « Doublons », les postes | « Postes : 8 postes du fichier, 10 postes dans ce mariage » ; « Lieu » sous « Lieu de réception » (nom proche), « Traiteur » (même nom, les 3 lignes gardent leur détail), « Fleurs » sous « Fleuriste », « Musique » sous « DJ / musiciens », « Transport » sous « Transport des invités » ; « Photo et vidéo » réparti (« Reportage photo » → Photographe, « Film » → Vidéaste), « À vérifier » jusqu'à « C'est juste » ; les 14 lignes restent 14 | Tenu |
| Le poste sans ligne | « Décoration », poste de départ, à trouver : « Le garder « à trouver » » ou « Le retirer de ce mariage » ; retiré, il est « Non requis » | Tenu |
| « Doublons », les prestataires | « Prestataires : 7 noms, 6 trouvés tels quels dans votre carnet » ; « Élodie Beauté » comparée à « Élodie Perrot · Beauté » colonne par colonne, « Ce qui les rapproche : « Élodie » et « Beauté » dans les deux noms » ; « C'est la même fiche » la retient sur « Coiffure et maquillage » ; aucune fiche doublée | Tenu |
| « Continuer » avec des choix restants | « Encore 3 choix : Photo et vidéo, Décoration, Élodie Beauté », chacun un lien ; l'écran se place sur le premier | Tenu |
| « Vérifier » | « 14 lignes dans 9 postes · 36 450,00 € prévus · 27 502,00 € de réel selon votre fichier (8 lignes non renseignées) · 8 727,00 € réglés : 6 acomptes · 18 775,00 € à payer : 5 soldes, du 20 février au 20 mars 2027 · 7 prestataires retenus (tous dans votre carnet) · aucune échéance en retard, aucune relance, aucune tâche créée » ; « Non repris : rien » ; le budget poste par poste, « tout afficher » ; jamais « engagé » | Tenu |
| Le bilan | Les mêmes nombres, mot pour mot (texte comparé) ; « Rien de votre fichier : les 14 lignes sont dans le budget » ; « Ce que vous avez choisi » ; « Voir le budget » ; la date limite ; la page de reprise redit « 14 lignes » | Tenu |
| « Retirer cet import… » | Niveau 2 : « Le budget de « Juliette & Romain » revient à ce qu'il était avant le … » ; « Partent : 14 lignes, les 6 acomptes réglés, les 5 soldes, 7 prestataires retenus » ; « Restent : les 7 fiches du carnet » ; « Garder l'import » d'abord ; après, le budget est vide, « Décoration » remis « à trouver », la ligne « Budget » de la reprise « À faire » | Tenu |
| Lignes modifiées depuis, date limite | Une ligne retouchée reste, sauf la case ; refusé au 90e et au 91e jour, possible au 89e | Tenu (services) |
| « Retirer toute la reprise… » (I10) | Niveau 3 avec « Je comprends… » ; budget puis fiche et mariage en une transaction ; échec au milieu : rien n'est retiré ; un import au-delà de 90 jours : non proposé, la fenêtre le nomme ; B ne retire rien de A | Tenu (services ; l'écran est rejoué sur le bilan de la fiche au rejeu d'ensemble) |

Mesures :

- **À 375 px** : aucune commande sous 44 px, aucun défilement de côté, la barre d'action jamais recouverte,
  sur « Doublons », « Vérifier » et le bilan.
- **axe-core** : aucune violation sur « Doublons », « Vérifier », le bilan et la fenêtre de retrait.
- **30 minutes par mariage** : non mesuré ; les prestataires retenus et le programme changent au paquet 71e.
- Écarts : la maquette écrit « 7 lignes non renseignées » (le fichier en a 8) et suppose d'autres postes
  de départ (« Tenues », « Musique et animation ») ; « Le retirer de ce mariage » rend le poste « Non requis »
  ; sur téléphone, les choix restent empilés (pas un choix par écran). Voir la PR du lot 71d.

## Lot 71f — la fiche d'un mariage repris et ses reflets

- Date : 27/11/2026, en local, par Claude Code. Base de test dédiée (`symbola_lot71f`, migrations
  jusqu'à 0223), app compilée sur le port 3071, session ouverte en base (le fournisseur d'identité local
  ne connaît que le port 3000). Rejoué **à l'écran**, à 1 440 et à 375 px, par le parcours
  `apps/symbola/e2e/lot-71f-fiche-reprise.spec.ts` (12 parcours verts, axe-core sur chaque écran), et
  regardé dans le navigateur sur « Léa & Hugo » (repris, données fictives) et « Léa & Maxime » (créé).
  Camille seulement ; Sophie à 150 % reste au paquet 71g et au rejeu d'ensemble.

| Étape du parcours | Ce qui est vérifié | Résultat |
| --- | --- | --- |
| La fiche, le lendemain | Sous l'en-tête : « Repris le … de 2 fichiers · Voir la reprise » ; « À compléter après la reprise », « 6 points · 0 fait » : montants de 3 prestataires (« 21 650,50 € à répartir sur les postes »), 2 contrats non signés (« Aucune relance n'est créée »), les tâches (« Reprendre une liste », « Partir d'un modèle »), 1 heure de fin, le lien des mariés, le nombre d'invités ; ni « tout est à jour », ni « Bon », ni « Champs importés », ni « 0,00 € de réel » | Tenu |
| La santé | « Pas encore de tâches : pas d'avis » ; « 21 650,50 € de réel · enveloppe 25 000,00 € », « Selon votre fichier ; dont 3 200,00 € réglés ; 0,00 € répartis sur les postes » ; « Aucun poste complet sur 3 · 3 retenus · 1 contrat signé » | Tenu |
| Faire un point | Le nombre d'invités saisi dans le panneau : le point passe en bas, coché (« Fait »), « 6 points · 1 fait », sans recharger la page | Tenu |
| La fin de la reprise | Les six points faits : « Reprise complétée le 2 déc. », puis le bloc disparaît au 8e jour (horloge simulée : 6e, 7e, 8e jour) et « Prochaine action » revient | Tenu (test d'intégration) |
| « D'où viennent ces valeurs ? » | « vous, à la reprise » pour les mariés saisis sur la page, « Fichier : fiche-lea-hugo.pdf » pour la note ; la note réécrite à la main perd sa marque | Tenu |
| Le budget | Bandeau « À compléter : 21 650,50 € de réel selon votre fichier, dont 3 200,00 € réglés », tuiles enveloppe, réel du fichier, réparti, reste à répartir ; « contrat signé », « contrat non signé », « contrat non renseigné » sous chaque prestataire ; « non renseigné » au lieu de « — » ; un réel saisi fait baisser le reste, à zéro le bandeau part | Tenu |
| La liste | « Repris · 6 points à compléter » (terminée), « Repris · 1 fichier sur 6 » (en cours), qui mènent à la reprise ; filtre « Origine » (Repris, Créés dans Symbola) | Tenu |
| « Aujourd'hui » | « Reprises en cours » en tête (« Léa & Hugo · reprise terminée aujourd'hui · 6 points à compléter · Voir ce qui reste » ; « Juliette & Romain · 1 fichier sur 6 · Continuer ») ; aucun « à faire signer » né de la reprise | Tenu |
| Un mariage créé | Ni marque, ni bloc, ni interrupteur ; « Prochaine action » | Tenu |

Mesures :

- **Un nombre annoncé est celui que redit l'écran suivant** : la page de reprise terminée, la fiche, la
  liste et « Aujourd'hui » lisent le même calcul (`lib/takeover/checklist.ts`) ; le test d'intégration
  compare la page et la fiche point par point.
- **Aucun défilement de côté à 375 px** sur la fiche, le budget, la liste et l'accueil ; **axe-core** sans
  violation sur chacun.
- Ce qui reste hors du paquet : la frise de statut dit encore « Confirmé » daté du jour de la reprise
  (son dessin relève du lot 72d) ; « Mes évènements » de l'accueil (lot 72b) dit « À jour » d'un mariage
  repris tant que le 72b n'y lit pas l'origine.

## Lot 71e — les prestataires retenus et le programme

- Date : 28/11/2026, en local, par Claude Code. Base du socle de dev (migrations de `main`, aucune
  migration nouvelle), ClamAV du socle, app compilée sur le port 3071, session ouverte en base (le
  fournisseur d'identité local ne connaît que le port 3000). Rejoué **à l'écran**, à 1 440 et à 375 px,
  par `apps/symbola/e2e/lot-71e-retenus-programme.spec.ts` (4 parcours verts, axe-core sur chaque écran,
  aucun défilement de côté à 375 px), et regardé en captures. Fichiers fictifs du corpus
  (`logiciel-tiers/prestataires-evenement.pdf`, `programme-jour-j.pdf`) déposés sur « Léa & Hugo »
  (le fichier nomme « Clémence & Bastien »).

| Étape du parcours | Ce qui est vérifié | Résultat |
| --- | --- | --- |
| Le dépôt | « Reprendre les prestataires retenus (PDF) » de l'onglet budget, ou la ligne 4 de la reprise, ouvre « Reprendre et importer » réglé sur ce mariage ; le PDF passe par `/import/envoi` (antivirus, type lu, pages bornées) | Tenu |
| Un autre couple | « Ce fichier est-il bien celui de Léa et Hugo ? », tableau Dans le fichier / Sur la fiche, « Choisir un autre fichier » en bouton plein, « C'est bien ce mariage, continuer » ; rien n'est lu avant la réponse | Tenu |
| Les contrats | « Leurs contrats sont-ils signés ? Tous, Aucun, Ligne par ligne » ; « Aucune relance n'est créée » ; « Ligne par ligne » ajoute la colonne « Contrat » | Tenu |
| L'aperçu | Toute la largeur ; une ligne par prestataire, fiche du carnet et poste du budget en entier ; seuls trois métiers sans poste proche sont « À vérifier », avec leur raison et le seul menu de l'aperçu ; « Ligne non reprise : « Belle Journée », votre agence. » | Tenu |
| Le bilan des prestataires | « 12 prestataires retenus sur « Léa & Hugo » », trouvés + créées = 12, signés + non signés = 12, nouveaux postes ; « Non repris : aucun montant » ; la réponse « C'est bien ce mariage » redite ; « Retirer cet import… » défait les douze (test d'intégration) | Tenu |
| Le programme : « Vérifier » | 3 journées « Veille », « Jour J », « Lendemain » avec la date complète ; « 19 h – 2 h le lendemain » ; « Fin non renseignée » ; « une fin à minuit, laissée vide » ; « 21 h 18 · repère » ; « Non repris : l'annuaire (8 intervenants) » | Tenu |
| L'onglet du programme | « À compléter : 7 heures de fin non renseignées », « Heure de fin » et « Ponctuel » sur chaque moment ; le compte baisse ; aucune fin déduite dans l'éditeur (« fin non renseignée », « ponctuel », « repère ») | Tenu |
| La diffusion | « Diffuser » sur un programme incomplet ouvre « Le programme n'est pas complet », la liste par journée, « Compléter d'abord », « Diffuser quand même » ; les destinataires lisent « heure de fin à venir » | Tenu |
| L'annuaire | Bilan : « Dans le carnet · ajouter le 06… », « déjà à jour », « Absent du carnet » ; l'agence et les mariés écartés ; « Ajouter les N téléphones » sans double (test d'intégration) | Tenu |

Mesures :

- **Les nombres de « Vérifier » sont ceux du bilan** : un même calcul (`importFigures`), gardé au journal
  à l'écriture ; les tests d'intégration comparent les deux.
- **NFR-02** : `/events` à 200 évènements, en alternance contre `main` (deux serveurs compilés, aucun
  des deux ne tenant le travail de fond) : 897 300 octets contre 901 026 ; médianes 231 et 201 ms contre
  234 et 186 ms (deux séries de 40).
