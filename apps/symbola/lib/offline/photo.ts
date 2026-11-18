// Lot 51 (JRJ-06, JRJ-07, JRJ-09 ; ADR 0091) — réduire une photo sur le téléphone avant de la mettre
// en file : le plus grand côté ramené à la limite des données de départ (day-of.json), en JPEG. La
// photo est ensuite contrôlée à l'arrivée sur le serveur (type, taille, antivirus, ADR 0027).

export function scaledSize(width: number, height: number, maxSide: number): { width: number; height: number } {
  const longest = Math.max(width, height, 1);
  const ratio = Math.min(1, maxSide / longest);
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) };
}

// Dans le navigateur : décode, réduit, réencode en JPEG. Si le navigateur ne sait pas décoder le
// fichier, il part tel quel (le serveur le refusera s'il n'est pas une image).
export async function reducePhoto(file: Blob, maxSide: number): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const size = scaledSize(bitmap.width, bitmap.height, maxSide);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return blob ?? file;
  } catch {
    return file;
  }
}
