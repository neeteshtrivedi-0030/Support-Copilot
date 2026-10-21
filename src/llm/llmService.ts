import Groq from 'groq-sdk';
import { env } from '../config/env';
import { IGenerateAnswerInput, IGenerateAnswerResult, IRewriteQueryInput } from '../types';

export class LlmService {
  private groqClient: Groq | null = null;

  private getClient(): Groq | null {
    if (!this.groqClient && env.GROQ_API_KEY) {
      this.groqClient = new Groq({ apiKey: env.GROQ_API_KEY });
    }
    return this.groqClient;
  }

  public async rewriteQuery(input: IRewriteQueryInput): Promise<string> {
    const { query, conversationHistory = [] } = input;
    const client = this.getClient();

    if (client) {
      try {
        const priorMessages = conversationHistory.filter(
          (m) => m.content.trim().toLowerCase() !== query.trim().toLowerCase()
        );
        const historyText =
          priorMessages.length > 0
            ? priorMessages
                .slice(-4)
                .map((m) => `${m.sender}: ${m.content}`)
                .join('\n')
            : '';

        const userPrompt = historyText
          ? `Prior Conversation:\n${historyText}\n\nCurrent Question: ${query}\nStandalone Search Query:`
          : `User Question: ${query}\nStandalone Search Query:`;

        const response = await client.chat.completions.create({
          model: env.GROQ_MODEL || 'openai/gpt-oss-120b',
          messages: [
            {
              role: 'system',
              content: `You are an AI search query optimizer for an enterprise knowledge base.
Given the user's question, output a clear, standalone search query to retrieve relevant company policy documents and handbooks.
- Expand any abbreviations, organizational acronyms, or shorthand (e.g. WFH to work from home, PTO to paid time off) so the retrieval engine finds the right policy.
- Resolve any pronouns ("it", "they", "this", "that") using prior conversation if provided.
- Return ONLY the search query. No explanation, no quotes.`,
            },
            {
              role: 'user',
              content: userPrompt,
            },
          ],
          temperature: 0.2,
          max_tokens: 100,
        });

        const rewritten = response.choices[0]?.message?.content?.trim();
        if (rewritten && rewritten.length > 0) {
          return rewritten.replace(/^["']|["']$/g, '');
        }
      } catch (err) {
        console.warn('[LlmService] Groq query rewriting warning:', err);
      }
    }

    /*
     * =========================================================================
     * LEGACY STATIC QUERY REWRITE IMPLEMENTATION (COMMENTED OUT)
     * =========================================================================
     *
     * if (!conversationHistory || conversationHistory.length === 0) {
     *   return query.trim();
     * }
     *
     * const lastExchange = conversationHistory.slice(-4);
     * const hasAmbiguousPronouns = /\b(it|its|this|that|these|those|they|them|he|she)\b/i.test(query);
     *
     * if (!hasAmbiguousPronouns) {
     *   return query.trim();
     * }
     *
     * const previousContext = lastExchange.map((m) => m.content).join(' ');
     * const subjectMatches = previousContext.match(
     *   /([A-Z][a-zA-Z0-9_\s]{2,25}(?:policy|manual|guide|handbook|troubleshooting|procedure|requirement|lifecycle))/i
     * );
     *
     * if (subjectMatches && subjectMatches[1]) {
     *   return `${query.replace(/\b(it|this|that)\b/gi, '').trim()} regarding ${subjectMatches[1].trim()}`.replace(
     *     /\s+/g,
     *     ' '
     *   );
     * }
     *
     * return query.trim();
     */

    return query.trim();
  }

  public async generateAnswer(input: IGenerateAnswerInput): Promise<IGenerateAnswerResult> {
    const { query, contextChunks, conversationHistory = [] } = input;
    const trimmed = query.trim().toLowerCase();

    // 1. Natural greeting detection
    const isGreeting = /^(hello|hi|hey|greetings|good\s*(morning|afternoon|evening)|howdy)\b/i.test(
      trimmed
    );
    if (isGreeting) {
      return {
        answer: `Hello! I'm your Enterprise Knowledge & Support Copilot. How can I assist you today? You can ask me about organizational policies, IT equipment & laptop refresh, expense reimbursement guidelines, and HR handbooks.`,
        tokens: {
          promptTokens: 15,
          completionTokens: 45,
          totalTokens: 60,
        },
      };
    }

    // 2. Identity and help inquiries
    const isIntroQuestion =
      /^(who\s+are\s+you|what\s+can\s+you\s+do|what\s+is\s+this|help)\b/i.test(trimmed);
    if (isIntroQuestion) {
      return {
        answer: `I am your Enterprise AI Knowledge & Support Copilot. I can assist you with:\n\n• **Work-From-Home Policy** (hybrid schedules, equipment stipends)\n• **IT Hardware & Laptop Replacement** (3-year refresh cycles, device tiers, repairs)\n• **Travel & Expense Reimbursement** (per diem rates, receipt rules, timelines)\n• **Information Security Guidelines** (passwords, MFA, VPN usage)\n\nAll answers are synthesized directly from verified organizational documentation.`,
        tokens: {
          promptTokens: 20,
          completionTokens: 65,
          totalTokens: 85,
        },
      };
    }

    // 3. Fallback when no matching context chunks found in RAG
    if (!contextChunks || contextChunks.length === 0) {
      return {
        answer: `I could not find this information in the available knowledge base.\n\nPlease check if the relevant document has been uploaded under **Knowledge Base**, or contact the respective department (HR, IT, or Finance) for further details.`,
        tokens: {
          promptTokens: 25,
          completionTokens: 35,
          totalTokens: 60,
        },
      };
    }

    // 4. Live Groq AI Answer Generation
    const client = this.getClient();
    if (client) {
      try {
        const formattedContext = contextChunks
          .map(
            (c, i) =>
              `[Source ${i + 1}] Document: ${c.documentName}${c.pageNumber ? ` (Page ${c.pageNumber})` : ''}${c.section ? ` - ${c.section}` : ''}:\n${c.snippet}`
          )
          .join('\n\n');

        const systemPrompt = `You are the official Enterprise AI Knowledge & Support Copilot.
Your job is to answer employee questions with maximum accuracy based ONLY on the provided organization documentation context.

Strict Guidelines:
1. Ground your answer completely on the provided context sources. Do not invent facts, numbers, or rules not present in the context.
2. If the context does not contain sufficient details to answer the question, state: "I could not find sufficient information in the available knowledge base."
3. Maintain an authoritative, professional, and helpful tone.
4. Format your answer cleanly in standard Markdown:
   - Use bold titles and headings (## Section Title)
   - Use bullet points (- item) for clear, readable policies
   - If using a summary table, format it cleanly with Markdown columns and header dividers. Do not use raw HTML tags (avoid <br>, <span>, or <div>) inside Markdown.
5. In your answer, explicitly cite the relevant document name and section where the policy is defined.`;

        const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
          { role: 'system', content: systemPrompt },
        ];

        if (conversationHistory.length > 0) {
          const recentHistory = conversationHistory.slice(-4);
          for (const msg of recentHistory) {
            messages.push({
              role: msg.sender === 'user' ? 'user' : 'assistant',
              content: msg.content,
            });
          }
        }

        messages.push({
          role: 'user',
          content: `Documentation Context:\n${formattedContext}\n\nEmployee Question: ${query}\n\nPlease synthesize a clear, helpful answer citing the source document and section:`,
        });

        const completion = await client.chat.completions.create({
          model: env.GROQ_MODEL || 'openai/gpt-oss-120b',
          messages,
          temperature: 0.1,
          max_tokens: 1024,
        });

        const answer =
          completion.choices[0]?.message?.content?.trim() ||
          'I could not find this information in the available knowledge base.';

        const usage = completion.usage;
        return {
          answer,
          tokens: {
            promptTokens: usage?.prompt_tokens ?? Math.ceil(query.length / 4),
            completionTokens: usage?.completion_tokens ?? Math.ceil(answer.length / 4),
            totalTokens:
              usage?.total_tokens ?? Math.ceil(query.length / 4) + Math.ceil(answer.length / 4),
          },
        };
      } catch (groqErr) {
        console.error('[LlmService] Groq API call error:', groqErr);
      }
    }

    /*
     * =========================================================================
     * LEGACY STATIC MOCK IMPLEMENTATION (COMMENTED OUT AS PER USER REQUIREMENT)
     * =========================================================================
     *
     * const historyText = conversationHistory.map((m) => `${m.sender}: ${m.content}`).join('\n');
     *
     * const contextText = contextChunks
     *   .map(
     *     (c, i) =>
     *       `[Source ${i + 1}] Document: ${c.documentName}${c.pageNumber ? ` (Page ${c.pageNumber})` : ''}${c.section ? ` - ${c.section}` : ''}:\n${c.snippet}`
     *   )
     *   .join('\n\n');
     *
     * const topChunk = contextChunks[0];
     * const topSnippet = topChunk.snippet.trim();
     *
     * let synthesizedAnswer = topSnippet;
     * if (!synthesizedAnswer.endsWith('.')) {
     *   synthesizedAnswer += '.';
     * }
     *
     * let additionalDetails = '';
     * if (contextChunks.length > 1 && contextChunks[1].snippet !== topChunk.snippet) {
     *   additionalDetails = `\n\n**Additional Details (${contextChunks[1].section || contextChunks[1].documentName}):**\n${contextChunks[1].snippet.trim()}`;
     * }
     *
     * const answer = `Based on the **${topChunk.documentName}**${topChunk.section ? ` (${topChunk.section})` : ''}:\n\n${synthesizedAnswer}${additionalDetails}`;
     *
     * const promptTokens = Math.ceil((contextText.length + query.length + historyText.length) / 4);
     * const completionTokens = Math.ceil(answer.length / 4);
     *
     * return {
     *   answer,
     *   tokens: {
     *     promptTokens,
     *     completionTokens,
     *     totalTokens: promptTokens + completionTokens,
     *   },
     * };
     */

    // Safe fallback if Groq API is offline
    const topChunk = contextChunks[0];
    const fallbackAnswer = `Based on the **${topChunk.documentName}**${topChunk.section ? ` (${topChunk.section})` : ''}:\n\n${topChunk.snippet.trim()}`;
    return {
      answer: fallbackAnswer,
      tokens: {
        promptTokens: Math.ceil(query.length / 4),
        completionTokens: Math.ceil(fallbackAnswer.length / 4),
        totalTokens: Math.ceil(query.length / 4) + Math.ceil(fallbackAnswer.length / 4),
      },
    };
  }
}

export const llmService = new LlmService();
export default llmService;
