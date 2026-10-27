import { Department, MessageSender } from '../enum';

export interface IChatSource {
  documentId: string;
  chunkId?: string;
  documentName: string;
  pageNumber?: number;
  section?: string;
  snippet: string;
  similarityScore: number;
}

export interface ITokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface IChatRequest {
  message: string;
  conversationId?: string;
  department?: Department;
  stream?: boolean;
}

export interface IChatResponseData {
  conversationId: string;
  messageId: string;
  answer: string;
  sources: IChatSource[];
  tokens?: ITokenUsage;
  responseTimeMs: number;
}

export interface IChatStreamEvent {
  type: 'content' | 'sources' | 'done' | 'error';
  answer?: string;
  sources?: IChatSource[];
  conversationId?: string;
  messageId?: string;
  tokens?: ITokenUsage;
  responseTimeMs?: number;
  message?: string;
}

export interface ISearchRequest {
  query: string;
  department?: Department;
  limit?: number;
  minScore?: number;
}

export interface ISearchResultItem {
  documentId: string;
  chunkId: string;
  documentName: string;
  pageNumber?: number;
  section?: string;
  content: string;
  department: Department;
  similarityScore: number;
}

export interface ISearchResponseData {
  query: string;
  total: number;
  results: ISearchResultItem[];
}

export interface IConversationListItem {
  id: string;
  _id?: string;
  title: string;
  lastMessageAt?: Date;
  isArchived: boolean;
  messageCount: number;
  createdAt: Date;
}

export interface IConversationListQuery {
  page?: number;
  limit?: number;
  search?: string;
  isArchived?: boolean;
}

export interface IConversationListResult {
  conversations: IConversationListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface IMessageItem {
  id: string;
  _id?: string;
  sender: MessageSender;
  role?: string;
  content: string;
  sources?: IChatSource[];
  tokens?: ITokenUsage;
  responseTimeMs?: number;
  createdAt: Date;
}

export interface IConversationDetailResponseData {
  conversation: {
    id: string;
    _id?: string;
    title: string;
    createdAt: Date;
    updatedAt: Date;
    isArchived: boolean;
  };
  messages: IMessageItem[];
}

export interface IRenameConversationRequest {
  title: string;
}

export interface IFeedbackRequest {
  messageId: string;
  conversationId: string;
  rating: string;
  comment?: string;
}
