// Lot 70a (CHR-02 ; A1, A3, A4) — les collègues proposés dans « Qui s'en charge » : la personne qui regarde
// d'abord (« Vous »), puis la titulaire et les Planners actives par leur nom (prénom et nom, sinon le début
// de l'adresse), puis les accès retirés (gardés pour les tâches restées à leur nom, A4). Le Comptable n'en
// fait pas partie. Les noms ne quittent jamais l'équipe (SEC-20) : ni portail, ni lien, ni journal.
import { listTeam, personFullName } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import type { TaskMemberOption } from "@/app/events/[id]/task-responsible";

export async function taskMemberOptions(organizationId: string, meId: string): Promise<TaskMemberOption[]> {
  const team = (await listTeam(appDatabase(), organizationId)).filter((member) => member.role === "owner" || member.role === "member");
  const options = team.map((member) => ({ id: member.id, name: personFullName(member), me: member.id === meId, removed: member.disabledAt !== null }));
  return options.sort((a, b) => Number(b.me) - Number(a.me) || Number(a.removed) - Number(b.removed) || a.name.localeCompare(b.name, "fr"));
}
