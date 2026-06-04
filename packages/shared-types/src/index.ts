export type PermissionCode =
  | 'platform.modules.read'
  | 'platform.modules.manage'
  | 'platform.users.read'
  | 'platform.users.manage'
  | 'companies.read'
  | 'companies.create'
  | 'companies.update'
  | 'companies.delete'
  | 'companies.verify'
  | 'tenders.read'
  | 'tenders.create'
  | 'tenders.update'
  | 'tenders.delete'
  | 'tenders.evaluate'
  | 'tenders.documents.generate'
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

export interface PlatformRole {
  code: string;
  name: string;
}

export interface PlatformUser {
  id: string;
  email: string;
  displayName: string;
  locale: Locale;
  active: boolean;
  passwordSet: boolean;
  roles: PlatformRole[];
  createdAt: string;
}
