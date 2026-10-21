import fs from 'fs';
import path from 'path';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  PutBucketPolicyCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import { env } from '../config/env';

export class StorageService {
  private s3Client: S3Client;
  private bucket: string;
  private s3Available = false;
  private uploadsDir: string;

  constructor() {
    this.bucket = env.S3_BUCKET;
    this.uploadsDir = path.join(process.cwd(), 'uploads');
    this.s3Client = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY,
        secretAccessKey: env.S3_SECRET_KEY,
      },
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
    });
  }

  public async ensureBucketExists(): Promise<boolean> {
    try {
      await this.s3Client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      await this.ensureBucketPolicy();
      this.s3Available = true;
      return true;
    } catch {
      try {
        await this.s3Client.send(new CreateBucketCommand({ Bucket: this.bucket }));
        await this.ensureBucketPolicy();
        this.s3Available = true;
        return true;
      } catch {
        this.s3Available = false;
        return false;
      }
    }
  }

  private async ensureBucketPolicy(): Promise<void> {
    try {
      const policy = JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'PublicReadGetObject',
            Effect: 'Allow',
            Principal: '*',
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${this.bucket}/*`],
          },
        ],
      });
      await this.s3Client.send(
        new PutBucketPolicyCommand({
          Bucket: this.bucket,
          Policy: policy,
        })
      );
    } catch (policyErr) {
      console.warn(`[StorageService] S3 bucket policy warning: ${(policyErr as Error).message}`);
    }
  }

  public async uploadFile(key: string, buffer: Buffer, mimeType: string): Promise<string> {
    const bucketReady = await this.ensureBucketExists();
    if (bucketReady) {
      try {
        const command = new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: mimeType,
        });
        await this.s3Client.send(command);
        this.s3Available = true;
        return key;
      } catch (s3Error) {
        console.warn(
          `[StorageService] S3 upload warning: ${(s3Error as Error).message}. Using local disk storage fallback.`
        );
        this.s3Available = false;
      }
    }

    await this.saveLocalFile(key, buffer);
    return key;
  }

  public async deleteFile(key: string): Promise<void> {
    if (this.s3Available) {
      try {
        const command = new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        });
        await this.s3Client.send(command);
      } catch (err) {
        console.warn(`[StorageService] S3 delete warning for key ${key}:`, err);
      }
    }

    const localPath = path.join(this.uploadsDir, key);
    if (fs.existsSync(localPath)) {
      try {
        await fs.promises.unlink(localPath);
      } catch (unlinkErr) {
        console.warn(`[StorageService] Local delete warning for ${localPath}:`, unlinkErr);
      }
    }
  }

  public async getFileStream(key: string): Promise<Readable> {
    const localPath = path.join(this.uploadsDir, key);
    if (fs.existsSync(localPath)) {
      return fs.createReadStream(localPath);
    }

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    const response = await this.s3Client.send(command);
    return response.Body as Readable;
  }

  public async getPresignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    if (this.s3Available) {
      try {
        const command = new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        });
        return await getSignedUrl(this.s3Client, command, { expiresIn: expiresInSeconds });
      } catch {
        return this.getPublicUrl(key);
      }
    }
    return this.getPublicUrl(key);
  }

  public getPublicUrl(key: string): string {
    if (this.s3Available) {
      const baseUrl = env.S3_PUBLIC_URL.replace(/\/+$/, '');
      return `${baseUrl}/${this.bucket}/${key}`;
    }
    const siteUrl = (env.SITE_URL || `http://localhost:${env.PORT}`).replace(/\/+$/, '');
    return `${siteUrl}/uploads/${key}`;
  }

  private async saveLocalFile(key: string, buffer: Buffer): Promise<void> {
    const localPath = path.join(this.uploadsDir, key);
    await fs.promises.mkdir(path.dirname(localPath), { recursive: true });
    await fs.promises.writeFile(localPath, buffer);
  }
}

export const storageService = new StorageService();
export default storageService;
