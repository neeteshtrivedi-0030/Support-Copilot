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

    if (!conversationHistory || conversationHistory.length === 0) {
      return query.trim();
    }

    const priorMessages = conversationHistory.filter(
      (m) => m.content.trim().toLowerCase() !== query.trim().toLowerCase()
    );

    if (priorMessages.length === 0) {
      return query.trim();
    }

    const historyText = priorMessages
      .slice(-4)
      .map((m) => `${m.sender}: ${m.content}`)
      .join('\n');

    if (client) {
      try {
        const userPrompt = `Prior Conversation:
${historyText}

Current User Input: "${query}"
Standalone Search Query:`;

        const response = await client.chat.completions.create({
          model: env.GROQ_MODEL || 'openai/gpt-oss-120b',
          messages: [
            {
              role: 'system',
              content: `You are an expert AI search query optimizer for an enterprise knowledge retrieval system.
Given the conversation history and the current user input, produce a single, comprehensive, standalone search query to search company documentation, policies, and handbooks.

CRITICAL RULES:
1. Handle brief follow-ups, requests for explanation, and clarifications (such as "what?", "explain", "why?", "tell me more", "how?", "what does that mean?"): Synthesize the active topic and subject from the prior conversation so the query retrieves the exact policies or procedures under discussion.
2. Resolve pronouns and references: Resolve all pronouns ("it", "they", "this", "that", "these", "those", "the previous step") into specific entities from the conversation.
3. Expand organizational acronyms or shorthand (e.g. WFH -> work from home, PTO -> paid time off, IT -> information technology).
4. Output ONLY the standalone search query. Never include prefixes like "Search Query:", explanations, notes, or quotation marks.`,
            },
            {
              role: 'user',
              content: userPrompt,
            },
          ],
          temperature: 0.1,
          max_tokens: 80,
        });

        const rewritten = response.choices[0]?.message?.content?.trim();
        if (rewritten && rewritten.length > 0) {
          const cleaned = rewritten
            .replace(/^["']|["']$/g, '')
            .replace(/^(search query|standalone query|query):\s*/i, '')
            .trim();
          if (cleaned.length > 0 && cleaned.toLowerCase() !== query.trim().toLowerCase()) {
            return cleaned;
          }
        }
      } catch (err) {
        console.warn('[LlmService] Groq query rewriting warning:', err);
      }
    }

    // Fallback heuristic for short follow-ups if Groq failed or returned the exact same query
    const words = query.trim().split(/\s+/);
    if (words.length <= 3 && priorMessages.length > 0) {
      const lastExchange = priorMessages.slice(-2);
      const textToExtract = lastExchange.map((m) => m.content).join(' ');
      const match = textToExtract.match(
        /\b([a-zA-Z\s]{3,30}(?:laptop|hardware|policy|leave|remote|wfh|expense|reimbursement|security|equipment|handbook|travel|guidelines|repair|replacement))\b/i
      );
      if (match && match[1]) {
        return `${query.trim()} regarding ${match[1].trim()}`;
      }
    }

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

    // 3. Fallback when genuinely no matching context chunks and no conversation history
    const hasChunks = Boolean(contextChunks && contextChunks.length > 0);
    const hasHistory = Boolean(conversationHistory && conversationHistory.length > 0);

    if (!hasChunks && !hasHistory) {
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
        const formattedContext = (contextChunks || [])
          .map(
            (c, i) =>
              `[Source ${i + 1}] Document: ${c.documentName}${c.pageNumber ? ` (Page ${c.pageNumber})` : ''}${c.section ? ` - ${c.section}` : ''}:\n${c.snippet}`
          )
          .join('\n\n');

        let systemPrompt = `You are the official Enterprise AI Knowledge & Support Copilot.
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

        if (!hasChunks && hasHistory) {
          systemPrompt = `You are the official Enterprise AI Knowledge & Support Copilot.
The employee is asking for clarification, explanation, or a follow-up on your previous answer in this active conversation thread.
Guidelines:
1. Clarify, simplify, or explain the previous information step-by-step in clear, plain English.
2. Stay strictly grounded in the facts and policies established in the conversation history. Do not invent outside rules.
3. Keep the tone helpful, empathetic, and professional.`;
        }

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

        const userPrompt = formattedContext
          ? `Documentation Context:\n${formattedContext}\n\nEmployee Question: ${query}\n\nPlease synthesize a clear, helpful answer citing the source document and section:`
          : `Employee Follow-up Question: ${query}\n\nPlease explain or clarify the prior information clearly:`;

        messages.push({
          role: 'user',
          content: userPrompt,
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

    // Safe fallback if Groq API is offline
    if (contextChunks && contextChunks.length > 0) {
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

    const genericFallback = `I could not find this information in the available knowledge base.`;
    return {
      answer: genericFallback,
      tokens: {
        promptTokens: Math.ceil(query.length / 4),
        completionTokens: Math.ceil(genericFallback.length / 4),
        totalTokens: Math.ceil(query.length / 4) + Math.ceil(genericFallback.length / 4),
      },
    };
  }

  public async generateAnswerStream(
    input: IGenerateAnswerInput,
    onDelta: (delta: string) => void
  ): Promise<IGenerateAnswerResult> {
    const { query, contextChunks, conversationHistory = [] } = input;
    const trimmed = query.trim().toLowerCase();

    // 1. Natural greeting detection
    const isGreeting = /^(hello|hi|hey|greetings|good\s*(morning|afternoon|evening)|howdy)\b/i.test(
      trimmed
    );
    if (isGreeting) {
      const answer = `Hello! I'm your Enterprise Knowledge & Support Copilot. How can I assist you today? You can ask me about organizational policies, IT equipment & laptop refresh, expense reimbursement guidelines, and HR handbooks.`;
      onDelta(answer);
      return {
        answer,
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
      const answer = `I am your Enterprise AI Knowledge & Support Copilot. I can assist you with:\n\n• **Work-From-Home Policy** (hybrid schedules, equipment stipends)\n• **IT Hardware & Laptop Replacement** (3-year refresh cycles, device tiers, repairs)\n• **Travel & Expense Reimbursement** (per diem rates, receipt rules, timelines)\n• **Information Security Guidelines** (passwords, MFA, VPN usage)\n\nAll answers are synthesized directly from verified organizational documentation.`;
      onDelta(answer);
      return {
        answer,
        tokens: {
          promptTokens: 20,
          completionTokens: 65,
          totalTokens: 85,
        },
      };
    }

    // 3. Fallback when genuinely no matching context chunks and no conversation history
    const hasChunks = Boolean(contextChunks && contextChunks.length > 0);
    const hasHistory = Boolean(conversationHistory && conversationHistory.length > 0);

    if (!hasChunks && !hasHistory) {
      const answer = `I could not find this information in the available knowledge base.\n\nPlease check if the relevant document has been uploaded under **Knowledge Base**, or contact the respective department (HR, IT, or Finance) for further details.`;
      onDelta(answer);
      return {
        answer,
        tokens: {
          promptTokens: 25,
          completionTokens: 35,
          totalTokens: 60,
        },
      };
    }

    // 4. Live Groq Streaming
    const client = this.getClient();
    if (client) {
      try {
        const formattedContext = (contextChunks || [])
          .map(
            (c, i) =>
              `[Source ${i + 1}] Document: ${c.documentName}${c.pageNumber ? ` (Page ${c.pageNumber})` : ''}${c.section ? ` - ${c.section}` : ''}:\n${c.snippet}`
          )
          .join('\n\n');

        let systemPrompt = `You are the official Enterprise AI Knowledge & Support Copilot.
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

        if (!hasChunks && hasHistory) {
          systemPrompt = `You are the official Enterprise AI Knowledge & Support Copilot.
The employee is asking for clarification, explanation, or a follow-up on your previous answer in this active conversation thread.
Guidelines:
1. Clarify, simplify, or explain the previous information step-by-step in clear, plain English.
2. Stay strictly grounded in the facts and policies established in the conversation history. Do not invent outside rules.
3. Keep the tone helpful, empathetic, and professional.`;
        }

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

        const userPrompt = formattedContext
          ? `Documentation Context:\n${formattedContext}\n\nEmployee Question: ${query}\n\nPlease synthesize a clear, helpful answer citing the source document and section:`
          : `Employee Follow-up Question: ${query}\n\nPlease explain or clarify the prior information clearly:`;

        messages.push({
          role: 'user',
          content: userPrompt,
        });

        const stream = await client.chat.completions.create({
          model: env.GROQ_MODEL || 'openai/gpt-oss-120b',
          messages,
          temperature: 0.1,
          max_tokens: 1024,
          stream: true,
        });

        let accumulatedAnswer = '';
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content || '';
          if (delta) {
            accumulatedAnswer += delta;
            onDelta(delta);
          }
        }

        const answer =
          accumulatedAnswer.trim() ||
          'I could not find this information in the available knowledge base.';

        return {
          answer,
          tokens: {
            promptTokens: Math.ceil((userPrompt.length + 200) / 4),
            completionTokens: Math.ceil(answer.length / 4),
            totalTokens: Math.ceil((userPrompt.length + 200) / 4) + Math.ceil(answer.length / 4),
          },
        };
      } catch (streamErr) {
        console.error('[LlmService] Groq streaming error:', streamErr);
      }
    }

    // Fallback if client offline
    const fallbackAnswer =
      contextChunks && contextChunks.length > 0
        ? `Based on the **${contextChunks[0].documentName}**${contextChunks[0].section ? ` (${contextChunks[0].section})` : ''}:\n\n${contextChunks[0].snippet.trim()}`
        : `I could not find this information in the available knowledge base.`;

    onDelta(fallbackAnswer);
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
