import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import app from '../src/app';
import { env } from '../src/config/env';
import { UserRole, Department, DocumentProcessingStatus, DocumentFileType } from '../src/enum';
import { authService } from '../src/auth/authService';
import { adminService } from '../src/analytics/adminService';
import { documentService } from '../src/documents/documentService';
import {
  User,
  KnowledgeDocument,
  DocumentChunk,
  QueryLog,
  Feedback,
  Message,
  AuditLog,
} from '../src/models';

describe('Admin Endpoints & Service Tests', () => {
  const adminId = new mongoose.Types.ObjectId().toString();
  const employeeId = new mongoose.Types.ObjectId().toString();

  const adminToken = jwt.sign(
    {
      userId: adminId,
      email: 'admin@company.com',
      role: UserRole.ADMIN,
      department: Department.IT,
    },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const employeeToken = jwt.sign(
    {
      userId: employeeId,
      email: 'emp@company.com',
      role: UserRole.EMPLOYEE,
      department: Department.HR,
    },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  beforeEach(() => {
    jest.restoreAllMocks();

    jest.spyOn(authService, 'findUserById').mockImplementation(async (id: string) => {
      if (id === adminId) {
        return {
          _id: new mongoose.Types.ObjectId(adminId),
          name: 'Admin User',
          email: 'admin@company.com',
          role: UserRole.ADMIN,
          department: Department.IT,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as never;
      }
      if (id === employeeId) {
        return {
          _id: new mongoose.Types.ObjectId(employeeId),
          name: 'Regular Employee',
          email: 'emp@company.com',
          role: UserRole.EMPLOYEE,
          department: Department.HR,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as never;
      }
      return null;
    });
  });

  describe('Authorization & Authentication Guards', () => {
    it('should return 401 Unauthorized if x-access-token is missing', async () => {
      const res = await request(app).get('/api/v1/admin/users');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Access token is required');
    });

    it('should return 403 Forbidden if non-admin tries to access GET /api/v1/admin/users', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users')
        .set('x-access-token', employeeToken);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('permission');
    });

    it('should return 403 Forbidden if non-admin tries to access GET /api/v1/admin/analytics', async () => {
      const res = await request(app)
        .get('/api/v1/admin/analytics')
        .set('x-access-token', employeeToken);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should return 403 Forbidden if non-admin tries to access DELETE /api/v1/admin/documents/:id', async () => {
      const validId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .delete(`/api/v1/admin/documents/${validId}`)
        .set('x-access-token', employeeToken);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/admin/users', () => {
    it('should reject invalid query parameters with 400 Warning/Validation error', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users?role=invalid_role')
        .set('x-access-token', adminToken);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('role');
    });

    it('should return paginated list of users for admin', async () => {
      const mockResult = {
        users: [
          {
            id: adminId,
            name: 'Admin User',
            email: 'admin@company.com',
            role: UserRole.ADMIN,
            department: Department.IT,
            isActive: true,
            createdAt: new Date(),
          },
          {
            id: employeeId,
            name: 'Regular Employee',
            email: 'emp@company.com',
            role: UserRole.EMPLOYEE,
            department: Department.HR,
            isActive: true,
            createdAt: new Date(),
          },
        ],
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
      };

      jest.spyOn(adminService, 'listUsers').mockResolvedValue(mockResult);

      const res = await request(app)
        .get('/api/v1/admin/users?page=1&limit=10&search=admin')
        .set('x-access-token', adminToken);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.users).toHaveLength(2);
      expect(res.body.data.total).toBe(2);
      expect(res.body.message).toBe('Users retrieved successfully.');
    });
  });

  describe('GET /api/v1/admin/analytics', () => {
    it('should return complete analytics payload with all required operational and RAG metrics', async () => {
      const mockAnalytics = {
        users: {
          total: 245,
          active: 230,
          inactive: 15,
          byRole: { [UserRole.ADMIN]: 5, [UserRole.EMPLOYEE]: 240 },
          byDepartment: { [Department.ENGINEERING]: 120, [Department.HR]: 35 },
        },
        documents: {
          total: 86,
          byStatus: {
            [DocumentProcessingStatus.PENDING]: 2,
            [DocumentProcessingStatus.PROCESSING]: 1,
            [DocumentProcessingStatus.PROCESSED]: 80,
            [DocumentProcessingStatus.FAILED]: 3,
          },
          byType: {
            [DocumentFileType.PDF]: 60,
            [DocumentFileType.DOCX]: 20,
            [DocumentFileType.TXT]: 6,
          },
          byDepartment: { [Department.HR]: 30, [Department.IT]: 25 },
          totalChunks: 1250,
        },
        queries: {
          totalQuestions: 1320,
          questionsToday: 132,
          successfulQueries: 1190,
          failedQueries: 30,
          noAnswerQueries: 100,
          averageResponseTimeMs: 2800,
          averageResponseTimeSec: 2.8,
          averageSimilarityScore: 0.842,
          retrievalSuccessRate: 90.15,
          noAnswerRate: 7.58,
        },
        feedback: {
          total: 420,
          positive: 390,
          negative: 30,
          positiveFeedbackRate: 92.86,
        },
        mostAskedQuestions: [
          { query: 'What is the laptop replacement policy?', count: 42 },
          { query: 'What is the work from home policy?', count: 38 },
        ],
        mostUsedDocuments: [
          {
            documentId: new mongoose.Types.ObjectId().toString(),
            documentName: 'IT_Hardware_Policy.pdf',
            count: 56,
            department: Department.IT,
          },
        ],
      };

      jest.spyOn(adminService, 'getAnalytics').mockResolvedValue(mockAnalytics);

      const res = await request(app)
        .get('/api/v1/admin/analytics')
        .set('x-access-token', adminToken);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.users.total).toBe(245);
      expect(res.body.data.documents.total).toBe(86);
      expect(res.body.data.queries.averageResponseTimeSec).toBe(2.8);
      expect(res.body.data.queries.retrievalSuccessRate).toBe(90.15);
      expect(res.body.data.feedback.positiveFeedbackRate).toBe(92.86);
      expect(res.body.data.mostAskedQuestions).toHaveLength(2);
      expect(res.body.message).toBe('Admin analytics retrieved successfully.');
    });
  });

  describe('DELETE /api/v1/admin/documents/:id', () => {
    it('should reject invalid document id format with 400 Warning', async () => {
      const res = await request(app)
        .delete('/api/v1/admin/documents/invalid-id')
        .set('x-access-token', adminToken);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid document ID format');
    });

    it('should return 404 when document does not exist', async () => {
      const validId = new mongoose.Types.ObjectId().toString();
      jest.spyOn(adminService, 'deleteDocument').mockResolvedValue(false);

      const res = await request(app)
        .delete(`/api/v1/admin/documents/${validId}`)
        .set('x-access-token', adminToken);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('was not found');
    });

    it('should delete document and return 200 with success message', async () => {
      const validId = new mongoose.Types.ObjectId().toString();
      jest.spyOn(adminService, 'deleteDocument').mockResolvedValue(true);

      const res = await request(app)
        .delete(`/api/v1/admin/documents/${validId}`)
        .set('x-access-token', adminToken);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Document deleted successfully.');
      expect(adminService.deleteDocument).toHaveBeenCalledWith(
        validId,
        adminId,
        expect.any(Object)
      );
    });
  });

  describe('AdminService Implementation Logic', () => {
    it('should calculate analytics correctly with zero-state fallbacks', async () => {
      jest.spyOn(User, 'countDocuments').mockResolvedValue(0 as never);
      jest.spyOn(User, 'aggregate').mockResolvedValue([] as never);
      jest.spyOn(KnowledgeDocument, 'countDocuments').mockResolvedValue(0 as never);
      jest.spyOn(KnowledgeDocument, 'aggregate').mockResolvedValue([] as never);
      jest.spyOn(DocumentChunk, 'countDocuments').mockResolvedValue(0 as never);
      jest.spyOn(QueryLog, 'countDocuments').mockResolvedValue(0 as never);
      jest.spyOn(QueryLog, 'aggregate').mockResolvedValue([] as never);
      jest.spyOn(Feedback, 'countDocuments').mockResolvedValue(0 as never);
      jest.spyOn(Feedback, 'aggregate').mockResolvedValue([] as never);
      jest.spyOn(Message, 'aggregate').mockResolvedValue([] as never);

      const result = await adminService.getAnalytics();

      expect(result.users.total).toBe(0);
      expect(result.documents.total).toBe(0);
      expect(result.queries.retrievalSuccessRate).toBe(0);
      expect(result.queries.averageResponseTimeSec).toBe(0);
      expect(result.feedback.positiveFeedbackRate).toBe(0);
      expect(result.mostAskedQuestions).toEqual([]);
      expect(result.mostUsedDocuments).toEqual([]);
    });

    it('should execute deleteDocument with audit logging and storage cleanup', async () => {
      const docId = new mongoose.Types.ObjectId().toString();
      const mockDoc = {
        _id: new mongoose.Types.ObjectId(docId),
        name: 'Employee_Handbook.pdf',
        department: Department.HR,
        type: DocumentFileType.PDF,
        chunkCount: 15,
      };

      jest.spyOn(KnowledgeDocument, 'findById').mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockDoc),
      } as never);

      jest.spyOn(documentService, 'deleteDocument').mockResolvedValue(true);
      const auditSpy = jest.spyOn(AuditLog, 'create').mockResolvedValue({} as never);

      const deleted = await adminService.deleteDocument(docId, adminId, {
        ip: '127.0.0.1',
        userAgent: 'JestTestRunner',
      });

      expect(deleted).toBe(true);
      expect(documentService.deleteDocument).toHaveBeenCalledWith(docId);
      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: adminId,
          resourceId: docId,
          ipAddress: '127.0.0.1',
        })
      );
    });
  });
});
