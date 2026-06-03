import type React from 'react';
import type { TranslationResources } from '../i18n/translations';

export interface FrontendModuleDefinition {
  code: string;
  routePath: string;
  Component: React.ComponentType;
  translations: TranslationResources;
}

