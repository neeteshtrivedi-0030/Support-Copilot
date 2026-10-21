import Joi from 'joi';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const listQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(10),
  search: Joi.string().allow('').trim().optional(),
  isArchived: Joi.boolean().optional(),
});

export const conversationIdParam = Joi.object({
  id: Joi.string().pattern(objectIdRegex).required().messages({
    'string.pattern.base': 'Invalid conversation ID format',
    'any.required': 'Conversation ID is required',
  }),
});

export const renameConversation = Joi.object({
  title: Joi.string().trim().min(1).max(150).required().messages({
    'string.empty': 'Conversation title cannot be empty',
    'any.required': 'Conversation title is required',
    'string.max': 'Conversation title cannot exceed 150 characters',
  }),
});

export const conversationValidations = {
  listQuery,
  conversationIdParam,
  renameConversation,
};

export default conversationValidations;
