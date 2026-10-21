import Joi from 'joi';
import { Department, UserRole } from '../enum';

export const register = Joi.object().keys({
  name: Joi.string().trim().min(2).max(100).required().messages({
    'string.empty': 'Name cannot be empty',
    'string.min': 'Name must be at least 2 characters long',
    'string.max': 'Name cannot exceed 100 characters',
    'any.required': 'Name is required',
  }),
  email: Joi.string().trim().email().lowercase().required().messages({
    'string.empty': 'Email cannot be empty',
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required',
  }),
  password: Joi.string().min(6).max(128).required().messages({
    'string.empty': 'Password cannot be empty',
    'string.min': 'Password must be at least 6 characters long',
    'string.max': 'Password cannot exceed 128 characters',
    'any.required': 'Password is required',
  }),
  department: Joi.string()
    .valid(...Object.values(Department).filter((d) => d !== Department.PUBLIC))
    .required()
    .messages({
      'any.only': `Department must be one of: ${Object.values(Department)
        .filter((d) => d !== Department.PUBLIC)
        .join(', ')}`,
      'any.required': 'Department is required for document access control',
    }),
  role: Joi.string()
    .valid(...Object.values(UserRole))
    .default(UserRole.EMPLOYEE)
    .messages({
      'any.only': 'Role must be either admin or employee',
    }),
});

export const login = Joi.object().keys({
  email: Joi.string().trim().email().lowercase().required().messages({
    'string.empty': 'Email cannot be empty',
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required',
  }),
  password: Joi.string().required().messages({
    'string.empty': 'Password cannot be empty',
    'any.required': 'Password is required',
  }),
  deviceToken: Joi.string().optional().allow('', null),
});

export const refreshToken = Joi.object().keys({
  refreshToken: Joi.string().required().messages({
    'string.empty': 'Refresh token cannot be empty',
    'any.required': 'Refresh token is required',
  }),
});

export const logout = Joi.object().keys({
  refreshToken: Joi.string().optional().allow('', null).messages({
    'string.empty': 'Refresh token cannot be empty',
  }),
});

export const authValidations = {
  register,
  login,
  logout,
  refreshToken,
};

export default authValidations;
