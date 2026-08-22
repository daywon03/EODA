import { describe, it, expect } from "vitest";
import { S3StorageAdapter } from "./s3-storage-adapter";

// ─────────────────────────────────────────────────────────────────────────────
// Ce que ce fichier verrouille : l'ADRESSAGE. Rien d'autre.
//
// Supabase Storage ne sert que l'adressage par chemin (`https://hôte/bucket/clé`).
// Le SDK AWS, laissé à son défaut, construit `https://bucket.hôte/clé` — un
// sous-domaine qui n'existe pas. Le symptôme n'est pas une erreur de configuration
// lisible : c'est un échec DNS au premier dépôt de document, en production, devant
// le client. Exactement le défaut que `production-profile.ts` a été écrit pour
// éviter, sous une autre forme.
//
// `forcePathStyle: true` est donc un choix dont dépend le fonctionnement, pas une
// préférence de style — et un choix dont rien ne dépend mécaniquement se perd au
// premier refactor (Règle zéro). Ce test le rend impossible à retirer sans échouer.
//
// Aucun réseau : la signature d'une URL S3 est un calcul local. C'est la seule
// vérification honnête possible sans bucket provisionné.
// ─────────────────────────────────────────────────────────────────────────────

const CREDENTIALS = {
  endpoint: "https://abcdefghijklm.supabase.co/storage/v1/s3",
  region: "eu-west-1",
  bucket: "eoda-documents",
  accessKeyId: "cle-de-test",
  secretAccessKey: "secret-de-test",
};

describe("S3StorageAdapter — adressage", () => {
  it("place le bucket dans le chemin, jamais dans le sous-domaine", async () => {
    const adapter = new S3StorageAdapter(CREDENTIALS);

    const url = new URL(await adapter.getSignedDownloadUrl("2026/08/document.pdf"));

    expect(url.hostname).toBe("abcdefghijklm.supabase.co");
    expect(url.pathname).toBe("/storage/v1/s3/eoda-documents/2026/08/document.pdf");
  });

  it("ne préfixe pas l'hôte du nom du bucket (défaut du SDK AWS)", async () => {
    const adapter = new S3StorageAdapter(CREDENTIALS);

    const url = new URL(await adapter.getSignedDownloadUrl("document.pdf"));

    expect(url.hostname).not.toContain("eoda-documents");
  });
});

describe("S3StorageAdapter — URL de téléchargement signée", () => {
  it("signe avec la région et les identifiants fournis, pas un défaut AWS", async () => {
    const adapter = new S3StorageAdapter(CREDENTIALS);

    const url = new URL(await adapter.getSignedDownloadUrl("document.pdf"));

    expect(url.searchParams.get("X-Amz-Credential")).toContain("cle-de-test");
    expect(url.searchParams.get("X-Amz-Credential")).toContain("eu-west-1");
    expect(url.searchParams.get("X-Amz-Signature")).toBeTruthy();
  });

  it("expire en 5 minutes par défaut", async () => {
    const adapter = new S3StorageAdapter(CREDENTIALS);

    const url = new URL(await adapter.getSignedDownloadUrl("document.pdf"));

    expect(url.searchParams.get("X-Amz-Expires")).toBe("300");
  });

  it("respecte une expiration explicite", async () => {
    const adapter = new S3StorageAdapter(CREDENTIALS);

    const url = new URL(
      await adapter.getSignedDownloadUrl("document.pdf", { expiresInSeconds: 60 })
    );

    expect(url.searchParams.get("X-Amz-Expires")).toBe("60");
  });

  it("force le téléchargement par défaut et encode le nom d'origine", async () => {
    const adapter = new S3StorageAdapter(CREDENTIALS);

    const url = new URL(
      await adapter.getSignedDownloadUrl("cle-interne", {
        filename: "Projet d'établissement 2026.pdf",
      })
    );

    const disposition = url.searchParams.get("response-content-disposition");
    expect(disposition).toContain("attachment");
    // Le nom d'origine ne doit jamais arriver brut dans l'URL : espaces et
    // apostrophes y casseraient l'en-tête (cf. lib/security/upload-validation-service).
    expect(disposition).toContain("Projet%20d'%C3%A9tablissement%202026.pdf");
    expect(disposition).not.toContain("Projet d'établissement");
  });

  it("permet l'affichage en ligne quand c'est demandé", async () => {
    const adapter = new S3StorageAdapter(CREDENTIALS);

    const url = new URL(
      await adapter.getSignedDownloadUrl("cle-interne", { disposition: "inline" })
    );

    expect(url.searchParams.get("response-content-disposition")).toBe("inline");
  });
});
