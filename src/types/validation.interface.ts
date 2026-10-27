import Joi from 'joi';

export type ValidationField = 'body' | 'params' | 'query' | 'headers';

export interface IValidationSchemaMap {
  body?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
  headers?: Joi.ObjectSchema;
}

export type ValidationSchemaMap = IValidationSchemaMap;
