import { DocumentChunk, KnowledgeDocument } from '../models';
import { Department, DocumentAccessLevel, UserRole, VectorDbType } from '../enum';
import { IChatSource, ISearchResultItem, IRagSearchOptions } from '../types';
import { env } from '../config/env';
import { vectorStoreService } from './vectorStoreService';

export class RagService {
  public async retrieveChunks(options: IRagSearchOptions): Promise<IChatSource[]> {
    const { user, query, departmentFilter, limit = 4, minScore = 0.25 } = options;

    // 1. Primary Vector Search: Qdrant Vector Database
    if (env.VECTOR_DB_TYPE === VectorDbType.QDRANT) {
      try {
        const vectorSources = await vectorStoreService.searchSimilar(options);
        if (vectorSources.length > 0) {
          return vectorSources;
        }
      } catch (vectorErr) {
        console.warn(
          `[RagService] Qdrant retrieval warning: ${(vectorErr as Error).message}. Falling back to lexical retrieval.`
        );
      }
    }

    // 2. Secondary / Fallback Retrieval: MongoDB Keyword Scorer
    const baseFilter: Record<string, unknown> = {};

    if (user.role !== UserRole.ADMIN) {
      baseFilter.$or = [
        { accessLevel: DocumentAccessLevel.PUBLIC },
        {
          department: user.department,
          accessLevel: { $ne: DocumentAccessLevel.ADMIN_ONLY },
        },
      ];
    }

    if (departmentFilter) {
      if (user.role === UserRole.ADMIN || departmentFilter === user.department) {
        baseFilter.department = departmentFilter;
      }
    }

    const queryTokens = query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2);

    const chunks = await DocumentChunk.find(baseFilter).sort({ createdAt: -1 }).limit(100).exec();

    if (chunks.length === 0) {
      return [];
    }

    const scoredChunks = chunks.map((chunk) => {
      const contentLower = chunk.content.toLowerCase();
      const sectionLower = (chunk.section || '').toLowerCase();
      const docNameLower = chunk.documentName.toLowerCase();

      let matchCount = 0;
      queryTokens.forEach((token) => {
        if (contentLower.includes(token)) matchCount += 1;
        if (sectionLower.includes(token)) matchCount += 2;
        if (docNameLower.includes(token)) matchCount += 1.5;
      });

      const tokenCount = queryTokens.length || 1;
      const rawScore = matchCount / (tokenCount * 2);
      const similarityScore = Math.min(0.98, Math.max(0.1, Number((rawScore + 0.35).toFixed(3))));

      return {
        chunk,
        score: matchCount > 0 ? similarityScore : 0.15,
      };
    });

    const filteredChunks = scoredChunks
      .filter((item) => item.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return filteredChunks.map((item) => ({
      documentId: item.chunk.documentId.toString(),
      chunkId: item.chunk._id.toString(),
      documentName: item.chunk.documentName,
      pageNumber: item.chunk.pageNumber,
      section: item.chunk.section,
      snippet: item.chunk.content,
      similarityScore: item.score,
    }));
  }

  public async searchChunks(options: IRagSearchOptions): Promise<ISearchResultItem[]> {
    const chatSources = await this.retrieveChunks(options);

    const docIds = chatSources.map((s) => s.documentId);
    const docs = await KnowledgeDocument.find({ _id: { $in: docIds } })
      .select('_id department')
      .exec();

    const deptMap = new Map<string, Department>();
    docs.forEach((d) => deptMap.set(d._id.toString(), d.department));

    return chatSources.map((source) => ({
      documentId: source.documentId,
      chunkId: source.chunkId || '',
      documentName: source.documentName,
      pageNumber: source.pageNumber,
      section: source.section,
      content: source.snippet,
      department: deptMap.get(source.documentId) || Department.GENERAL,
      similarityScore: source.similarityScore,
    }));
  }
}

export const ragService = new RagService();
export default ragService;
