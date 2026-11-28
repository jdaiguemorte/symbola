-- Lot 74b (EVT-01, CHR-01, UX-06 ; spécification du lot 74, § 4.1 et § 6.2 ; B7, L74-D3 tranchée le 27/11/2026) :
-- une tâche « à dater ». Pour un mariage créé « Signé, en préparation », une échéance du rétroplanning déjà
-- passée et laissée sans réponse n'est ni faite ni en retard : due_date garde une date technique (la date de
-- l'évènement) pour les tris, la contrainte NOT NULL et les lectures existantes, et due_date_known dit qu'elle
-- n'est pas une échéance. Même choix que done_date_known du lot 71a (0220). Aucune étape de données ; aucune
-- donnée personnelle. Compatible avec l'image précédente (ARC-14) : colonne ajoutée, vraie d'office.
ALTER TABLE "events"."event_tasks" ADD COLUMN "due_date_known" boolean DEFAULT true NOT NULL;
