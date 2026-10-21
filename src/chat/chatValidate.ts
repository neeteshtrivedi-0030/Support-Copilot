import Joi from 'joi';
import { Department, FeedbackRating } from '../enum';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const chat = Joi.object({
  message: Joi.string().trim().min(1).max(5000).required().messages({
    'string.empty': 'Message cannot be empty',
    'any.required': 'Message is required',
    'string.max': 'Message cannot exceed 5000 characters',
  }),
  conversationId: Joi.string().pattern(objectIdRegex).optional().messages({
    'string.pattern.base': 'Invalid conversation ID format',
  }),
  department: Joi.string()
    .valid(...Object.values(Department))
    .optional(),
  stream: Joi.boolean().optional().default(false),
});

export const search = Joi.object({
  query: Joi.string().trim().min(1).max(500).required().messages({
    'string.empty': 'Search query cannot be empty',
    'any.required': 'Search query is required',
    'string.max': 'Search query cannot exceed 500 characters',
  }),
  department: Joi.string()
    .valid(...Object.values(Department))
    .optional(),
  limit: Joi.number().integer().min(1).max(50).default(5).optional(),
  minScore: Joi.number().min(0).max(1).optional(),
});

export const feedback = Joi.object({
  messageId: Joi.string().pattern(objectIdRegex).required().messages({
    'string.pattern.base': 'Invalid message ID format',
    'any.required': 'Message ID is required',
  }),
  conversationId: Joi.string().pattern(objectIdRegex).required().messages({
    'string.pattern.base': 'Invalid conversation ID format',
    'any.required': 'Conversation ID is required',
  }),
  rating: Joi.string()
    .valid(...Object.values(FeedbackRating))
    .required()
    .messages({
      'any.only': 'Feedback rating must be either "helpful" or "not_helpful"',
      'any.required': 'Feedback rating is required',
    }),
  comment: Joi.string().trim().max(500).allow('').optional().messages({
    'string.max': 'Feedback comment cannot exceed 500 characters',
  }),
});

export const chatValidations = {
  chat,
  search,
  feedback,
};

export default chatValidations;
