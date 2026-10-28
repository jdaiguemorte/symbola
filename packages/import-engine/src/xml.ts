// Analyse XML restreinte au vocabulaire des quelques parties d'un .xlsx lues
// par l'import (ADR 0022) : attributs d'une balise, texte, entités. Toute
// DTD est refusée (pas d'entité externe ni d'expansion d'entités).
import { ReadError } from "./types";

export function assertNoDoctype(xml: string): void {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new ReadError("malformed");
}

export function attributes(tagSource: string): Map<string, string> {
  const result = new Map<string, string>();
  const pattern = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  for (const match of tagSource.matchAll(pattern)) {
    result.set(match[1] as string, decodeEntities(match[2] ?? match[3] ?? ""));
  }
  return result;
}

// Attribut sans tenir compte du préfixe d'espace de noms (« r:id », « x:id »).
export function attributeIgnoringPrefix(attrs: Map<string, string>, localName: string): string | undefined {
  for (const [name, value] of attrs) {
    if (name === localName || name.endsWith(`:${localName}`)) return value;
  }
  return undefined;
}

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (_, entity: string) => {
    switch (entity) {
      case "amp":
        return "&";
      case "lt":
        return "<";
      case "gt":
        return ">";
      case "quot":
        return '"';
      case "apos":
        return "'";
      default: {
        const code = entity.startsWith("#x") ? Number.parseInt(entity.slice(2), 16) : Number.parseInt(entity.slice(1), 10);
        return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : "";
      }
    }
  });
}

// Office Open XML échappe les caractères non représentables en « _xHHHH_ ».
export function decodeOoxmlEscapes(text: string): string {
  return text.replace(/_x([0-9a-fA-F]{4})_/g, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)));
}

// Texte d'un élément riche (<si>, <is>) : concaténation des <t>, sans les
// indications phonétiques (<rPh>).
export function richText(xml: string): string {
  const withoutPhonetic = xml.replace(/<(?:\w+:)?rPh\b[\s\S]*?<\/(?:\w+:)?rPh>/g, "");
  let text = "";
  for (const match of withoutPhonetic.matchAll(/<(?:\w+:)?t\b[^>]*?(?:\/>|>([\s\S]*?)<\/(?:\w+:)?t>)/g)) {
    text += match[1] ?? "";
  }
  return decodeOoxmlEscapes(decodeEntities(text));
}
