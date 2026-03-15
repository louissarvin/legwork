/**
 * AI Provider Abstraction
 *
 * Primary: Anthropic (Claude Sonnet 4)
 * Fallback: Groq (Llama 4 Scout) via OpenAI-compatible API
 *
 * Automatically falls back to Groq when:
 * - ANTHROPIC_API_KEY is not set
 * - Anthropic returns 401/429/500 errors (credit exhausted, rate limited)
 *
 * Both providers support tool calling and vision.
 */

export type AIProvider = 'anthropic' | 'groq'

export interface ToolDef {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string | ContentBlock[]
}

export interface ContentBlock {
  type: 'text' | 'image' | 'tool_use' | 'tool_result'
  text?: string
  // Anthropic image format
  source?: { type: 'base64'; media_type: string; data: string }
  // Tool use
  id?: string
  name?: string
  input?: Record<string, unknown>
  // Tool result
  tool_use_id?: string
  content?: string
  is_error?: boolean
}

export interface ToolCall {
  id: string
  name: string
  input: Record<string, unknown>
}

export interface AIResponse {
  text: string
  toolCalls: ToolCall[]
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens'
  provider: AIProvider
}

// Determine which provider to use
function getProvider(): AIProvider {
  if (process.env.ANTHROPIC_API_KEY && process.env.AI_PROVIDER !== 'groq') {
    return 'anthropic'
  }
  if (process.env.GROQ_API_KEY) {
    return 'groq'
  }
  // Default to anthropic if key exists
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic'
  throw new Error('No AI provider configured. Set ANTHROPIC_API_KEY or GROQ_API_KEY.')
}

let currentProvider: AIProvider | null = null
let failedProviders = new Set<AIProvider>()

export function getActiveProvider(): AIProvider {
  if (currentProvider && !failedProviders.has(currentProvider)) return currentProvider
  currentProvider = getProvider()
  return currentProvider
}

function shouldFallback(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase()
    return (
      msg.includes('401') ||
      msg.includes('429') ||
      msg.includes('credit') ||
      msg.includes('rate limit') ||
      msg.includes('insufficient') ||
      msg.includes('billing') ||
      msg.includes('overloaded') ||
      msg.includes('500')
    )
  }
  return false
}

// Convert Anthropic tool format to OpenAI format
function toolsToOpenAI(tools: ToolDef[]) {
  return tools.map(t => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }))
}

// Anthropic provider
async function callAnthropic(
  systemPrompt: string,
  messages: Message[],
  tools: ToolDef[],
  maxTokens: number,
): Promise<AIResponse> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic()

  // Convert messages to Anthropic format
  const anthropicMessages = messages.map(m => {
    if (typeof m.content === 'string') {
      return { role: m.role as 'user' | 'assistant', content: m.content }
    }
    // Content blocks (tool results, images)
    return { role: m.role as 'user' | 'assistant', content: m.content }
  })

  const anthropicTools = tools.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: { type: 'object' as const, ...t.parameters },
  }))

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: maxTokens,
    system: systemPrompt,
    tools: anthropicTools,
    messages: anthropicMessages as any,
  })

  let text = ''
  const toolCalls: ToolCall[] = []

  for (const block of response.content) {
    if (block.type === 'text') text += block.text
    if (block.type === 'tool_use') {
      toolCalls.push({ id: block.id, name: block.name, input: block.input as Record<string, unknown> })
    }
  }

  return {
    text,
    toolCalls,
    stopReason: response.stop_reason === 'tool_use' ? 'tool_use' : 'end_turn',
    provider: 'anthropic',
  }
}

// Groq provider (OpenAI-compatible)
async function callGroq(
  systemPrompt: string,
  messages: Message[],
  tools: ToolDef[],
  maxTokens: number,
): Promise<AIResponse> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_API_KEY not set')

  // Convert messages to OpenAI format
  const openaiMessages: any[] = [
    { role: 'system', content: systemPrompt },
  ]

  for (const m of messages) {
    if (typeof m.content === 'string') {
      openaiMessages.push({ role: m.role, content: m.content })
      continue
    }

    // Handle content blocks
    const blocks = m.content as ContentBlock[]

    if (m.role === 'assistant') {
      // Assistant messages with tool calls
      const textParts = blocks.filter(b => b.type === 'text').map(b => b.text).join('')
      const toolUseParts = blocks.filter(b => b.type === 'tool_use')

      const msg: any = { role: 'assistant', content: textParts || null }
      if (toolUseParts.length > 0) {
        msg.tool_calls = toolUseParts.map(t => ({
          id: t.id,
          type: 'function',
          function: { name: t.name, arguments: JSON.stringify(t.input) },
        }))
      }
      openaiMessages.push(msg)
    } else if (m.role === 'user') {
      // User messages: could be tool results or text+images
      const toolResults = blocks.filter(b => b.type === 'tool_result')
      if (toolResults.length > 0) {
        for (const tr of toolResults) {
          openaiMessages.push({
            role: 'tool',
            tool_call_id: tr.tool_use_id,
            content: tr.content || '',
          })
        }
      } else {
        // Text and/or images
        const content: any[] = []
        for (const b of blocks) {
          if (b.type === 'text') {
            content.push({ type: 'text', text: b.text })
          } else if (b.type === 'image' && b.source) {
            content.push({
              type: 'image_url',
              image_url: { url: `data:${b.source.media_type};base64,${b.source.data}` },
            })
          }
        }
        openaiMessages.push({ role: 'user', content })
      }
    }
  }

  const body: any = {
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    max_tokens: maxTokens,
    messages: openaiMessages,
  }

  if (tools.length > 0) {
    body.tools = toolsToOpenAI(tools)
    body.tool_choice = 'auto'
  }

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Groq API error ${res.status}: ${err}`)
  }

  const data = await res.json()
  const choice = data.choices?.[0]
  if (!choice) throw new Error('Groq returned no choices')

  const text = choice.message?.content || ''
  const toolCalls: ToolCall[] = (choice.message?.tool_calls || []).map((tc: any) => ({
    id: tc.id,
    name: tc.function.name,
    input: JSON.parse(tc.function.arguments || '{}'),
  }))

  const stopReason = choice.finish_reason === 'tool_calls' ? 'tool_use'
    : choice.finish_reason === 'stop' ? 'end_turn'
    : 'end_turn'

  return { text, toolCalls, stopReason, provider: 'groq' }
}

// Main entry point: call with automatic fallback
export async function callAI(
  systemPrompt: string,
  messages: Message[],
  tools: ToolDef[],
  maxTokens: number = 4096,
): Promise<AIResponse> {
  const provider = getActiveProvider()

  try {
    if (provider === 'anthropic') {
      return await callAnthropic(systemPrompt, messages, tools, maxTokens)
    }
    return await callGroq(systemPrompt, messages, tools, maxTokens)
  } catch (error) {
    // Try fallback if primary fails with auth/rate/billing error
    if (shouldFallback(error)) {
      const fallback: AIProvider = provider === 'anthropic' ? 'groq' : 'anthropic'
      console.log(`[AI] ${provider} failed (${error instanceof Error ? error.message.slice(0, 80) : 'unknown'}), falling back to ${fallback}`)
      failedProviders.add(provider)

      if (fallback === 'groq' && process.env.GROQ_API_KEY) {
        return await callGroq(systemPrompt, messages, tools, maxTokens)
      }
      if (fallback === 'anthropic' && process.env.ANTHROPIC_API_KEY) {
        return await callAnthropic(systemPrompt, messages, tools, maxTokens)
      }
    }
    throw error
  }
}

// Vision-specific call (simplified for photo verification)
export async function callVision(
  photoBase64: string,
  prompt: string,
  mediaType: string = 'image/jpeg',
): Promise<string> {
  const provider = getActiveProvider()

  try {
    if (provider === 'anthropic') {
      const Anthropic = (await import('@anthropic-ai/sdk')).default
      const client = new Anthropic()
      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: photoBase64 } },
            { type: 'text', text: prompt },
          ],
        }],
      })
      return response.content[0].type === 'text' ? response.content[0].text : ''
    }

    // Groq vision
    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) throw new Error('GROQ_API_KEY not set')

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:${mediaType};base64,${photoBase64}` } },
          ],
        }],
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Groq vision error ${res.status}: ${err}`)
    }

    const data = await res.json()
    return data.choices?.[0]?.message?.content || ''
  } catch (error) {
    if (shouldFallback(error)) {
      const fallback: AIProvider = provider === 'anthropic' ? 'groq' : 'anthropic'
      console.log(`[Vision] ${provider} failed, falling back to ${fallback}`)
      failedProviders.add(provider)

      // Retry with fallback
      if (fallback === 'groq' && process.env.GROQ_API_KEY) {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'meta-llama/llama-4-scout-17b-16e-instruct',
            max_tokens: 1024,
            messages: [{
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: `data:${mediaType};base64,${photoBase64}` } },
              ],
            }],
          }),
        })
        if (!res.ok) throw new Error(`Groq fallback failed: ${res.status}`)
        const data = await res.json()
        return data.choices?.[0]?.message?.content || ''
      }
    }
    throw error
  }
}
