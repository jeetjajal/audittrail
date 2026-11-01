import dotenv from 'dotenv';
dotenv.config();

export interface AppConfig {
  port: number;
  host: string;
  databaseUrl: string;
  forgeAppId: string;
  forgeAppAri: string;
  forgeJwksUrl: string;
  vertexAiProjectId?: string;
  vertexAiLocation: string;
  s3WormBucket: string;
  awsRegion: string;
  awsAccessKeyId?: string;
  awsSecretAccessKey?: string;
  s3Endpoint?: string;
  s3ObjectLockEnabled: boolean;
  s3ObjectLockMode: 'GOVERNANCE' | 'COMPLIANCE';
  s3RetentionYears: number;
  environment: 'development' | 'staging' | 'production' | 'test';
}

export const config: AppConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  databaseUrl: process.env.DATABASE_URL || 'postgres://audittrail_app:secret@localhost:5432/audittrail_db',
  forgeAppId: process.env.FORGE_APP_ID || 'c8b9d31e-4512-4cf0-8ef5-9a842f1b0a11',
  forgeAppAri: process.env.FORGE_APP_ARI || 'ari:cloud:ecosystem::app/c8b9d31e-4512-4cf0-8ef5-9a842f1b0a11',
  // Official Atlassian Forge Invocation Token (FIT) JWKS endpoint
  forgeJwksUrl: process.env.FORGE_JWKS_URL || 'https://forge.cdn.prod.atlassian-dev.net/.well-known/jwks.json',
  vertexAiProjectId: process.env.VERTEX_AI_PROJECT_ID,
  vertexAiLocation: process.env.VERTEX_AI_LOCATION || 'us-central1',
  s3WormBucket: process.env.S3_WORM_BUCKET || 'audittrail-compliance-records-worm',
  awsRegion: process.env.AWS_REGION || 'us-east-1',
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  s3Endpoint: process.env.S3_ENDPOINT,
  s3ObjectLockEnabled: process.env.S3_OBJECT_LOCK_ENABLED === 'true',
  s3ObjectLockMode: (process.env.S3_OBJECT_LOCK_MODE || 'GOVERNANCE') as 'GOVERNANCE' | 'COMPLIANCE',
  s3RetentionYears: parseInt(process.env.S3_RETENTION_YEARS || '10', 10),
  environment: (process.env.NODE_ENV as AppConfig['environment']) || 'development',
};
