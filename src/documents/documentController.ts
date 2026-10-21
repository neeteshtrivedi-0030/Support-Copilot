import { Request, Response } from 'express';
import { BaseController } from '../controllers/baseController';
import { documentService } from './documentService';
import { Department, DocumentAccessLevel } from '../enum';

export class DocumentController extends BaseController {
  public upload = async (req: Request, res: Response): Promise<Response> => {
    try {
      if (!req.file) {
        return res.badRequest(null, req.__('FILE_REQUIRED'));
      }

      const { name, department, accessLevel } = req.body;

      try {
        const result = await documentService.uploadAndCreateDocument({
          file: req.file,
          name,
          department: department as Department,
          accessLevel: accessLevel as DocumentAccessLevel,
          userId: req.user!._id.toString(),
        });

        return res.success(
          {
            document: result.document,
            fileUrl: result.fileUrl,
          },
          req.__('DOCUMENT_UPLOADED')
        );
      } catch (err: unknown) {
        const error = err as Error;
        if (error.name === 'DuplicateDocumentError') {
          return res.warn(null, req.__('DOCUMENT_ALREADY_EXISTS'));
        }
        throw error;
      }
    } catch (error) {
      return res.serverError(null, req.__('GENERAL_ERROR'), error);
    }
  };

  public list = async (req: Request, res: Response): Promise<Response> => {
    try {
      const user = req.user!;
      const result = await documentService.listDocuments(
        {
          role: user.role,
          department: user.department,
        },
        req.query
      );

      return res.success(result, req.__('DOCUMENTS_FETCHED'));
    } catch (error) {
      return res.serverError(null, req.__('GENERAL_ERROR'), error);
    }
  };

  public getById = async (req: Request, res: Response): Promise<Response> => {
    try {
      const id = String(req.params.id);
      const user = req.user!;

      try {
        const document = await documentService.getDocumentById(id, {
          role: user.role,
          department: user.department,
        });

        if (!document) {
          return res.notFound(null, req.__('DOCUMENT_NOT_FOUND', id));
        }

        return res.success({ document }, req.__('DOCUMENT_FETCHED'));
      } catch (err: unknown) {
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

  public download = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = String(req.params.id);
      const user = req.user!;

      const document = await documentService.getDocumentById(id, {
        role: user.role,
        department: user.department,
      });

      if (!document) {
        res.notFound(null, req.__('DOCUMENT_NOT_FOUND', id));
        return;
      }

      if (document.downloadUrl) {
        res.redirect(document.downloadUrl);
        return;
      }

      res.redirect(document.fileUrl);
    } catch (error) {
      res.serverError(null, req.__('GENERAL_ERROR'), error);
    }
  };

  public delete = async (req: Request, res: Response): Promise<Response> => {
    try {
      const id = String(req.params.id);

      const deleted = await documentService.deleteDocument(id);
      if (!deleted) {
        return res.notFound(null, req.__('DOCUMENT_NOT_FOUND', id));
      }

      return res.success(null, req.__('DOCUMENT_DELETED'));
    } catch (error) {
      return res.serverError(null, req.__('GENERAL_ERROR'), error);
    }
  };

  public retry = async (req: Request, res: Response): Promise<Response> => {
    try {
      const id = String(req.params.id);

      const document = await documentService.retryDocumentProcessing(id);
      if (!document) {
        return res.notFound(null, req.__('DOCUMENT_NOT_FOUND', id));
      }

      return res.success({ document }, req.__('DOCUMENT_RETRY_INITIATED'));
    } catch (error) {
      return res.serverError(null, req.__('GENERAL_ERROR'), error);
    }
  };
}

export const documentController = new DocumentController();
export default documentController;
