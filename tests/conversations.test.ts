import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import app from '../src/app';
import { env } from '../src/config/env';
import { UserRole, Department, MessageSender } from '../src/enum';
import { authService } from '../src/auth/authService';
import { conversationService } from '../src/chat/conversationService';

describe('Conversation Endpoints (GET /conversations, GET /:id, DELETE /:id)', () => {
  const userId1 = new mongoose.Types.ObjectId().toString();
  const userId2 = new mongoose.Types.ObjectId().toString();
  const adminUserId = new mongoose.Types.ObjectId().toString();

  const user1Token = jwt.sign(
    {
      userId: userId1,
      email: 'user1@company.com',
      role: UserRole.EMPLOYEE,
      department: Department.HR,
    },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const user2Token = jwt.sign(
    {
      userId: userId2,
      email: 'user2@company.com',
      role: UserRole.EMPLOYEE,
      department: Department.IT,
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
      if (id === userId1) {
        return {
          _id: new mongoose.Types.ObjectId(userId1),
          name: 'User One',
          email: 'user1@company.com',
          role: UserRole.EMPLOYEE,
          department: Department.HR,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as never;
      }
      if (id === userId2) {
        return {
          _id: new mongoose.Types.ObjectId(userId2),
          name: 'User Two',
          email: 'user2@company.com',
          role: UserRole.EMPLOYEE,
          department: Department.IT,
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

  describe('GET /api/v1/conversations', () => {
    it('should return 401 when x-access-token is missing', async () => {
      const res = await request(app).get('/api/v1/conversations');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 200 with paginated conversations list', async () => {
      const mockResult = {
        conversations: [
          {
            id: new mongoose.Types.ObjectId().toString(),
            title: 'HR Policy Query',
            lastMessageAt: new Date(),
            isArchived: false,
            messageCount: 4,
            createdAt: new Date(),
          },
        ],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      };

      jest.spyOn(conversationService, 'listUserConversations').mockResolvedValue(mockResult);

      const res = await request(app)
        .get('/api/v1/conversations?page=1&limit=10')
        .set('x-access-token', user1Token);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.conversations).toHaveLength(1);
      expect(res.body.data.conversations[0].title).toBe('HR Policy Query');
      expect(res.body.message).toBe('Conversations retrieved successfully.');
    });
  });

  describe('GET /api/v1/conversations/:id', () => {
    it('should return 200 Warning on invalid conversation ID format', async () => {
      const res = await request(app)
        .get('/api/v1/conversations/invalid-id')
        .set('x-access-token', user1Token);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid conversation ID format');
    });

    it('should return 404 when conversation not found', async () => {
      const validId = new mongoose.Types.ObjectId().toString();
      jest.spyOn(conversationService, 'getConversationById').mockResolvedValue(null);

      const res = await request(app)
        .get(`/api/v1/conversations/${validId}`)
        .set('x-access-token', user1Token);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should return 403 Forbidden when unauthorized user tries to view conversation', async () => {
      const validId = new mongoose.Types.ObjectId().toString();
      const forbiddenError = new Error('FORBIDDEN');
      forbiddenError.name = 'ForbiddenError';

      jest.spyOn(conversationService, 'getConversationById').mockRejectedValue(forbiddenError);

      const res = await request(app)
        .get(`/api/v1/conversations/${validId}`)
        .set('x-access-token', user2Token);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should return 200 with conversation details and messages', async () => {
      const validId = new mongoose.Types.ObjectId().toString();
      const mockData = {
        conversation: {
          id: validId,
          title: 'Remote Work Q&A',
          createdAt: new Date(),
          updatedAt: new Date(),
          isArchived: false,
        },
        messages: [
          {
            id: new mongoose.Types.ObjectId().toString(),
            sender: MessageSender.USER,
            content: 'What is our WFH policy?',
            createdAt: new Date(),
          },
          {
            id: new mongoose.Types.ObjectId().toString(),
            sender: MessageSender.ASSISTANT,
            content: 'Employees may work remotely 3 days a week.',
            sources: [],
            createdAt: new Date(),
          },
        ],
      };

      jest.spyOn(conversationService, 'getConversationById').mockResolvedValue(mockData);

      const res = await request(app)
        .get(`/api/v1/conversations/${validId}`)
        .set('x-access-token', user1Token);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.conversation.title).toBe('Remote Work Q&A');
      expect(res.body.data.messages).toHaveLength(2);
    });
  });

  describe('DELETE /api/v1/conversations/:id', () => {
    it('should return 404 when deleting a non-existent conversation', async () => {
      const validId = new mongoose.Types.ObjectId().toString();
      jest.spyOn(conversationService, 'deleteConversation').mockResolvedValue(false);

      const res = await request(app)
        .delete(`/api/v1/conversations/${validId}`)
        .set('x-access-token', user1Token);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it("should return 403 Forbidden when unauthorized user deletes someone else's conversation", async () => {
      const validId = new mongoose.Types.ObjectId().toString();
      const forbiddenError = new Error('FORBIDDEN');
      forbiddenError.name = 'ForbiddenError';

      jest.spyOn(conversationService, 'deleteConversation').mockRejectedValue(forbiddenError);

      const res = await request(app)
        .delete(`/api/v1/conversations/${validId}`)
        .set('x-access-token', user2Token);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should return 200 when deleting conversation succeeds', async () => {
      const validId = new mongoose.Types.ObjectId().toString();
      jest.spyOn(conversationService, 'deleteConversation').mockResolvedValue(true);

      const res = await request(app)
        .delete(`/api/v1/conversations/${validId}`)
        .set('x-access-token', user1Token);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Conversation deleted successfully.');
    });
  });

  describe('PATCH /api/v1/conversations/:id', () => {
    it('should return 200 Warning on invalid conversation ID format', async () => {
      const res = await request(app)
        .patch('/api/v1/conversations/invalid-id')
        .set('x-access-token', user1Token)
        .send({ title: 'New Valid Title' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid conversation ID format');
    });

    it('should return 200 Warning when title is empty', async () => {
      const validId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .patch(`/api/v1/conversations/${validId}`)
        .set('x-access-token', user1Token)
        .send({ title: '' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Conversation title cannot be empty');
    });

    it('should return 404 when renaming a non-existent conversation', async () => {
      const validId = new mongoose.Types.ObjectId().toString();
      jest.spyOn(conversationService, 'renameConversation').mockResolvedValue(null);

      const res = await request(app)
        .patch(`/api/v1/conversations/${validId}`)
        .set('x-access-token', user1Token)
        .send({ title: 'Updated Project Q&A' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it("should return 403 Forbidden when unauthorized user renames someone else's conversation", async () => {
      const validId = new mongoose.Types.ObjectId().toString();
      const forbiddenError = new Error('FORBIDDEN');
      forbiddenError.name = 'ForbiddenError';

      jest.spyOn(conversationService, 'renameConversation').mockRejectedValue(forbiddenError);

      const res = await request(app)
        .patch(`/api/v1/conversations/${validId}`)
        .set('x-access-token', user2Token)
        .send({ title: 'Hijacked Title' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should allow employee to rename their own conversation', async () => {
      const validId = new mongoose.Types.ObjectId().toString();
      const mockUpdated = {
        _id: new mongoose.Types.ObjectId(validId),
        title: 'Updated HR Inquiries',
        updatedAt: new Date(),
      };

      jest.spyOn(conversationService, 'renameConversation').mockResolvedValue(mockUpdated as never);

      const res = await request(app)
        .patch(`/api/v1/conversations/${validId}`)
        .set('x-access-token', user1Token)
        .send({ title: 'Updated HR Inquiries' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Updated HR Inquiries');
      expect(res.body.message).toBe('Conversation renamed successfully.');
    });

    it('should allow admin to rename any conversation', async () => {
      const validId = new mongoose.Types.ObjectId().toString();
      const mockUpdated = {
        _id: new mongoose.Types.ObjectId(validId),
        title: 'Admin Moderated Title',
        updatedAt: new Date(),
      };

      jest.spyOn(conversationService, 'renameConversation').mockResolvedValue(mockUpdated as never);

      const res = await request(app)
        .patch(`/api/v1/conversations/${validId}`)
        .set('x-access-token', adminToken)
        .send({ title: 'Admin Moderated Title' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Admin Moderated Title');
    });
  });
});
