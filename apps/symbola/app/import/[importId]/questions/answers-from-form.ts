// Lot 71c (HUB-14) — le formulaire de l'étape « Questions » → les réponses. Rien n'est supposé : une
// question sans réponse est absente. Le hub les valide encore (Zod strict) ; les identifiants cités le
// sont par les services.
import { z } from "zod";
import { CONTRACTS_ANSWERS, DEPOSITS_PAID_ANSWERS, EVENT_STAGE_ANSWERS, PAST_DUE_TASKS_ANSWERS, type ImportAnswers } from "@symbola/contracts";
import { isValidId } from "../../access";

const rowIndexes = z.array(z.coerce.number().int().nonnegative()).max(5000);
const isoDate = z.iso.date();

function oneOf<T extends string>(values: readonly T[], value: FormDataEntryValue | null): T | undefined {
  return values.find((candidate) => candidate === value);
}

function optionalId(value: FormDataEntryValue | null): string | undefined {
  const text = typeof value === "string" ? value.trim() : "";
  return text !== "" && isValidId(text) ? text : undefined;
}

export function answersFromForm(formData: FormData): ImportAnswers {
  const answers: ImportAnswers = {};
  const target = formData.get("targetEvent");
  if (target === "new") {
    const date = String(formData.get("newEventDate") ?? "").trim();
    answers.newEvent = { name: String(formData.get("newEventName") ?? "").trim().slice(0, 200), eventDate: isoDate.safeParse(date).success ? date : null };
  } else {
    const id = optionalId(target);
    if (id) answers.targetEvent = id;
  }
  const deposits = oneOf(DEPOSITS_PAID_ANSWERS, formData.get("depositsPaid"));
  if (deposits) {
    const paid = rowIndexes.safeParse(formData.getAll("depositPaidRow"));
    answers.depositsPaid = deposits === "some" ? { answer: deposits, paidRows: paid.success ? paid.data : [] } : { answer: deposits };
  }
  const contracts = oneOf(CONTRACTS_ANSWERS, formData.get("contracts"));
  if (contracts) {
    const signed = rowIndexes.safeParse(formData.getAll("contractSignedRows").flatMap((value) => String(value).split(",")).filter((value) => value !== ""));
    answers.contracts = contracts === "per_line" ? { answer: contracts, signedRows: signed.success ? signed.data : [] } : { answer: contracts };
  }
  const eventTypeId = optionalId(formData.get("eventTypeId"));
  if (eventTypeId) answers.eventTypeId = eventTypeId;
  const stage = oneOf(EVENT_STAGE_ANSWERS, formData.get("eventStage"));
  if (stage) answers.eventStage = stage;
  const source = optionalId(formData.get("prospectSourceId"));
  if (source) answers.prospectSourceId = source;
  if (formData.get("nameCase") === "keep") answers.nameCase = "keep";
  const pastDue = oneOf(PAST_DUE_TASKS_ANSWERS, formData.get("pastDueTasks"));
  if (pastDue) {
    const date = String(formData.get("pastDueDate") ?? "").trim();
    answers.pastDueTasks = pastDue === "redate" && isoDate.safeParse(date).success ? { answer: pastDue, date } : { answer: pastDue };
  }
  return answers;
}
