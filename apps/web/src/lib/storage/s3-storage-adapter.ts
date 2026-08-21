import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { FileStoragePort, SignedUrlOptions } from "./file-storage-port";

// Implémentation S3-compatible, hébergement Europe — jamais un bucket US par
// défaut. Fournisseur retenu le 21/08/2026 : Supabase Storage, même projet que la
// base (cf. specs/02-architecture-technique.md §1).
export class S3StorageAdapter implements FileStoragePort {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(options: {
    endpoint: string;
    region: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
  }) {
    this.bucket = options.bucket;
    this.client = new S3Client({
      endpoint: options.endpoint,
      region: options.region,
      // Adressage par chemin (`https://hôte/bucket/clé`) et non par sous-domaine
      // (`https://bucket.hôte/clé`). Le SDK AWS choisit le second par défaut, que
      // Supabase Storage — comme la plupart des implémentations S3-compatibles
      // auto-hébergées — ne sert pas : chaque envoi partirait sur un domaine
      // inexistant. Scaleway et OVHcloud acceptent les deux, donc ce réglage ne
      // ferme aucune porte si le fournisseur change.
      forcePathStyle: true,
      credentials: {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
      },
    });
  }

  async upload(key: string, content: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: content,
        ContentType: contentType,
      })
    );
  }

  async getSignedDownloadUrl(key: string, options: SignedUrlOptions = {}): Promise<string> {
    const { expiresInSeconds = 300, disposition = "attachment", filename } = options;
    const responseContentDisposition = filename
      ? `${disposition}; filename="${encodeURIComponent(filename)}"`
      : disposition;

    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentDisposition: responseContentDisposition,
      }),
      { expiresIn: expiresInSeconds }
    );
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
