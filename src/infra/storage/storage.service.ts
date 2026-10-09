import { Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";

import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  NotFound,
  PutBucketCorsCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PinoLogger } from "nestjs-pino";

import { AppConfig } from "@/config/config.module.js";

/** How long signed upload and download links work. */
export const SIGNED_URL_TTL_SECONDS = 15 * 60;

export type StoredObject = { size: number; contentType: string | null };

/**
 * Object storage (any S3-compatible service). The API only signs URLs: file
 * bytes go straight between the browser and storage (docs/17-file-uploads.md).
 */
@Injectable()
export class StorageService implements OnModuleInit, OnModuleDestroy {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(
    private readonly config: AppConfig,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(StorageService.name);
    this.bucket = config.get("S3_BUCKET");
    const accessKeyId = config.get("S3_ACCESS_KEY_ID");
    const secretAccessKey = config.get("S3_SECRET_ACCESS_KEY");
    this.client = new S3Client({
      region: config.get("S3_REGION"),
      endpoint: config.get("S3_ENDPOINT"),
      forcePathStyle: config.get("S3_FORCE_PATH_STYLE"),
      // Without keys the SDK uses its default chain (instance or task role on AWS)
      credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
    });
  }

  /** A URL the browser PUTs the file to. Content type and length are part of the signature. */
  signUpload(key: string, contentType: string, size: number): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: size,
    });
    return getSignedUrl(this.client, command, {
      expiresIn: SIGNED_URL_TTL_SECONDS,
      signableHeaders: new Set(["content-type", "content-length"]),
    });
  }

  /** A short-lived download link that saves the file under its original name. */
  signDownload(key: string, filename: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    });
    return getSignedUrl(this.client, command, { expiresIn: SIGNED_URL_TTL_SECONDS });
  }

  /** Size and type of a stored object, or null if nothing was uploaded there. */
  async head(key: string): Promise<StoredObject | null> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return { size: result.ContentLength ?? 0, contentType: result.ContentType ?? null };
    } catch (error) {
      if (error instanceof NotFound || isNotFound(error)) return null;
      throw error;
    }
  }

  /** The first `length` bytes of an object (fewer if it's smaller). */
  async readStart(key: string, length: number): Promise<Uint8Array> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key, Range: `bytes=0-${length - 1}` }),
    );
    return result.Body ? await result.Body.transformToByteArray() : new Uint8Array();
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  /**
   * Development and tests only: create the bucket and let the frontend upload to it.
   * In production, buckets and their CORS rules are infrastructure, not app code.
   */
  async onModuleInit(): Promise<void> {
    if (this.config.isProduction) return;
    try {
      await this.ensureBucket();
    } catch (error) {
      // Don't block startup: only uploads need storage
      this.logger.warn({ err: error, bucket: this.bucket }, "Storage not ready; uploads will fail");
    }
  }

  onModuleDestroy(): void {
    this.client.destroy();
  }

  private async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch (error) {
      if (!isNotFound(error)) throw error;
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    }
    await this.client.send(
      new PutBucketCorsCommand({
        Bucket: this.bucket,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedOrigins: this.config.get("CORS_ORIGINS"),
              AllowedMethods: ["PUT", "GET", "HEAD"],
              AllowedHeaders: ["content-type"],
              ExposeHeaders: ["etag"],
              MaxAgeSeconds: 3000,
            },
          ],
        },
      }),
    );
  }
}

const isNotFound = (error: unknown): boolean =>
  error instanceof Error &&
  (error.name === "NotFound" ||
    error.name === "NoSuchBucket" ||
    (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404);
