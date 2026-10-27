import { Request, Response, NextFunction } from 'express';
import Joi, { ValidationOptions } from 'joi';
import { env } from '../config/env';

import { ValidationField, ValidationSchemaMap } from '../types';

const assignValidatedValue = (req: Request, field: ValidationField, value: unknown): void => {
  try {
    req[field] = value as never;
  } catch {
    Object.defineProperty(req, field, {
      value,
      writable: true,
      configurable: true,
      enumerable: true,
    });
  }
};

export const validate = (
  schema: Joi.ObjectSchema | ValidationSchemaMap,
  field: ValidationField = 'body',
  options: ValidationOptions = {}
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (Joi.isSchema(schema)) {
        const mergedOptions: ValidationOptions = {
          abortEarly: true,
          ...(field === 'headers' ? { allowUnknown: true } : {}),
          ...options,
        };

        const { error, value } = schema.validate(req[field], mergedOptions);

        if (!error) {
          assignValidatedValue(req, field, value);
          return next();
        }

        const message = error.details[0]?.message.replace(/['"]/g, '') || 'Validation failed';

        if (env.NODE_ENV === 'development') {
          console.error(`[Validation] ${req.method} ${req.originalUrl} (${field}):`, message);
        }

        res.warn(null, message);
        return;
      }

      const schemaMap = schema as ValidationSchemaMap;

      if (schemaMap.headers) {
        const { error, value } = schemaMap.headers.validate(req.headers, {
          abortEarly: true,
          allowUnknown: true,
          ...options,
        });
        if (error) {
          const message = error.details[0]?.message.replace(/['"]/g, '') || 'Validation failed';
          res.warn(null, message);
          return;
        }
        assignValidatedValue(req, 'headers', value);
      }

      if (schemaMap.params) {
        const { error, value } = schemaMap.params.validate(req.params, {
          abortEarly: true,
          ...options,
        });
        if (error) {
          const message = error.details[0]?.message.replace(/['"]/g, '') || 'Validation failed';
          res.warn(null, message);
          return;
        }
        assignValidatedValue(req, 'params', value);
      }

      if (schemaMap.query) {
        const { error, value } = schemaMap.query.validate(req.query, {
          abortEarly: true,
          ...options,
        });
        if (error) {
          const message = error.details[0]?.message.replace(/['"]/g, '') || 'Validation failed';
          res.warn(null, message);
          return;
        }
        assignValidatedValue(req, 'query', value);
      }

      if (schemaMap.body) {
        const { error, value } = schemaMap.body.validate(req.body, {
          abortEarly: true,
          ...options,
        });
        if (error) {
          const message = error.details[0]?.message.replace(/['"]/g, '') || 'Validation failed';
          res.warn(null, message);
          return;
        }
        assignValidatedValue(req, 'body', value);
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};
