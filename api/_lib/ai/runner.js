// One place that talks to Claude. Every task uses structured outputs (the reply
// is guaranteed to match the schema) and streaming (no HTTP timeouts on long
// generations, and progress can be relayed to the browser).

const Anthropic = require('@anthropic-ai/sdk');

// Claude Sonnet 5.5 by default. Override with AI_MODEL (for example
// claude-opus-5-5 for higher quality at roughly twice the cost per request).
const MODEL = process.env.AI_MODEL || 'claude-sonnet-5-5';

class AiError extends Error {
  constructor(code, message, status = 502) {
    super(message);
    this.name = 'AiError';
    this.code = code;
    this.status = status;
  }
}

let client = null;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new AiError('not_configured', 'The AI service is not configured.', 500);
  }
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2 });
  return client;
}

// messages: Anthropic message params. Returns { data, content, usage } where
// `content` is the assistant turn to pass back unchanged on a follow-up request.
async function generate({ system, messages, schema, effort = 'low', maxTokens = 16000, onProgress, signal }) {
  const stream = getClient().messages.stream(
    {
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages,
      output_config: { effort, format: { type: 'json_schema', schema } },
    },
    { signal }
  );

  if (onProgress) stream.on('text', (_delta, snapshot) => onProgress(snapshot.length));

  const message = await stream.finalMessage();

  if (message.stop_reason === 'refusal') {
    throw new AiError('refused', 'The AI could not complete this request. Try rewording any custom text in your profile.', 422);
  }
  if (message.stop_reason === 'max_tokens') {
    throw new AiError('truncated', 'The AI response was cut off. Please try again.');
  }

  const textOut = message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');
  let data;
  try {
    data = JSON.parse(textOut);
  } catch {
    throw new AiError('invalid_output', 'The AI returned an unreadable response. Please try again.');
  }
  return { data, content: message.content, usage: message.usage };
}

module.exports = { generate, AiError, MODEL };
