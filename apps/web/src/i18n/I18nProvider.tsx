import React, { createContext, useContext, useMemo, useState } from 'react';
import type { Locale } from '../../../../packages/shared-types/src';
import {
  defaultLocale,
  locales,
  mergeTranslations,
  translate,
  type TranslationKey,
  type TranslationResources
} from './translations';

export type { TranslationKey } from './translations';

const LOCALE_KEY = 'admin-flow-locale';

interface I18nContextValue {
  locale: Locale;
  locales: Record<Locale, string>;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function readStoredLocale(): Locale {
  const stored = window.localStorage.getItem(LOCALE_KEY);
  return stored === 'en' || stored === 'sk' ? stored : defaultLocale;
}

export function I18nProvider({
  children,
  resources = []
}: {
  children: React.ReactNode;
  resources?: TranslationResources[];
}) {
  const [locale, setLocaleState] = useState<Locale>(readStoredLocale);
  const translations = useMemo(() => mergeTranslations(resources), [resources]);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      locales,
      setLocale(nextLocale) {
        window.localStorage.setItem(LOCALE_KEY, nextLocale);
        setLocaleState(nextLocale);
      },
      t(key, params) {
        return translate(translations, locale, key, params);
      }
    }),
    [locale, translations]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error('useI18n must be used inside I18nProvider');
  }

  return context;
}
