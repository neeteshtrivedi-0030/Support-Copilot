import { Request, Response } from 'express';
import { BaseController } from '../controllers/baseController';
import { adminService } from './adminService';
import { authService } from '../auth/authService';
import { UserRole } from '../enum';

export class AdminController extends BaseController {
  public getUsers = async (req: Request, res: Response): Promise<Response> => {
    try {
      const result = await adminService.listUsers(req.query);
      return res.success(result, req.__('USERS_FETCHED'));
    } catch (error) {
      return res.serverError(null, req.__('GENERAL_ERROR'), error);
    }
  };

  public createUser = async (req: Request, res: Response): Promise<Response> => {
    try {
      const { name, email, password, department, role } = req.body;

      const existingUser = await authService.findUserByEmail(email);
      if (existingUser) {
        return res.warn(null, req.__('EMAIL_EXISTS'));
      }

      const user = await authService.createUser({
        name,
        email,
        password,
        department,
        role: role || UserRole.EMPLOYEE,
      });

      return res.success(authService.sanitizeUser(user), req.__('REGISTER_SUCCESS'));
    } catch (error) {
      return res.serverError(null, req.__('REGISTER_FAILED'), error);
    }
  };

  public getAnalytics = async (req: Request, res: Response): Promise<Response> => {
    try {
      const analytics = await adminService.getAnalytics();
      return res.success(analytics, req.__('ANALYTICS_FETCHED'));
    } catch (error) {
      return res.serverError(null, req.__('GENERAL_ERROR'), error);
    }
  };

  public deleteDocument = async (req: Request, res: Response): Promise<Response> => {
    try {
      const id = String(req.params.id);

      const deleted = await adminService.deleteDocument(id, req.user!._id.toString(), {
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });

      if (!deleted) {
        return res.notFound(null, req.__('DOCUMENT_NOT_FOUND', id));
      }

      return res.success(null, req.__('DOCUMENT_DELETED'));
    } catch (error) {
      return res.serverError(null, req.__('GENERAL_ERROR'), error);
    }
  };
}

export const adminController = new AdminController();
export default adminController;
