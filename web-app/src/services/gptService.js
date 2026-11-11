// AI service. The browser sends the household's data and the name of a task;
// the prompts, model and output checks all live on the server (api/ai.js).
import { getAuthToken } from '../utils/authToken';

// The server sends a progress line at least every 8 seconds. If nothing at all
// arrives for this long, the connection is treated as dead.
const IDLE_TIMEOUT_MS = 45000;
const RETRYABLE = new Set(['network', 'busy', 'ai_failed', 'invalid_output', 'truncated', 'incomplete_plan', 'empty_list']);

export class AiRequestError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'AiRequestError';
    this.code = code;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function requestOnce(task, input, onProgress) {
  const token = await getAuthToken();
  if (!token) throw new AiRequestError('You are signed out. Please sign in again.', 'signed_out');

  const controller = new AbortController();
  let idleTimer;
  const resetIdle = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => controller.abort(), IDLE_TIMEOUT_MS);
  };

  try {
    resetIdle();
    let response;
    try {
      response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ task, input }),
        signal: controller.signal,
      });
    } catch {
      throw new AiRequestError('Could not reach the server. Check your connection and try again.', 'network');
    }

    if (!response.ok) {
      let payload = {};
      try {
        payload = await response.json();
      } catch {
        // Not JSON; fall through to the generic message.
      }
      if (response.status === 402) {
        window.location.assign('/subscribe');
      }
      const code = payload.code || (response.status >= 500 ? 'ai_failed' : `http_${response.status}`);
      throw new AiRequestError(payload.error || 'Something went wrong. Please try again.', code);
    }

    // Read the newline-delimited JSON stream: progress lines, then one result
    // or error line.
    let outcome = null;
    const handleLine = (line) => {
      if (!line.trim()) return;
      const event = JSON.parse(line);
      if (event.type === 'progress') {
        if (onProgress) onProgress(event);
      } else if (event.type === 'result' || event.type === 'error') {
        outcome = event;
      }
    };

    try {
      if (response.body && response.body.getReader) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          resetIdle();
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop();
          lines.forEach(handleLine);
        }
        handleLine(buffer + decoder.decode());
      } else {
        (await response.text()).split('\n').forEach(handleLine);
      }
    } catch {
      throw new AiRequestError('The connection dropped before the answer arrived. Please try again.', 'network');
    }

    if (!outcome) throw new AiRequestError('The connection dropped before the answer arrived. Please try again.', 'network');
    if (outcome.type === 'error') throw new AiRequestError(outcome.error, outcome.code);
    return outcome.data;
  } finally {
    clearTimeout(idleTimer);
  }
}

// One automatic retry for failures that are worth retrying. Requests that the
// server rejected on purpose (limits, bad input, signed out) are not repeated.
async function callAi(task, input, onProgress) {
  try {
    return await requestOnce(task, input, onProgress);
  } catch (error) {
    if (!RETRYABLE.has(error.code)) throw error;
    await sleep(1500);
    return requestOnce(task, input, onProgress);
  }
}

// onProgress receives { stage, chars } while the plan is being written.
export const generateMealPlan = (profile, pantryItems, onProgress) =>
  callAi('mealPlan', { profile, pantryItems: pantryItems || [] }, onProgress);

export const generateShoppingList = (mealPlan, pantryItems, profile, onProgress) =>
  callAi('shoppingList', { mealPlan, pantryItems: pantryItems || [], profile }, onProgress);

export const generateCustomMeal = (mealName, profile, mealType) =>
  callAi('customMeal', { mealName, profile, mealType });

// otherMeals: names already in the week's plan, so the replacement is not a repeat.
export const replaceMeal = (currentMeal, profile, pantryItems, mealType, otherMeals = []) =>
  callAi('replaceMeal', { currentMeal, profile, pantryItems: pantryItems || [], mealType, otherMeals });

export const getDetailedRecipe = (meal, profile) => callAi('recipe', { meal, profile });

export const generateQuickMeal = (pantryItems, profile) =>
  callAi('quickMeal', { pantryItems: pantryItems || [], profile });

// images: data URLs, already resized (see utils/imageResize). Sent a few at a
// time so each request stays small.
export const processImages = async (images, onProgress) => {
  const BATCH = 3;
  const found = [];
  for (let i = 0; i < images.length; i += BATCH) {
    if (onProgress) onProgress({ done: i, total: images.length });
    const result = await callAi('pantryScan', { images: images.slice(i, i + BATCH) });
    found.push(...(result.items || []));
  }
  const seen = new Set();
  const items = found.filter((item) => {
    const key = `${item.brand}|${item.name}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { success: items.length > 0, items };
};
