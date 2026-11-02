# ADR 0023 — RGPD : contrat `privacy/v1` révisé (fiches désignées) et orchestration par le hub

- Statut : accepté
- Date : 2026-11-02
- Complète : [0011](0011-monolithe-modulaire-pour-le-mvp.md), [0022](0022-import-lecteur-xlsx-et-orchestration.md)

## Contexte

Le contrat `privacy/v1` (SOC-07, lot 0) agit sur un **terme** : `find`, `export`, `anonymize` et
`erase` reçoivent la même requête et touchent tout ce qui contient ce terme. Appliqué à l'oubli,
« Martin » anonymiserait tous les Martin de l'organisation. Le lot 6 (PRD §8, RGPD-01 à 05)
construit les écrans qui l'appellent ; aucun appelant n'existe encore.

Décision prise avec Julien le 02/11/2026 : l'export et l'oubli portent sur les **fiches que la
titulaire sélectionne** parmi celles trouvées.

## Décision

1. **Contrat révisé, même nom** (`packages/privacy/src/contract.ts`) — changement incompatible
   accepté par Julien, sans impact puisqu'aucun écran ne l'utilisait :
   - `find({ organizationId, terms })` : `terms` porte un e-mail, un téléphone et/ou un nom ;
     chaque module renvoie des **fiches** `{ module, kind, recordId, label, fields }` (champs
     personnels trouvés, pour que la titulaire reconnaisse la personne) ;
   - les opérations suivantes (export, aperçu et exécution de l'oubli, liste des personnes à
     purger) reçoivent des **références de fiches** et s'ajoutent au contrat story par story ;
   - chaque module reste seul à lire et écrire ses données (ADR 0011) : le hub ne voit que les
     fiches renvoyées.
2. **Orchestration** : le module hub porte les demandes (RGPD-04), les preuves et l'écran ;
   l'appel aux modules vit dans `apps/symbola/lib/privacy/` (comme `lib/import/`), avec un délai
   par module : un module en erreur ou trop lent rend le résultat **incomplet**, jamais vide.
3. **Recherche** : correspondance insensible à la casse et aux accents sur les champs
   personnels déclarés au registre ; téléphone comparé sur ses seuls chiffres (indicatif +33
   ramené à 0) ; champs libres importés (`imported_fields`) inclus. Jamais d'élément d'essai.
4. **Archive d'export** : ZIP écrit sur `node:zlib` (aucune dépendance, même principe que le
   lecteur de l'ADR 0022), stocké en privé, téléchargé par lien signé temporaire.

   *Précisé à la réalisation (RGPD-02)* : l'export **n'ajoute aucune opération au contrat**. Il
   reprend les fiches renvoyées par `find` et `related` (champs personnels et données de
   contexte ; une fiche trouvée directement est complétée des champs de sa vue « données
   liées »), après avoir **relancé la recherche côté serveur** avec les mêmes termes : seules
   des fiches réellement trouvées dans l'organisation peuvent être exportées, et un module qui
   ne répond pas bloque l'export (jamais un export incomplet). L'archive contient
   `donnees.json` (format `symbola.privacy-export/v1`), un CSV par module (une ligne par champ,
   intitulés techniques stables, cellules neutralisées comme à l'import) et le PDF lisible.
   Fichiers gardés le nombre de jours réglé par l'Admin (7 par défaut, comme un import en
   cours), puis effacés par la purge horaire ; chaque téléchargement passe par un lien signé de
   5 minutes, demandé au moment du clic.

## Conséquences

- Le hub n'agit jamais « en aveugle » sur un terme : chaque suppression ou anonymisation vise une
  fiche que la titulaire a vue et cochée.
- Chaque module ajoute à son implémentation les opérations du contrat au fil des stories ; un
  module non souscrit n'est pas interrogé (dégradation propre).
- Si un module devient une app autonome, ses opérations deviennent des routes
  `/v1/privacy/...` sans changer l'écran du hub.
