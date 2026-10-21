import Joi from 'joi';
import { Platform } from '../enum';
import { languages } from '../i18n';

export const headerValidation = Joi.object().keys({
  'x-platform': Joi.string()
    .valid(...Object.values(Platform))
    .default(Platform.WEB)
    .messages({
      'any.only': `Platform must be one of: ${Object.values(Platform).join(', ')}`,
    }),
  'x-app-version': Joi.string()
    .regex(/^[\d]+\.[\d]+\.[\d]+$/, 'Semantic Version')
    .default('1.0.0')
    .messages({
      'string.pattern.name': 'App version must follow semantic versioning (e.g. 1.0.0)',
    }),
  'accept-language': Joi.string()
    .valid(...Object.keys(languages))
    .default('en')
    .messages({
      'any.only': `Language must be one of: ${Object.keys(languages).join(', ')}`,
    }),
});

export const commonValidations = {
  header: headerValidation,
};

export default commonValidations;
