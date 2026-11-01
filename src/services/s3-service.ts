import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import { config } from '../config';

export interface PresignedUploadResult {
  uploadUrl: string;
  s3Uri: string;
  s3Key: string;
  expiresInSeconds: number;
  objectLockEnabled: boolean;
  objectLockMode?: 'GOVERNANCE' | 'COMPLIANCE';
  retentionUntilDate?: string;
  isMock: boolean;
}

export interface PresignedDownloadResult {
  downloadUrl: string;
  expiresInSeconds: number;
  isMock: boolean;
}

export class S3Service {
  private static s3ClientInstance: S3Client | null = null;

  public static isConfigured(): boolean {
    return Boolean(
      config.awsAccessKeyId &&
      config.awsSecretAccessKey &&
      config.s3WormBucket &&
      config.s3WormBucket !== 'your-compliance-worm-bucket'
    );
  }

  private static getClient(): S3Client {
    if (!this.s3ClientInstance) {
      const clientConfig: any = {
        region: config.awsRegion,
      };

      if (config.awsAccessKeyId && config.awsSecretAccessKey) {
        clientConfig.credentials = {
          accessKeyId: config.awsAccessKeyId,
          secretAccessKey: config.awsSecretAccessKey,
        };
      }

      if (config.s3Endpoint) {
        clientConfig.endpoint = config.s3Endpoint;
        clientConfig.forcePathStyle = true; // Required for MinIO / LocalStack
      }

      this.s3ClientInstance = new S3Client(clientConfig);
    }
    return this.s3ClientInstance;
  }

  /**
   * Generates a time-limited Presigned Upload URL for controlled regulatory evidence.
   * Enforces S3 Object Lock (WORM) and SHA-256 integrity when live AWS is configured.
   * Fallbacks safely to local simulation in non-cloud dev/test environments.
   */
  public static async generatePresignedUploadUrl(options: {
    organizationId: string;
    fileName: string;
    mimeType: string;
    sha256Checksum: string;
    retentionYears?: number;
  }): Promise<PresignedUploadResult> {
    const { organizationId, fileName, mimeType, sha256Checksum } = options;
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const year = new Date().getFullYear();
    const uniqueId = crypto.randomUUID();
    const s3Key = `evidence/${organizationId}/${year}/${uniqueId}-${sanitizedFileName}`;
    const s3Uri = `s3://${config.s3WormBucket}/${s3Key}`;
    const expiresInSeconds = 900; // 15 minutes per standard regulatory window

    const retentionYears = options.retentionYears || config.s3RetentionYears || 10;
    const retainUntil = new Date();
    retainUntil.setFullYear(retainUntil.getFullYear() + retentionYears);
    const retentionUntilDateStr = retainUntil.toISOString();

    if (this.isConfigured()) {
      const client = this.getClient();
      const commandInput: any = {
        Bucket: config.s3WormBucket,
        Key: s3Key,
        ContentType: mimeType,
      };

      // Base64 SHA-256 for AWS SDK v3 Checksum header
      if (sha256Checksum && sha256Checksum.length === 64) {
        commandInput.ChecksumSHA256 = Buffer.from(sha256Checksum, 'hex').toString('base64');
      }

      // 21 CFR § 820.180 & FDA QMSR WORM Retention
      if (config.s3ObjectLockEnabled) {
        commandInput.ObjectLockMode = config.s3ObjectLockMode;
        commandInput.ObjectLockRetainUntilDate = retainUntil;
      }

      const command = new PutObjectCommand(commandInput);
      const uploadUrl = await getSignedUrl(client, command, { expiresIn: expiresInSeconds });

      return {
        uploadUrl,
        s3Uri,
        s3Key,
        expiresInSeconds,
        objectLockEnabled: config.s3ObjectLockEnabled,
        objectLockMode: config.s3ObjectLockEnabled ? config.s3ObjectLockMode : undefined,
        retentionUntilDate: config.s3ObjectLockEnabled ? retentionUntilDateStr : undefined,
        isMock: false,
      };
    }

    // Local / Development fallback simulation
    const mockHost = `http://${config.host === '0.0.0.0' ? '127.0.0.1' : config.host}:${config.port}`;
    return {
      uploadUrl: `${mockHost}/api/v1/documents/mock-upload/${encodeURIComponent(s3Key)}`,
      s3Uri,
      s3Key,
      expiresInSeconds,
      objectLockEnabled: false,
      retentionUntilDate: retentionUntilDateStr,
      isMock: true,
    };
  }

  /**
   * Generates a time-limited Presigned Download URL for controlled regulatory evidence.
   */
  public static async generatePresignedDownloadUrl(
    s3Key: string,
    fileName?: string
  ): Promise<PresignedDownloadResult> {
    const expiresInSeconds = 900;

    if (this.isConfigured()) {
      const client = this.getClient();
      const command = new GetObjectCommand({
        Bucket: config.s3WormBucket,
        Key: s3Key,
        ResponseContentDisposition: fileName ? `attachment; filename="${fileName}"` : undefined,
      });

      const downloadUrl = await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
      return {
        downloadUrl,
        expiresInSeconds,
        isMock: false,
      };
    }

    const mockHost = `http://${config.host === '0.0.0.0' ? '127.0.0.1' : config.host}:${config.port}`;
    return {
      downloadUrl: `${mockHost}/api/v1/documents/mock-download/${encodeURIComponent(s3Key)}`,
      expiresInSeconds,
      isMock: true,
    };
  }

  /**
   * Cryptographically validates byte-level SHA-256 checksum of an uploaded file.
   */
  public static verifyChecksum(buffer: Buffer, expectedSha256: string): boolean {
    const actualHash = crypto.createHash('sha256').update(buffer).digest('hex');
    return actualHash.toLowerCase() === expectedSha256.toLowerCase();
  }
}
