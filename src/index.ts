/**
 * Atlassian Forge Invocation Handler & Resolver
 * Provides Custom UI bridge integration and context mapping for AuditTrail AI
 */

export interface ForgeContext {
  accountId?: string;
  cloudId?: string;
  installationId?: string;
  extension?: {
    issue?: {
      id: string;
      key: string;
    };
    project?: {
      id: string;
      key: string;
    };
  };
}

export async function run(event: any, context: any) {
  const { payload } = event;
  const forgeCtx: ForgeContext = {
    accountId: context?.accountId,
    cloudId: context?.cloudId,
    installationId: context?.installationId,
    extension: context?.extension,
  };

  switch (payload?.call) {
    case 'getContext':
      return {
        context: forgeCtx,
        appVersion: '2.1.0',
        environment: process.env.NODE_ENV || 'development',
      };

    case 'getBackendBaseUrl':
      return {
        baseUrl: process.env.REMOTE_BACKEND_URL || 'http://localhost:3000',
      };

    default:
      return {
        success: true,
        handled: payload?.call || 'ping',
        context: forgeCtx,
      };
  }
}
