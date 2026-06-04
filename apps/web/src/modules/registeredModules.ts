import { companiesModule } from '../../../../modules/companies/frontend/src/module';
import { tendersModule } from '../../../../modules/tenders/frontend/src/module';
import type { FrontendModuleDefinition } from './types';

export const registeredModules: FrontendModuleDefinition[] = [tendersModule, companiesModule];

export const registeredModuleTranslations = registeredModules.map((module) => module.translations);
