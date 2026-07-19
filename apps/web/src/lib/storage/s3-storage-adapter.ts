import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { FileStoragePort, SignedUrlOptions } from "./file-storage-port";

// Implémentation S3-compatible, hébergement Europe (Scaleway Object Storage
// ou OVHcloud Object Storage) — jamais un bucket US par défaut.
// cf. .claude/context/... et specs/02-architecture-technique.md §1.
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
