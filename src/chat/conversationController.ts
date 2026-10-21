import { Request, Response } from 'express';
import { BaseController } from '../controllers/baseController';
import { conversationService } from './conversationService';

export class ConversationController extends BaseController {
  public list = async (req: Request, res: Response): Promise<Response> => {
    try {
      const result = await conversationService.listUserConversations(
        req.user!._id.toString(),
        req.query
      );

      return res.success(result, req.__('CONVERSATIONS_FETCHED'));
    } catch (error) {
      return res.serverError(null, req.__('GENERAL_ERROR'), error);
    }
  };

  public getById = async (req: Request, res: Response): Promise<Response> => {
    try {
      const id = String(req.params.id);
      const user = req.user!;

      try {
        const result = await conversationService.getConversationById(
          id,
          user._id.toString(),
          user.role === 'admin'
        );

        if (!result) {
          return res.notFound(null, req.__('CONVERSATION_NOT_FOUND', id));
        }

        return res.success(result, req.__('CONVERSATION_FETCHED'));
      } catch (err) {
        const error = err as Error;
        if (error.name === 'ForbiddenError') {
          return res.forbidden(null, req.__('FORBIDDEN'));
        }
        throw error;
      }
    } catch (error) {
      return res.serverError(null, req.__('GENERAL_ERROR'), error);
    }
  };

  public delete = async (req: Request, res: Response): Promise<Response> => {
    try {
      const id = String(req.params.id);
      const user = req.user!;

      try {
        const deleted = await conversationService.deleteConversation(
          id,
          user._id.toString(),
          user.role === 'admin'
        );

        if (!deleted) {
          return res.notFound(null, req.__('CONVERSATION_NOT_FOUND', id));
        }

        return res.success(null, req.__('CONVERSATION_DELETED'));
      } catch (err) {
        const error = err as Error;
        if (error.name === 'ForbiddenError') {
          return res.forbidden(null, req.__('FORBIDDEN'));
        }
        throw error;
      }
    } catch (error) {
      return res.serverError(null, req.__('GENERAL_ERROR'), error);
    }
  };

  public rename = async (req: Request, res: Response): Promise<Response> => {
    try {
      const id = String(req.params.id);
      const { title } = req.body;
      const user = req.user!;

      try {
        const updated = await conversationService.renameConversation(
          id,
          user._id.toString(),
          title,
          user.role === 'admin'
        );

        if (!updated) {
          return res.notFound(null, req.__('CONVERSATION_NOT_FOUND', id));
        }

        return res.success(
          {
            id: updated._id.toString(),
            _id: updated._id.toString(),
            title: updated.title,
            updatedAt: updated.updatedAt,
          },
          req.__('CONVERSATION_UPDATED') || 'Conversation renamed successfully.'
        );
      } catch (err) {
        const error = err as Error;
        if (error.name === 'ForbiddenError') {
          return res.forbidden(null, req.__('FORBIDDEN'));
        }
        throw error;
      }
    } catch (error) {
      return res.serverError(null, req.__('GENERAL_ERROR'), error);
    }
  };
}

export const conversationController = new ConversationController();
export default conversationController;
