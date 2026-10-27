// ─────────────────────────────────────────────────────────────────────────────
// ARCHIVE ZIP SANS COMPRESSION — service PUR, sans dépendance.
//
// Sert à l'export groupé des contrats signés sur la tablette (« exporter pour tous
// les clients », 26/10/2026) : le fichier se fabrique dans le navigateur, les PDF ne
// passent jamais par le serveur. Les PDF sont déjà compressés : la méthode « stocké »
// (0) suffit et garde ce module court et vérifiable. Noms en UTF-8 (bit 11).
// ─────────────────────────────────────────────────────────────────────────────

export type ZipFile = { name: string; data: Uint8Array; modifiedAt: Date };

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// Date et heure au format MS-DOS (heure locale, résolution de 2 secondes).
function dosDateTime(date: Date): { time: number; day: number } {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    day: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

class ByteWriter {
  private chunks: Uint8Array[] = [];
  length = 0;
  bytes(data: Uint8Array): void {
    this.chunks.push(data);
    this.length += data.length;
  }
  u16(value: number): void {
    this.bytes(new Uint8Array([value & 0xff, (value >>> 8) & 0xff]));
  }
  u32(value: number): void {
    this.bytes(new Uint8Array([value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff]));
  }
  concat(): Uint8Array {
    const out = new Uint8Array(this.length);
    let offset = 0;
    for (const chunk of this.chunks) {
      out.set(chunk, offset);
      offset += chunk.length;
    }
    return out;
  }
}

// Deux fichiers ne portent jamais le même nom dans l'archive : le second devient
// « nom (2).pdf ». Deux contrats de la même personne le même jour existent (une
// erreur refaite) et aucun ne doit écraser l'autre à l'extraction.
export function uniqueNames(names: readonly string[]): string[] {
  const used = new Set<string>();
  return names.map((name) => {
    if (!used.has(name)) {
      used.add(name);
      return name;
    }
    const dot = name.lastIndexOf(".");
    const [base, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ""];
    let n = 2;
    while (used.has(`${base} (${n})${ext}`)) n += 1;
    const unique = `${base} (${n})${ext}`;
    used.add(unique);
    return unique;
  });
}

export function buildStoredZip(files: readonly ZipFile[]): Uint8Array {
  const encoder = new TextEncoder();
  const names = uniqueNames(files.map((file) => file.name.replace(/^[/\\]+/, "").replace(/\.\.[/\\]/g, "")));
  const out = new ByteWriter();
  const central = new ByteWriter();

  files.forEach((file, index) => {
    const name = encoder.encode(names[index]!);
    const crc = crc32(file.data);
    const { time, day } = dosDateTime(file.modifiedAt);
    const offset = out.length;

    out.u32(0x04034b50);
    out.u16(20); // version nécessaire
    out.u16(0x0800); // noms en UTF-8
    out.u16(0); // stocké
    out.u16(time);
    out.u16(day);
    out.u32(crc);
    out.u32(file.data.length);
    out.u32(file.data.length);
    out.u16(name.length);
    out.u16(0);
    out.bytes(name);
    out.bytes(file.data);

    central.u32(0x02014b50);
    central.u16(20);
    central.u16(20);
    central.u16(0x0800);
    central.u16(0);
    central.u16(time);
    central.u16(day);
    central.u32(crc);
    central.u32(file.data.length);
    central.u32(file.data.length);
    central.u16(name.length);
    central.u16(0);
    central.u16(0);
    central.u16(0);
    central.u16(0);
    central.u32(0);
    central.u32(offset);
    central.bytes(name);
  });

  const centralOffset = out.length;
  const centralBytes = central.concat();
  out.bytes(centralBytes);
  out.u32(0x06054b50);
  out.u16(0);
  out.u16(0);
  out.u16(files.length);
  out.u16(files.length);
  out.u32(centralBytes.length);
  out.u32(centralOffset);
  out.u16(0);
  return out.concat();
}
