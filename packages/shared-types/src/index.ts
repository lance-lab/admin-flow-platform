export type PermissionCode =
  | 'platform.modules.read'
  | 'platform.modules.manage'
  | 'tenders.read'
  | 'tenders.create'
  | 'tenders.update'
  | 'tenders.delete'
  | 'tenders.evaluate'
  | 'tenders.documents.generate'
  | 'tenders.organizations.verify'
  | 'tenders.admin.schema.manage';

export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  locale: Locale;
  permissions: PermissionCode[];
}

export interface PlatformModule {
  code: string;
  name: string;
  description: string;
  routePath: string;
  requiredPermission: PermissionCode;
  enabled: boolean;
}

export interface LoginResponse {
  token: string;
  user: AuthenticatedUser;
}

export type Locale = 'sk' | 'en';
