// AI proxy — server-side calls to Claude (Anthropic).
// Requires a signed-in Clerk user and only accepts requests from allowed
// origins, so the API key is never exposed and the endpoint can't be abused
// by anonymous traffic to run up the bill.
//
// Accepts an OpenAI-style { messages, max_tokens } body (system role + optional
// image_url blocks) and returns an OpenAI-shaped { choices: [{ message }] }
// envelope, so the existing web client works with minimal changes.

const Anthropic = require('@anthropic-ai/sdk');
const { applyCors, requireAuth } = require('./_lib/auth');
const { createLogger, errFields } = require('./_lib/log');

const MODEL = 'claude-sonnet-5';

// Convert one OpenAI-style content part into an Anthropic content block.
function convertPart(part) {
  if (typeof part === 'string') {
    return { type: 'text', text: part };
  }
  if (part.type === 'text') {
    return { type: 'text', text: part.text };
  }
  if (part.type === 'image_url') {
    const url = part.image_url?.url || '';
    const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/.exec(url);
    if (match) {
      return {
        type: 'image',
        source: { type: 'base64', media_type: match[1], data: match[2] },
      };
    }
    return { type: 'image', source: { type: 'url', url } };
  }
  return null;
}

// Convert an OpenAI-style messages array into an Anthropic system string plus
// a user/assistant messages array.
function convertMessages(messages) {
  const systemParts = [];
  const converted = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemParts.push(
        typeof msg.content === 'string'
          ? msg.content
          : (msg.content || []).map((p) => p.text || '').join('\n')
      );
      continue;
    }

    const content = Array.isArray(msg.content)
      ? msg.content.map(convertPart).filter(Boolean)
      : [{ type: 'text', text: String(msg.content ?? '') }];

    converted.push({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content,
    });
  }

  return { system: systemParts.join('\n\n'), messages: converted };
}

module.exports = async (req, res) => {
  const log = createLogger('ai', req);
  if (applyCors(req, res, 'POST,OPTIONS')) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', reqId: log.reqId });
  }

  const userId = await requireAuth(req, res);
  if (!userId) return;

  try {
    const { messages, max_tokens } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      log.warn('bad request: no messages array', { userId });
      return res.status(400).json({ error: 'messages array required', reqId: log.reqId });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      log.error('ANTHROPIC_API_KEY is not set', { userId });
      return res.status(500).json({ error: 'AI service not configured', reqId: log.reqId });
    }

    const maxTokens = Math.min(Math.max(Number(max_tokens) || 8000, 256), 16000);
    const { system, messages: anthropicMessages } = convertMessages(messages);
    const hasImages = anthropicMessages.some(
      (m) => Array.isArray(m.content) && m.content.some((b) => b.type === 'image')
    );

    log.info('anthropic request', {
      userId,
      model: MODEL,
      messageCount: anthropicMessages.length,
      hasImages,
      maxTokens,
    });

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const started = Date.now();

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      thinking: { type: 'disabled' },
      ...(system ? { system } : {}),
      messages: anthropicMessages,
    });

    const text = (response.content || [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('');

    log.info('anthropic ok', {
      userId,
      durationMs: Date.now() - started,
      stopReason: response.stop_reason,
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens,
      outputChars: text.length,
    });

    if (!text) {
      log.warn('anthropic returned empty text', { userId, stopReason: response.stop_reason });
    }

    // OpenAI-shaped envelope so the existing client parsing is unchanged.
    return res.status(200).json({
      choices: [{ message: { role: 'assistant', content: text } }],
    });
  } catch (error) {
    const status = error?.status || 500;
    log.error('AI proxy error', { userId, status, ...errFields(error) });
    return res.status(status).json({ error: 'AI request failed', reqId: log.reqId });
  }
};
