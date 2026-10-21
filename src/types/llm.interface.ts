import { IChatSource, ITokenUsage } from './chat.interface';
import { MessageSender } from '../enum';

export interface IGenerateAnswerInput {
  query: string;
  contextChunks: IChatSource[];
  conversationHistory?: Array<{ sender: MessageSender; content: string }>;
}

export interface IGenerateAnswerResult {
  answer: string;
  tokens: ITokenUsage;
}

export interface IRewriteQueryInput {
  query: string;
  conversationHistory: Array<{ sender: MessageSender; content: string }>;
}
