import { inflateRawSync } from "node:zlib";
import type { InflateRaw } from "./zip-read";

// Décompression d'une entrée de .docx CÔTÉ SERVEUR (la tablette, elle, passe
// DecompressionStream). Plafonnée : une entrée qui se décompresse au-delà de 200 Mo est
// refusée — la taille annoncée par l'archive peut mentir (office-archive-guard).
const MAX_OUTPUT = 200 * 1024 * 1024;

export const nodeInflateRaw: InflateRaw = async (data) => new Uint8Array(inflateRawSync(data, { maxOutputLength: MAX_OUTPUT }));
