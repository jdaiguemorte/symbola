// Client ClamAV minimal (SOC-08) : protocole INSTREAM de clamd en TCP brut
// (node:net, sans dépendance supplémentaire). Protocole documenté par
// ClamAV : "zINSTREAM\0" puis des blocs (longueur 4 octets big-endian +
// données), terminés par un bloc de longueur 0, puis lecture de la
// réponse ("stream: OK" ou "stream: <signature> FOUND").
import { Socket } from "node:net";

export type ScanResult = { infected: false } | { infected: true; signature: string };

const MAX_CHUNK_SIZE = 1024 * 1024; // 1 Mio, bien sous la limite par défaut de clamd

export function scanBuffer(
  buffer: Buffer,
  options: { host: string; port: number; timeoutMs?: number },
): Promise<ScanResult> {
  return new Promise((resolve, reject) => {
    const socket = new Socket();
    let response = "";

    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error("Délai dépassé en attendant la réponse de ClamAV"));
    }, options.timeoutMs ?? 15_000);

    socket.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    socket.on("data", (data) => {
      response += data.toString("utf8");
    });

    socket.on("close", () => {
      clearTimeout(timeout);
      const trimmed = response.trim().replace(/\0+$/, "");
      if (trimmed.endsWith("OK")) {
        resolve({ infected: false });
        return;
      }
      const match = /stream:\s*(.+?)\s+FOUND/.exec(trimmed);
      if (match?.[1]) {
        resolve({ infected: true, signature: match[1] });
        return;
      }
      reject(new Error(`Réponse ClamAV inattendue : "${trimmed}"`));
    });

    socket.connect(options.port, options.host, () => {
      socket.write("zINSTREAM\0");

      for (let offset = 0; offset < buffer.length; offset += MAX_CHUNK_SIZE) {
        const chunk = buffer.subarray(offset, offset + MAX_CHUNK_SIZE);
        const lengthPrefix = Buffer.alloc(4);
        lengthPrefix.writeUInt32BE(chunk.length, 0);
        socket.write(lengthPrefix);
        socket.write(chunk);
      }

      const endMarker = Buffer.alloc(4); // longueur 0 = fin de flux
      socket.write(endMarker);
      socket.end();
    });
  });
}
