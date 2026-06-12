import { aiModule } from '../../../../modules/ai/frontend/src/module';
import { companiesModule } from '../../../../modules/companies/frontend/src/module';
import { tendersModule } from '../../../../modules/tenders/frontend/src/module';
import type { FrontendModuleDefinition } from './types';

export const registeredModules: FrontendModuleDefinition[] = [tendersModule, companiesModule, aiModule];

export const registeredModuleTranslations = registeredModules.map((module) => module.translations);
