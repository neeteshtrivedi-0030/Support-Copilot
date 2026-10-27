import { QdrantClient } from '@qdrant/js-client-rest';
import { OllamaEmbeddings } from '@langchain/ollama';
import { env } from '../config/env';
import { DocumentAccessLevel, UserRole } from '../enum';
import { IChatSource, IRagSearchOptions, IVectorChunkPayload } from '../types';

export class VectorStoreService {
  private client: QdrantClient | null = null;
  private embeddings: OllamaEmbeddings | null = null;
  private readonly collectionName: string;
  private isInitialized = false;

  constructor() {
    this.collectionName = env.QDRANT_COLLECTION || 'support_copilot_chunks';
  }

  private getClient(): QdrantClient {
    if (!this.client) {
      this.client = new QdrantClient({
        url: env.QDRANT_URL || 'http://127.0.0.1:6333',
        checkCompatibility: false,
      });
    }
    return this.client;
  }

  private getEmbeddings(): OllamaEmbeddings {
    if (!this.embeddings) {
      this.embeddings = new OllamaEmbeddings({
        model: env.OLLAMA_EMBED_MODEL || 'nomic-embed-text',
        baseUrl: env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
      });
    }
    return this.embeddings;
  }

  public async ensureCollection(): Promise<boolean> {
    if (this.isInitialized) return true;
    try {
      const client = this.getClient();
      const collections = await client.getCollections();
      const exists = collections.collections.some((c) => c.name === this.collectionName);

      if (!exists) {
        await client.createCollection(this.collectionName, {
          vectors: {
            size: 768, // nomic-embed-text vector dimensionality
            distance: 'Cosine',
          },
        });

        // Create payload indexes for fast RBAC filtering
        await client.createPayloadIndex(this.collectionName, {
          field_name: 'department',
          field_schema: 'keyword',
        });
        await client.createPayloadIndex(this.collectionName, {
          field_name: 'accessLevel',
          field_schema: 'keyword',
        });
        await client.createPayloadIndex(this.collectionName, {
          field_name: 'documentId',
          field_schema: 'keyword',
        });
      }
      this.isInitialized = true;
      return true;
    } catch (err) {
      console.warn(`[VectorStoreService] Collection init warning: ${(err as Error).message}`);
      return false;
    }
  }

  /**
   * Deterministic embedding fallback for test environments or offline resilience
   */
  private generateFallbackVector(text: string, size = 768): number[] {
    const vector = new Array(size).fill(0);
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      const index = (charCode * 31 + i) % size;
      vector[index] = (vector[index] + Math.sin(charCode)) / 2;
    }
    const norm = Math.sqrt(vector.reduce((acc, v) => acc + v * v, 0)) || 1;
    return vector.map((v) => Number((v / norm).toFixed(6)));
  }

  public async generateEmbedding(text: string): Promise<number[]> {
    try {
      const embeddings = this.getEmbeddings();
      return await embeddings.embedQuery(text);
    } catch (err) {
      console.warn(
        `[VectorStoreService] Ollama embedQuery failed: ${(err as Error).message}. Using deterministic vector fallback.`
      );
      return this.generateFallbackVector(text);
    }
  }

  public async generateDocumentsEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      const embeddings = this.getEmbeddings();
      return await embeddings.embedDocuments(texts);
    } catch (err) {
      console.warn(
        `[VectorStoreService] Ollama embedDocuments failed: ${(err as Error).message}. Using fallback vectors.`
      );
      return texts.map((t) => this.generateFallbackVector(t));
    }
  }

  public async upsertChunks(
    chunks: Array<{
      id: string;
      content: string;
      payload: IVectorChunkPayload;
    }>
  ): Promise<boolean> {
    if (chunks.length === 0) return true;

    try {
      const isReady = await this.ensureCollection();
      if (!isReady) return false;

      const texts = chunks.map((c) => c.content);
      const vectors = await this.generateDocumentsEmbeddings(texts);

      const points = chunks.map((chunk, idx) => ({
        id: chunk.id,
        vector: vectors[idx],
        payload: {
          ...chunk.payload,
          content: chunk.content,
        },
      }));

      const client = this.getClient();
      await client.upsert(this.collectionName, {
        wait: true,
        points,
      });

      return true;
    } catch (err) {
      console.warn(`[VectorStoreService] Upsert chunks failed: ${(err as Error).message}`);
      return false;
    }
  }

  public async searchSimilar(options: IRagSearchOptions): Promise<IChatSource[]> {
    const { user, query, departmentFilter, limit = 4, minScore = 0.25 } = options;

    try {
      const isReady = await this.ensureCollection();
      if (!isReady) return [];

      const queryVector = await this.generateEmbedding(query);
      const client = this.getClient();

      // Build Qdrant RBAC payload filter (Task 17)
      const mustFilters: Array<Record<string, unknown>> = [];

      if (user.role !== UserRole.ADMIN) {
        mustFilters.push({
          should: [
            { key: 'accessLevel', match: { value: DocumentAccessLevel.PUBLIC } },
            {
              must: [
                { key: 'department', match: { value: user.department } },
                {
                  must_not: [
                    { key: 'accessLevel', match: { value: DocumentAccessLevel.ADMIN_ONLY } },
                  ],
                },
              ],
            },
          ],
        });
      }

      if (departmentFilter) {
        if (user.role === UserRole.ADMIN || departmentFilter === user.department) {
          mustFilters.push({
            key: 'department',
            match: { value: departmentFilter },
          });
        }
      }

      const filter = mustFilters.length > 0 ? { must: mustFilters } : undefined;

      const response = await client.query(this.collectionName, {
        query: queryVector,
        limit,
        score_threshold: minScore,
        filter: filter as never,
        with_payload: true,
      });

      const points = response.points || [];

      return points.map(
        (res: { id: string | number; score: number; payload?: Record<string, unknown> | null }) => {
          const payload = (res.payload || {}) as unknown as IVectorChunkPayload;
          return {
            documentId: String(payload.documentId || ''),
            chunkId: String(payload.chunkId || res.id),
            documentName: String(payload.documentName || 'Unknown Document'),
            pageNumber: payload.pageNumber,
            section: payload.section,
            snippet: String(payload.content || ''),
            similarityScore: Number(res.score.toFixed(3)),
          };
        }
      );
    } catch (err) {
      console.warn(`[VectorStoreService] Vector search error: ${(err as Error).message}`);
      return [];
    }
  }

  public async deleteDocumentChunks(documentId: string): Promise<void> {
    try {
      const client = this.getClient();
      await client.delete(this.collectionName, {
        filter: {
          must: [
            {
              key: 'documentId',
              match: { value: documentId },
            },
          ],
        },
      });
    } catch (err) {
      console.warn(`[VectorStoreService] Delete document chunks error: ${(err as Error).message}`);
    }
  }
}

export const vectorStoreService = new VectorStoreService();
export default vectorStoreService;
