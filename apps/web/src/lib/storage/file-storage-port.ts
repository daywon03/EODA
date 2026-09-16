export type SignedUrlOptions = {
  expiresInSeconds?: number;
  disposition?: "inline" | "attachment";
  filename?: string;
};

// Port de stockage fichiers (Dependency Inversion) — le métier ne dépend jamais
// directement d'un SDK de stockage externe. cf. specs/02-architecture-technique.md §1.
export interface FileStoragePort {
  upload(key: string, content: Buffer, contentType: string): Promise<void>;
  getSignedDownloadUrl(key: string, options?: SignedUrlOptions): Promise<string>;
  // Lecture directe du contenu — jamais une URL signée : sert les cas où le métier
  // a besoin du buffer lui-même (ex. réintégrer une image d'origine dans un .docx
  // généré, cf. markdown-to-docx-service.ts), pas d'un lien à transmettre au navigateur.
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}
