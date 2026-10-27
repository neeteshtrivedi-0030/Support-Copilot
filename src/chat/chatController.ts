import { Request, Response } from 'express';
import { BaseController } from '../controllers/baseController';
import { chatService } from './chatService';

export class ChatController extends BaseController {
  public chat = async (req: Request, res: Response): Promise<Response | void> => {
    try {
      const user = req.user!;
      const isStream = Boolean(req.body.stream);

      if (isStream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        try {
          await chatService.processChatStream(user, req.body, (event) => {
            res.write(`data: ${JSON.stringify(event)}\n\n`);
          });
          res.end();
          return;
        } catch (streamErr) {
          const error = streamErr as Error;
          res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
          res.end();
          return;
        }
      }

      try {
        const result = await chatService.processChat(user, req.body);
        return res.success(result, req.__('CHAT_RESPONSE_SUCCESS'));
      } catch (err) {
        const error = err as Error;
        if (error.name === 'NotFoundError') {
          return res.notFound(null, req.__('CONVERSATION_NOT_FOUND', req.body.conversationId));
        }
        throw error;
      }
    } catch (error) {
      return res.serverError(null, req.__('GENERAL_ERROR'), error);
    }
  };

  public search = async (req: Request, res: Response): Promise<Response> => {
    try {
      const result = await chatService.processSearch(req.user!, req.body);
      return res.success(result, req.__('SEARCH_SUCCESS'));
    } catch (error) {
      return res.serverError(null, req.__('GENERAL_ERROR'), error);
    }
  };

  public feedback = async (req: Request, res: Response): Promise<Response> => {
    try {
      const result = await chatService.submitFeedback(req.user!, req.body);
      return res.success(
        {
          id: result._id.toString(),
          messageId: result.messageId.toString(),
          conversationId: result.conversationId.toString(),
          rating: result.rating,
        },
        req.__('FEEDBACK_RECORDED') || 'Feedback recorded successfully.'
      );
    } catch (err) {
      const error = err as Error;
      if (error.name === 'NotFoundError') {
        return res.notFound(null, req.__('NOT_FOUND'));
      }
      return res.serverError(null, req.__('GENERAL_ERROR'), error);
    }
  };
}

export const chatController = new ChatController();
export default chatController;
