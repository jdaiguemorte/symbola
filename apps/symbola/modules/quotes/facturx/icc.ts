// Lot 41 (FAC-10, D3, ADR 0080) — profil de couleur sRGB du PDF/A-3, écrit par l'app : un PDF/A
// qui emploie des couleurs RGB déclare l'espace de couleur de sortie par un profil ICC incorporé
// (« OutputIntent »). Le profil est construit ici, octet par octet, d'après la norme ICC v2 (en-tête
// de 128 octets, table des balises, puis balises) et les valeurs publiques de sRGB (CEI 61966-2-1)
// adaptées à l'illuminant D50 : aucun fichier tiers ni licence à suivre. Fonction pure, testée.

const D50 = [0.9642, 1.0, 0.8249] as const;
// Primaires de sRGB adaptées à D50 (Bradford), valeurs publiées par l'ICC.
const RED = [0.4360747, 0.2225045, 0.0139322] as const;
const GREEN = [0.3850649, 0.7168786, 0.0971045] as const;
const BLUE = [0.1430804, 0.0606169, 0.7141733] as const;
const CURVE_POINTS = 1024;

export const SRGB_DESCRIPTION = "sRGB IEC61966-2.1";

function s15Fixed16(value: number): number {
  return Math.round(value * 65536);
}

function xyzTag(values: readonly [number, number, number]): Buffer {
  const tag = Buffer.alloc(20);
  tag.write("XYZ ", 0, "ascii");
  values.forEach((value, index) => tag.writeInt32BE(s15Fixed16(value), 8 + index * 4));
  return tag;
}

// Courbe de transfert de sRGB, échantillonnée (« curv », 1 024 points sur 16 bits).
function curveTag(): Buffer {
  const tag = Buffer.alloc(12 + CURVE_POINTS * 2);
  tag.write("curv", 0, "ascii");
  tag.writeUInt32BE(CURVE_POINTS, 8);
  for (let index = 0; index < CURVE_POINTS; index += 1) {
    const encoded = index / (CURVE_POINTS - 1);
    const linear = encoded <= 0.04045 ? encoded / 12.92 : ((encoded + 0.055) / 1.055) ** 2.4;
    tag.writeUInt16BE(Math.round(linear * 65535), 12 + index * 2);
  }
  return tag;
}

// « desc » de la v2 : description ASCII, puis les parties Unicode et ScriptCode, vides.
function descriptionTag(text: string): Buffer {
  const ascii = Buffer.from(`${text}\0`, "ascii");
  const tag = Buffer.alloc(12 + ascii.length + 8 + 3 + 67);
  tag.write("desc", 0, "ascii");
  tag.writeUInt32BE(ascii.length, 8);
  ascii.copy(tag, 12);
  return tag;
}

function textTag(text: string): Buffer {
  const ascii = Buffer.from(`${text}\0`, "ascii");
  const tag = Buffer.alloc(8 + ascii.length);
  tag.write("text", 0, "ascii");
  ascii.copy(tag, 8);
  return tag;
}

function pad4(buffer: Buffer): Buffer {
  const rest = buffer.length % 4;
  return rest === 0 ? buffer : Buffer.concat([buffer, Buffer.alloc(4 - rest)]);
}

let cached: Buffer | null = null;

export function srgbIccProfile(): Buffer {
  if (cached) return cached;
  const curve = curveTag();
  const tags: [string, Buffer][] = [
    ["desc", descriptionTag(SRGB_DESCRIPTION)],
    ["cprt", textTag("No copyright, use freely")],
    ["wtpt", xyzTag(D50)],
    ["rXYZ", xyzTag(RED)],
    ["gXYZ", xyzTag(GREEN)],
    ["bXYZ", xyzTag(BLUE)],
    ["rTRC", curve],
    ["gTRC", curve],
    ["bTRC", curve],
  ];
  const tableSize = 4 + tags.length * 12;
  // Les trois courbes identiques partagent les mêmes octets (permis par la norme).
  const blobs: Buffer[] = [];
  const offsets = new Map<Buffer, number>();
  let offset = 128 + tableSize;
  const table = Buffer.alloc(tableSize);
  table.writeUInt32BE(tags.length, 0);
  tags.forEach(([signature, data], index) => {
    let at = offsets.get(data);
    if (at === undefined) {
      at = offset;
      offsets.set(data, at);
      const padded = pad4(data);
      blobs.push(padded);
      offset += padded.length;
    }
    table.write(signature, 4 + index * 12, "ascii");
    table.writeUInt32BE(at, 8 + index * 12);
    table.writeUInt32BE(data.length, 12 + index * 12);
  });

  const header = Buffer.alloc(128);
  header.writeUInt32BE(offset, 0);
  header.writeUInt32BE(0x02100000, 8); // version 2.1
  header.write("mntr", 12, "ascii");
  header.write("RGB ", 16, "ascii");
  header.write("XYZ ", 20, "ascii");
  // Date de création fixe : le profil est le même octet pour octet à chaque émission.
  [2026, 11, 18, 0, 0, 0].forEach((value, index) => header.writeUInt16BE(value, 24 + index * 2));
  header.write("acsp", 36, "ascii");
  header.writeUInt32BE(0, 64); // intention de rendu : perceptuelle
  D50.forEach((value, index) => header.writeInt32BE(s15Fixed16(value), 68 + index * 4));

  cached = Buffer.concat([header, table, ...blobs]);
  return cached;
}
