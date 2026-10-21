import Joi from 'joi';
import {
  Department,
  DocumentAccessLevel,
  DocumentFileType,
  DocumentProcessingStatus,
} from '../enum';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const upload = Joi.object({
  name: Joi.string().min(2).max(255).trim().optional(),
  department: Joi.string()
    .valid(...Object.values(Department))
    .required()
    .messages({
      'any.required': 'Department is required',
      'any.only': 'Invalid department specified',
    }),
  accessLevel: Joi.string()
    .valid(...Object.values(DocumentAccessLevel))
    .default(DocumentAccessLevel.DEPARTMENT_ONLY)
    .optional(),
});

export const listQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  search: Joi.string().allow('').trim().optional(),
  department: Joi.string()
    .valid(...Object.values(Department))
    .optional(),
  status: Joi.string()
    .valid(...Object.values(DocumentProcessingStatus))
    .optional(),
  type: Joi.string()
    .valid(...Object.values(DocumentFileType))
    .optional(),
  accessLevel: Joi.string()
    .valid(...Object.values(DocumentAccessLevel))
    .optional(),
});

export const documentIdParam = Joi.object({
  id: Joi.string().pattern(objectIdRegex).required().messages({
    'string.pattern.base': 'Invalid document ID format',
    'any.required': 'Document ID is required',
  }),
});

export const documentValidations = {
  upload,
  listQuery,
  documentIdParam,
};

export default documentValidations;
