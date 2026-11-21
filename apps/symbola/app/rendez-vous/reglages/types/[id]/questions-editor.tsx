"use client";

// Lot 64 (RDV-01 ; D7 ; maquette M7) — questions préalables en liste éditable : une ligne par question
// posée (aucun bloc vide), ouverte en place, une seule à la fois ; réponse courte ou un choix ; les
// choix en pastilles, ajoutées une à une (douze au plus) ; « Obligatoire » ; l'ordre se change par les
// flèches. Les champs gardent les noms lus par l'action (question{n}Label, Kind, Choices, Id, Required).
import { useTranslations } from "next-intl";
import { useState } from "react";
import { APPOINTMENT_QUESTIONS_MAX, type AppointmentQuestion } from "@symbola/contracts";

type Draft = { id: string; label: string; kind: "text" | "choice"; choices: string[]; required: boolean };

const CHOICES_MAX = 12;

export function QuestionsEditor({ questions }: { questions: AppointmentQuestion[] }) {
  const t = useTranslations("Appointments");
  const [list, setList] = useState<Draft[]>(questions.map((question) => ({ id: question.id, label: question.label, kind: question.kind, choices: question.choices, required: question.required === true })));
  const [open, setOpen] = useState<number | null>(null);
  const [newChoice, setNewChoice] = useState("");

  const update = (index: number, patch: Partial<Draft>) => setList(list.map((item, position) => (position === index ? { ...item, ...patch } : item)));
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    const next = [...list];
    [next[index], next[target]] = [next[target]!, next[index]!];
    setList(next);
    setOpen(open === index ? target : open === target ? index : open);
  };
  const add = () => {
    if (list.length >= APPOINTMENT_QUESTIONS_MAX) return;
    setList([...list, { id: "", label: "", kind: "text", choices: [], required: false }]);
    setOpen(list.length);
    setNewChoice("");
  };
  const addChoice = (index: number) => {
    const value = newChoice.trim();
    const item = list[index]!;
    if (!value || item.choices.includes(value) || item.choices.length >= CHOICES_MAX) return;
    update(index, { choices: [...item.choices, value] });
    setNewChoice("");
  };

  return (
    <div className="questions-editor">
      {list.length === 0 ? <p className="text-ink-muted">{t("questionsEmpty")}</p> : null}
      <ol className="questions-list">
        {list.map((question, index) => {
          const isOpen = open === index;
          const name = question.label || t("questionUntitled", { number: index + 1 });
          return (
            <li key={index} className={isOpen ? "questions-item questions-item-open" : "questions-item"}>
              {/* Les valeurs partent toujours, la ligne ouverte ou non. */}
              <input type="hidden" name={`question${index}Id`} value={question.id} />
              <input type="hidden" name={`question${index}Kind`} value={question.kind} />
              <input type="hidden" name={`question${index}Choices`} value={question.choices.join("\n")} />
              {question.required ? <input type="hidden" name={`question${index}Required`} value="on" /> : null}
              {isOpen ? null : <input type="hidden" name={`question${index}Label`} value={question.label} />}
              <div className="questions-item-head">
                <span className="questions-move">
                  <button type="button" className="button-ghost" aria-label={t("questionMoveUp", { label: name })} disabled={index === 0} onClick={() => move(index, -1)}>
                    ↑
                  </button>
                  <button type="button" className="button-ghost" aria-label={t("questionMoveDown", { label: name })} disabled={index === list.length - 1} onClick={() => move(index, 1)}>
                    ↓
                  </button>
                </span>
                <span className="questions-item-label">{name}</span>
                <span className="questions-item-kind">{question.kind === "choice" ? t("questionKindChoiceCount", { count: question.choices.length }) : t("questionKindText")}</span>
                <span className="questions-item-required">{question.required ? t("questionRequired") : t("questionOptional")}</span>
                <button type="button" className="button-ghost" aria-expanded={isOpen} aria-label={isOpen ? t("questionCloseFor", { label: name }) : t("questionEditFor", { label: name })} onClick={() => { setOpen(isOpen ? null : index); setNewChoice(""); }}>
                  {isOpen ? t("questionClose") : t("questionEdit")}
                </button>
              </div>
              {isOpen ? (
                <div className="questions-item-body">
                  <div className="questions-item-grid">
                    <label>
                      {t("questionText")}
                      <input type="text" name={`question${index}Label`} value={question.label} maxLength={200} required onChange={(event) => update(index, { label: event.target.value })} />
                    </label>
                    <div role="radiogroup" aria-label={t("questionKind")} className="segmented-choice">
                      {(["text", "choice"] as const).map((kind) => (
                        <button key={kind} type="button" role="radio" aria-checked={question.kind === kind} onClick={() => update(index, { kind })}>
                          {kind === "text" ? t("questionKindText") : t("questionKindChoice")}
                        </button>
                      ))}
                    </div>
                  </div>
                  {question.kind === "choice" ? (
                    <div className="questions-choices">
                      <span className="text-label font-medium">{t("questionChoicesTitle")}</span>
                      <ul className="choice-chips">
                        {question.choices.map((choice) => (
                          <li key={choice} className="choice-chip">
                            {choice}
                            <button type="button" className="button-ghost" aria-label={t("questionChoiceRemove", { choice })} onClick={() => update(index, { choices: question.choices.filter((item) => item !== choice) })}>
                              ×
                            </button>
                          </li>
                        ))}
                      </ul>
                      {question.choices.length < CHOICES_MAX ? (
                        <div className="choice-add">
                          <input
                            type="text"
                            value={newChoice}
                            maxLength={120}
                            aria-label={t("questionChoiceNew")}
                            placeholder={t("questionChoiceNew")}
                            onChange={(event) => setNewChoice(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                addChoice(index);
                              }
                            }}
                          />
                          <button type="button" className="button-secondary" onClick={() => addChoice(index)}>
                            {t("questionChoiceAdd")}
                          </button>
                        </div>
                      ) : null}
                      {question.choices.length < 2 ? <p className="text-label text-attention">{t("questionChoicesMin")}</p> : null}
                    </div>
                  ) : null}
                  <div className="questions-item-foot">
                    <label className="checkbox">
                      <input type="checkbox" checked={question.required} onChange={(event) => update(index, { required: event.target.checked })} />
                      {t("questionRequiredLabel")}
                    </label>
                    <button type="button" className="button-danger" onClick={() => { setList(list.filter((_, position) => position !== index)); setOpen(null); }}>
                      {t("questionRemove")}
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
      {list.length < APPOINTMENT_QUESTIONS_MAX ? (
        <button type="button" className="button-secondary" onClick={add}>
          {t("questionAdd")}
        </button>
      ) : (
        <p className="text-label text-ink-muted">{t("questionsMaxReached")}</p>
      )}
    </div>
  );
}
