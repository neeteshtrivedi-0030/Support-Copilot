import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import app from '../src/app';
import { env } from '../src/config/env';
import { UserRole, Department, DocumentAccessLevel } from '../src/enum';
import { authService } from '../src/auth/authService';
import { chatService } from '../src/chat/chatService';
import { ragService } from '../src/rag/ragService';
import { DocumentChunk } from '../src/models';

describe('Chat & Search Endpoints (POST /chat, POST /search)', () => {
  const hrUserId = new mongoose.Types.ObjectId().toString();
  const financeUserId = new mongoose.Types.ObjectId().toString();
  const adminUserId = new mongoose.Types.ObjectId().toString();

  const hrToken = jwt.sign(
    {
      userId: hrUserId,
      email: 'hr@company.com',
      role: UserRole.EMPLOYEE,
      department: Department.HR,
    },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const financeToken = jwt.sign(
    {
      userId: financeUserId,
      email: 'finance@company.com',
      role: UserRole.EMPLOYEE,
      department: Department.FINANCE,
    },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const adminToken = jwt.sign(
    {
      userId: adminUserId,
      email: 'admin@company.com',
      role: UserRole.ADMIN,
      department: Department.IT,
    },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  beforeEach(() => {
    jest.restoreAllMocks();

    jest.spyOn(authService, 'findUserById').mockImplementation(async (id: string) => {
      if (id === hrUserId) {
        return {
          _id: new mongoose.Types.ObjectId(hrUserId),
          name: 'HR User',
          email: 'hr@company.com',
          role: UserRole.EMPLOYEE,
          department: Department.HR,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as never;
      }
      if (id === financeUserId) {
        return {
          _id: new mongoose.Types.ObjectId(financeUserId),
          name: 'Finance User',
          email: 'finance@company.com',
          role: UserRole.EMPLOYEE,
          department: Department.FINANCE,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as never;
      }
      if (id === adminUserId) {
        return {
          _id: new mongoose.Types.ObjectId(adminUserId),
          name: 'Admin User',
          email: 'admin@company.com',
          role: UserRole.ADMIN,
          department: Department.IT,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as never;
      }
      return null;
    });
  });

  describe('POST /api/v1/chat', () => {
    it('should return 401 when unauthenticated', async () => {
      const res = await request(app)
        .post('/api/v1/chat')
        .send({ message: 'What is our WFH policy?' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 200 Warning when message payload is missing', async () => {
      const res = await request(app).post('/api/v1/chat').set('x-access-token', hrToken).send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Message is required');
    });

    it('should return 200 with answer and source citations', async () => {
      const mockChatResponse = {
        conversationId: new mongoose.Types.ObjectId().toString(),
        messageId: new mongoose.Types.ObjectId().toString(),
        answer: 'Employees can work remotely up to three days per week.',
        sources: [
          {
            documentId: new mongoose.Types.ObjectId().toString(),
            chunkId: new mongoose.Types.ObjectId().toString(),
            documentName: 'HR_Remote_Work_Policy.pdf',
            pageNumber: 4,
            section: 'Remote Work Policy',
            snippet: 'Employees can work remotely up to three days per week.',
            similarityScore: 0.92,
          },
        ],
        tokens: {
          promptTokens: 120,
          completionTokens: 30,
          totalTokens: 150,
        },
        responseTimeMs: 340,
      };

      jest.spyOn(chatService, 'processChat').mockResolvedValue(mockChatResponse);

      const res = await request(app)
        .post('/api/v1/chat')
        .set('x-access-token', hrToken)
        .send({ message: 'What is the work from home policy?' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.answer).toContain('remotely');
      expect(res.body.data.sources).toHaveLength(1);
      expect(res.body.data.sources[0].documentName).toBe('HR_Remote_Work_Policy.pdf');
      expect(res.body.message).toBe('Response generated successfully.');
    });

    it('should return SSE stream format when stream: true', async () => {
      const mockChatResponse = {
        conversationId: new mongoose.Types.ObjectId().toString(),
        messageId: new mongoose.Types.ObjectId().toString(),
        answer: 'Employees can work remotely up to three days per week.',
        sources: [],
        responseTimeMs: 200,
      };

      jest.spyOn(chatService, 'processChat').mockResolvedValue(mockChatResponse);

      const res = await request(app)
        .post('/api/v1/chat')
        .set('x-access-token', hrToken)
        .send({ message: 'What is the work from home policy?', stream: true });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/event-stream');
      expect(res.text).toContain('data: {"type":"content"');
      expect(res.text).toContain('data: {"type":"done"');
    });

    it('should return 404 when conversationId does not exist', async () => {
      const notFoundError = new Error('CONVERSATION_NOT_FOUND');
      notFoundError.name = 'NotFoundError';

      jest.spyOn(chatService, 'processChat').mockRejectedValue(notFoundError);

      const validId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .post('/api/v1/chat')
        .set('x-access-token', hrToken)
        .send({ message: 'Who approves it?', conversationId: validId });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should allow finance user to send chat message', async () => {
      jest.spyOn(chatService, 'processChat').mockResolvedValue({
        conversationId: new mongoose.Types.ObjectId().toString(),
        messageId: new mongoose.Types.ObjectId().toString(),
        answer: 'Expense claims must be submitted by Friday.',
        sources: [],
        responseTimeMs: 150,
      });

      const res = await request(app)
        .post('/api/v1/chat')
        .set('x-access-token', financeToken)
        .send({ message: 'When are expense reports due?' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/v1/search', () => {
    it('should return 401 when unauthenticated', async () => {
      const res = await request(app).post('/api/v1/search').send({ query: 'laptop replacement' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 200 with semantic chunk search results', async () => {
      const mockSearchResults = {
        query: 'laptop replacement',
        total: 1,
        results: [
          {
            documentId: new mongoose.Types.ObjectId().toString(),
            chunkId: new mongoose.Types.ObjectId().toString(),
            documentName: 'IT_Hardware_Policy.pdf',
            pageNumber: 12,
            section: 'Hardware Lifecycle',
            content: 'Standard laptop lifecycle is 36 months.',
            department: Department.IT,
            similarityScore: 0.94,
          },
        ],
      };

      jest.spyOn(chatService, 'processSearch').mockResolvedValue(mockSearchResults);

      const res = await request(app)
        .post('/api/v1/search')
        .set('x-access-token', hrToken)
        .send({ query: 'laptop replacement', limit: 5 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.results).toHaveLength(1);
      expect(res.body.data.results[0].documentName).toBe('IT_Hardware_Policy.pdf');
    });

    it('should allow admin user to execute search across departments', async () => {
      jest.spyOn(chatService, 'processSearch').mockResolvedValue({
        query: 'all policies',
        total: 0,
        results: [],
      });

      const res = await request(app)
        .post('/api/v1/search')
        .set('x-access-token', adminToken)
        .send({ query: 'all policies' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('Document-Level Access Control Enforcement (Task 17)', () => {
    it('should filter chunks by user department and public access for standard employees', async () => {
      const findSpy = jest.spyOn(DocumentChunk, 'find').mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      } as never);

      await ragService.retrieveChunks({
        user: { role: UserRole.EMPLOYEE, department: Department.HR },
        query: 'policy question',
      });

      expect(findSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          $or: [
            { accessLevel: DocumentAccessLevel.PUBLIC },
            {
              department: Department.HR,
              accessLevel: { $ne: DocumentAccessLevel.ADMIN_ONLY },
            },
          ],
        })
      );
    });

    it('should allow admin users to search all chunks unrestricted', async () => {
      const findSpy = jest.spyOn(DocumentChunk, 'find').mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      } as never);

      await ragService.retrieveChunks({
        user: { role: UserRole.ADMIN, department: Department.IT },
        query: 'policy question',
      });

      expect(findSpy).toHaveBeenCalledWith({});
    });
  });

  describe('POST /api/v1/chat/feedback (Task 14)', () => {
    it('should return 401 when unauthenticated', async () => {
      const res = await request(app).post('/api/v1/chat/feedback').send({
        messageId: new mongoose.Types.ObjectId().toString(),
        conversationId: new mongoose.Types.ObjectId().toString(),
        rating: 'helpful',
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 200 Warning when required fields are missing', async () => {
      const res = await request(app)
        .post('/api/v1/chat/feedback')
        .set('x-access-token', hrToken)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Message ID is required');
    });

    it('should return 200 Warning on invalid rating enum', async () => {
      const res = await request(app)
        .post('/api/v1/chat/feedback')
        .set('x-access-token', hrToken)
        .send({
          messageId: new mongoose.Types.ObjectId().toString(),
          conversationId: new mongoose.Types.ObjectId().toString(),
          rating: 'awesome',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('helpful');
    });

    it('should return 404 when target message is not found', async () => {
      const notFoundError = new Error('MESSAGE_NOT_FOUND');
      notFoundError.name = 'NotFoundError';

      jest.spyOn(chatService, 'submitFeedback').mockRejectedValue(notFoundError);

      const res = await request(app)
        .post('/api/v1/chat/feedback')
        .set('x-access-token', hrToken)
        .send({
          messageId: new mongoose.Types.ObjectId().toString(),
          conversationId: new mongoose.Types.ObjectId().toString(),
          rating: 'helpful',
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should record feedback successfully for helpful response', async () => {
      const messageId = new mongoose.Types.ObjectId().toString();
      const conversationId = new mongoose.Types.ObjectId().toString();

      const mockFeedbackResult = {
        _id: new mongoose.Types.ObjectId(),
        messageId: new mongoose.Types.ObjectId(messageId),
        conversationId: new mongoose.Types.ObjectId(conversationId),
        rating: 'helpful',
      };

      jest.spyOn(chatService, 'submitFeedback').mockResolvedValue(mockFeedbackResult as never);

      const res = await request(app)
        .post('/api/v1/chat/feedback')
        .set('x-access-token', hrToken)
        .send({
          messageId,
          conversationId,
          rating: 'helpful',
          comment: 'Very clear explanation of policy.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.rating).toBe('helpful');
      expect(res.body.message).toBe('Feedback recorded successfully.');
    });
  });
});
