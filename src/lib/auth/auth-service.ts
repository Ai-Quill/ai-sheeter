/**
 * @file auth-service.ts
 * @version 1.0.0
 * @created 2026-01-20
 * 
 * Centralized Authentication Service for API Key Handling
 * 
 * This service provides a single point for:
 * - Extracting encrypted API keys from request bodies
 * - Decrypting keys securely on the backend
 * - Validating API key presence (BYOK enforcement)
 * - Returning ready-to-use AI model instances
 * 
 * Usage:
 *   const auth = authenticateRequest(body);
 *   if (!auth.success) return NextResponse.json({ error: auth.error }, { status: 401 });
 *   const { provider, apiKey, model } = auth;
 */

import { decryptApiKey, isValidDecryptedKey } from '@/utils/encryption';
import { getModel, getDefaultModel, AIProvider, DEFAULT_MODELS } from '@/lib/ai/models';
import type { LanguageModel } from 'ai';

// ============================================
// TYPES
// ============================================

/**
 * Request body shape expected from GAS frontend
 */
export interface AuthenticatedRequestBody {
  provider?: string;
  encryptedApiKey?: string;
  specificModel?: string;
  model?: string;  // Alternative field name used by some routes
}

/**
 * Successful authentication result
 */
export interface AuthSuccess {
  success: true;
  provider: AIProvider;
  apiKey: string;
  modelId: string;
  model: LanguageModel;
}

/**
 * Failed authentication result
 */
export interface AuthFailure {
  success: false;
  error: string;
  code: 'NO_ENCRYPTED_KEY' | 'DECRYPTION_FAILED' | 'INVALID_PROVIDER' | 'MODEL_ERROR';
}

export type AuthResult = AuthSuccess | AuthFailure;

// ============================================
// CONFIGURATION
// ============================================

/**
 * Valid AI providers in our system
 */
const VALID_PROVIDERS: AIProvider[] = ['CHATGPT', 'CLAUDE', 'GROQ', 'GEMINI', 'STRATICO'];

/**
 * Default provider when none specified
 */
const DEFAULT_PROVIDER: AIProvider = 'GEMINI';

// ============================================
// MAIN FUNCTION
// ============================================

/**
 * Authenticate a request by extracting and validating the API key
 * 
 * @param body - Request body containing provider and encryptedApiKey
 * @param options - Optional configuration
 * @returns AuthResult - Either success with model or failure with error
 * 
 * @example
 * const auth = authenticateRequest(body);
 * if (!auth.success) {
 *   return NextResponse.json({ error: auth.error }, { status: 401 });
 * }
 * const { model, provider, apiKey } = auth;
 */
export function authenticateRequest(
  body: AuthenticatedRequestBody,
  options?: {
    defaultProvider?: AIProvider;
    requireKey?: boolean;  // Default true
  }
): AuthResult {
  const { defaultProvider = DEFAULT_PROVIDER, requireKey = true } = options || {};

  // 1. Extract and validate provider
  const providerRaw = body.provider || body.model || defaultProvider;
  const provider = normalizeProvider(providerRaw);
  
  if (!provider) {
    return {
      success: false,
      error: `Invalid AI provider: "${providerRaw}". Valid providers: ${VALID_PROVIDERS.join(', ')}`,
      code: 'INVALID_PROVIDER'
    };
  }

  // 2. Check for encrypted key
  if (!body.encryptedApiKey) {
    if (requireKey) {
      return {
        success: false,
        error: `No API key provided for ${provider}. Please configure your API key in Settings.`,
        code: 'NO_ENCRYPTED_KEY'
      };
    }
    // If key not required, return without model
    return {
      success: false,
      error: 'No API key provided (optional)',
      code: 'NO_ENCRYPTED_KEY'
    };
  }

  // 3. Decrypt API key
  const apiKey = decryptApiKey(body.encryptedApiKey);
  
  if (!apiKey || !isValidDecryptedKey(apiKey)) {
    return {
      success: false,
      error: `Failed to decrypt API key for ${provider}. The key may be corrupted or the encryption salt may have changed.`,
      code: 'DECRYPTION_FAILED'
    };
  }

  // 4. Get model ID
  const modelId = body.specificModel || getDefaultModel(provider);

  // 5. Create model instance
  try {
    const model = getModel(provider, modelId, apiKey);
    
    return {
      success: true,
      provider,
      apiKey,
      modelId,
      model
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to initialize ${provider} model: ${error instanceof Error ? error.message : 'Unknown error'}`,
      code: 'MODEL_ERROR'
    };
  }
}

/**
 * Authenticate request with optional API key (for routes that can work without it)
 * Returns apiKey as undefined if not provided, instead of failing
 */
export function authenticateRequestOptional(
  body: AuthenticatedRequestBody
): { provider: AIProvider; apiKey?: string; modelId: string; model?: LanguageModel } {
  const providerRaw = body.provider || body.model || DEFAULT_PROVIDER;
  const provider = normalizeProvider(providerRaw) || DEFAULT_PROVIDER;
  const modelId = body.specificModel || getDefaultModel(provider);

  if (!body.encryptedApiKey) {
    return { provider, modelId, apiKey: undefined, model: undefined };
  }

  const apiKey = decryptApiKey(body.encryptedApiKey);
  
  if (!apiKey || !isValidDecryptedKey(apiKey)) {
    return { provider, modelId, apiKey: undefined, model: undefined };
  }

  try {
    const model = getModel(provider, modelId, apiKey);
    return { provider, apiKey, modelId, model };
  } catch {
    return { provider, modelId, apiKey: undefined, model: undefined };
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Normalize provider string to valid AIProvider type
 */
function normalizeProvider(provider: string): AIProvider | null {
  const normalized = provider?.toUpperCase() as AIProvider;
  return VALID_PROVIDERS.includes(normalized) ? normalized : null;
}

/**
 * Get HTTP status code for auth error
 */
export function getAuthErrorStatus(code: AuthFailure['code']): number {
  switch (code) {
    case 'NO_ENCRYPTED_KEY':
    case 'DECRYPTION_FAILED':
      return 401; // Unauthorized
    case 'INVALID_PROVIDER':
      return 400; // Bad Request
    case 'MODEL_ERROR':
      return 500; // Internal Server Error
    default:
      return 401;
  }
}

/**
 * Create a standardized error response for auth failures
 */
export function createAuthErrorResponse(auth: AuthFailure) {
  return {
    success: false,
    error: auth.error,
    code: auth.code
  };
}
