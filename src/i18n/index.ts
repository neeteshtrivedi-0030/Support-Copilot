import { Request, Response, NextFunction } from 'express';
import en from './locales/en';
import { Platform } from '../enum';
import { LocaleDictionary } from '../types';

export const languages: Record<string, LocaleDictionary> = {
  en,
};

export const getLanguageFromRequest = (req?: Request | void): string => {
  if (!req || !('headers' in req)) {
    return 'en';
  }

  const rawHeader = req.headers['accept-language'] || req.headers['x-language'];

  if (typeof rawHeader === 'string' && rawHeader.trim()) {
    const langCode = rawHeader.split(',')[0].split('-')[0].trim().toLowerCase();
    if (languages[langCode]) {
      return langCode;
    }
  }

  return 'en';
};

export const getPlatformFromRequest = (req?: Request | void): string => {
  if (!req || !('headers' in req)) {
    return Platform.WEB;
  }

  const rawPlatform = req.headers['x-platform'];
  if (typeof rawPlatform === 'string' && rawPlatform.trim()) {
    const plat = rawPlatform.trim().toLowerCase();
    if (Object.values(Platform).includes(plat as Platform)) {
      return plat;
    }
  }

  return Platform.WEB;
};

export const getAppVersionFromRequest = (req?: Request | void): string => {
  if (!req || !('headers' in req)) {
    return '1.0.0';
  }

  const rawVersion = req.headers['x-app-version'];
  if (typeof rawVersion === 'string' && rawVersion.trim()) {
    return rawVersion.trim();
  }

  return '1.0.0';
};

export const translate = (
  language = 'en',
  key: string,
  ...params: (string | number | boolean)[]
): string => {
  const dictionary = languages[language] || languages['en'];
  let message = dictionary[key] || key;

  params.forEach((param, index) => {
    message = message.replace(new RegExp(`\\{${index}\\}`, 'g'), String(param));
  });

  return message;
};

export const __ = function (
  this: Request | void,
  key: string,
  ...params: (string | number | boolean)[]
): string {
  const lang = getLanguageFromRequest(this);
  return translate(lang, key, ...params);
};

export const i18nMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  req.platform = getPlatformFromRequest(req);
  req.appVersion = getAppVersionFromRequest(req);
  req.language = getLanguageFromRequest(req);
  req.__ = __.bind(req);
  next();
};

export default i18nMiddleware;
