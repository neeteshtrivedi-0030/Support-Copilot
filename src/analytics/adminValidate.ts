import Joi from 'joi';
import { Department, UserRole } from '../enum';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const userListQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  search: Joi.string().allow('').trim().optional(),
  role: Joi.string()
    .valid(...Object.values(UserRole))
    .optional(),
  department: Joi.string()
    .valid(...Object.values(Department).filter((d) => d !== Department.PUBLIC))
    .optional(),
  isActive: Joi.boolean().optional(),
});

export const documentIdParam = Joi.object({
  id: Joi.string().pattern(objectIdRegex).required().messages({
    'string.pattern.base': 'Invalid document ID format',
    'any.required': 'Document ID is required',
  }),
});

export const adminValidations = {
  userListQuery,
  documentIdParam,
};

export default adminValidations;
