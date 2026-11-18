// Lot 41 (FAC-10) — pour les tests : un PDF minimal mais lisible (catalogue, page, table de
// références, trailer), que l'émission complète en Factur-X comme le PDF de l'app. Les rendus
// factices des tests d'intégration le renvoient à la place du vrai PDF.
export function minimalPdf(label = "test"): Buffer {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << >> >>",
  ];
  let body = `%PDF-1.4\n%\xFF\xFF\xFF\xFF\n% ${label.replace(/[^\x20-\x7e]/g, "")}\n`;
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body, "latin1"));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(body, "latin1");
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, "latin1");
}
