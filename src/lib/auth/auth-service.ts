/**
 * @file auth-service.ts
 * @version 2.0.0
 * @created 2026-01-20
 * @updated 2026-02-10
 * 
 * Centralized Authentication Service for API Key Handling
 * 
 * This service provides a single point for:
 * - Extracting encrypted API keys from request bodies (BYOK mode)
 * - Managed AI mode using platform-owned API keys (managed mode)
 * - Decrypting keys securely on the backend
 * - Validating API key presence
 * - Returning ready-to-use AI model instances
 * 
 * Two modes:
 * 1. BYOK (default): User provides encryptedApiKey → decrypted → used for AI calls
 * 2. Managed: body.managedMode=true → platform API keys used → credits debited
 * 
 * Usage:
 *   const auth = await authenticateRequest(body);
 *   if (!auth.success) return NextResponse.json({ error: auth.error }, { status: 401 });
 *   const { provider, model, isManaged } = auth;
 *   // After AI call: if (auth.isManaged) debitManagedCredits(auth.userId, cost)
 */

import { decryptApiKey, isValidDecryptedKey } from '@/utils/encryption';
import { getModel, getDefaultModel, AIProvider, DEFAULT_MODELS } from '@/lib/ai/models';
import { getManagedModel, canUseManagedCredits, DEFAULT_MANAGED_MODEL, MANAGED_MODEL_REGISTRY } from '@/lib/managed-ai';
import type { PlanTier } from '@/lib/stripe';
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
  // Managed mode fields (new)
  managedMode?: boolean;
  userId?: string;
  userEmail?: string;
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
  /** Whether this request uses managed (platform) AI keys */
  isManaged: boolean;
  /** User ID for managed credit debit (only set when isManaged=true) */
  managedUserId?: string;
}

/**
 * Failed authentication result
 */
export interface AuthFailure {
  success: false;
  error: string;
  code: 'NO_ENCRYPTED_KEY' | 'DECRYPTION_FAILED' | 'INVALID_PROVIDER' | 'MODEL_ERROR' | 'MANAGED_CREDITS_EXHAUSTED' | 'MANAGED_MODEL_UNAVAILABLE';
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
 * Authenticate a request by extracting and validating the API key.
 * Supports two modes:
 * 
 * 1. BYOK (default): body.encryptedApiKey is decrypted and used
 * 2. Managed: body.managedMode=true → platform keys, credit-gated
 * 
 * When managedMode is true and no encryptedApiKey is provided,
 * the managed AI path is used. If encryptedApiKey IS provided
 * even with managedMode=true, BYOK takes precedence (user's key wins).
 * 
 * @param body - Request body containing provider and encryptedApiKey or managedMode
 * @param options - Optional configuration
 * @returns AuthResult - Either success with model or failure with error
 * 
 * @example
 * // BYOK mode (existing behavior, unchanged)
 * const auth = await authenticateRequest(body);
 * if (!auth.success) return NextResponse.json({ error: auth.error }, { status: 401 });
 * const { model, provider, apiKey } = auth;
 * 
 * // After AI call, if managed:
 * if (auth.isManaged) {
 *   const cost = calculateQueryCost(auth.modelId, usage.inputTokens, usage.outputTokens);
 *   await debitManagedCredits(auth.managedUserId!, cost);
 * }
 */
export async function authenticateRequest(
  body: AuthenticatedRequestBody,
  options?: {
    defaultProvider?: AIProvider;
    requireKey?: boolean;  // Default true
  }
): Promise<AuthResult> {
  const { defaultProvider = DEFAULT_PROVIDER, requireKey = true } = options || {};

  // ── MANAGED MODE PATH ──
  // If managedMode is requested AND no user key provided, use platform keys
  if (body.managedMode && !body.encryptedApiKey) {
    return authenticateManagedRequest(body);
  }

  // ── BYOK PATH (existing behavior, unchanged) ──

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
      model,
      isManaged: false
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
 * Authenticate a managed mode request using platform-owned API keys.
 * Checks credit balance and model allowlist for the user's tier.
 */
async function authenticateManagedRequest(
  body: AuthenticatedRequestBody
): Promise<AuthResult> {
  const userIdentifier = body.userId || body.userEmail;
  if (!userIdentifier) {
    return {
      success: false,
      error: 'Managed mode requires userId or userEmail.',
      code: 'NO_ENCRYPTED_KEY'
    };
  }

  // 1. Check managed credit balance
  const creditStatus = await canUseManagedCredits(userIdentifier);
  if (!creditStatus.allowed) {
    return {
      success: false,
      error: creditStatus.reason || 'Managed AI credits exhausted.',
      code: 'MANAGED_CREDITS_EXHAUSTED'
    };
  }

  // 2. Determine model: use specificModel if provided and allowed, otherwise tier default
  const requestedModel = body.specificModel;
  const tier = creditStatus.tier;
  let modelId: string;

  if (requestedModel && MANAGED_MODEL_REGISTRY[requestedModel]) {
    modelId = requestedModel;
  } else {
    modelId = DEFAULT_MANAGED_MODEL[tier];
  }

  // 3. Get managed model instance (validates allowlist + gets platform key)
  const managedResult = getManagedModel(modelId, tier);
  if (!managedResult) {
    return {
      success: false,
      error: `Model "${modelId}" is not available on the ${tier} plan in managed mode. Available models: ${
        (await import('@/lib/managed-ai')).getManagedModelsForTier(tier).map(m => m.displayName).join(', ')
      }`,
      code: 'MANAGED_MODEL_UNAVAILABLE'
    };
  }

  // 4. Resolve userId for credit debit (need the actual UUID, not email)
  let managedUserId = body.userId;
  if (!managedUserId && body.userEmail) {
    // We'll pass the email; the debit function in gating/managed-ai handles lookup
    // But for simplicity, the DB function expects a UUID, so resolve it
    const { supabaseAdmin } = await import('@/lib/supabase');
    const { data } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', body.userEmail)
      .single();
    managedUserId = data?.id;
  }

  return {
    success: true,
    provider: managedResult.provider,
    apiKey: '[managed]', // Sentinel value — actual key is inside the model instance
    modelId: managedResult.modelId,
    model: managedResult.model,
    isManaged: true,
    managedUserId: managedUserId || undefined
  };
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
    case 'MANAGED_MODEL_UNAVAILABLE':
      return 400; // Bad Request
    case 'MANAGED_CREDITS_EXHAUSTED':
      return 402; // Payment Required
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
