const axios = require("axios");
let tiktoken;

try {
  tiktoken = require("js-tiktoken");
} catch (error) {
  console.error("Failed to load tiktoken:", error);
}

/**
 * Count OpenAI tokens for a given text string
 *
 * @param {string} text - The text to count tokens for
 * @param {string} model - The model name (default: 'gpt-4o')
 * @return {number} - Token count or -1 if there was an error
 */
function countOpenAITokens(text, model = "gpt-4o") {
  try {
    if (!tiktoken) {
      return -1;
    }

    // Map model names to encoding types
    const modelToEncoding = {
      "gpt-4o": "cl100k_base",
      "gpt-4": "cl100k_base",
      "gpt-3.5-turbo": "cl100k_base",
      "text-embedding-ada-002": "cl100k_base",
      "gpt-3": "p50k_base",
      "text-davinci-003": "p50k_base",
      "text-davinci-002": "p50k_base",
      davinci: "p50k_base",
    };

    const encoding = modelToEncoding[model] || "cl100k_base";
    const encoder = tiktoken.getEncoding(encoding);
    const tokens = encoder.encode(text);

    return tokens.length;
  } catch (error) {
    console.error("Error counting OpenAI tokens:", error);
    return -1;
  }
}

/**
 * Count Claude tokens using a simple approximation
 *
 * This is a simplified approximation based on Claude's tokenization approach.
 * For production use, Anthropic recommends using their official tokenizer.
 *
 * @param {string} text - The text to count tokens for
 * @return {number} - Estimated token count
 */
function countClaudeTokensApprox(text) {
  try {
    // Claude's tokenization is roughly 4 characters per token on average for English text
    // This is a simplified approximation
    return Math.ceil(text.length / 4);
  } catch (error) {
    console.error("Error counting Claude tokens:", error);
    return -1;
  }
}

/**
 * Count Claude tokens using Anthropic's tokenizer API if available
 * This requires an Anthropic API key to be set up
 *
 * @param {string} text - The text to count tokens for
 * @param {string} apiKey - Anthropic API key
 * @return {Promise<number>} - Token count or -1 if there was an error
 */
async function countClaudeTokensWithAPI(text, apiKey) {
  if (!apiKey) {
    return countClaudeTokensApprox(text);
  }

  try {
    const response = await axios.post(
      "https://api.anthropic.com/v1/tokenize",
      { text },
      {
        headers: {
          "Content-Type": "application/json",
          "anthropic-version": "2023-06-01",
          "x-api-key": apiKey,
        },
      }
    );

    if (response.data && response.data.tokens) {
      return response.data.tokens.length;
    }

    return countClaudeTokensApprox(text);
  } catch (error) {
    console.error("Error counting Claude tokens with API:", error);
    return countClaudeTokensApprox(text);
  }
}

module.exports = {
  countOpenAITokens,
  countClaudeTokensApprox,
  countClaudeTokensWithAPI,
};
