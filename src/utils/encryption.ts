/**
 * @file encryption.ts
 * @version 2.0.0
 * @updated 2026-01-20
 * 
 * Centralized Encryption Utilities for API Key Handling
 * 
 * This module provides:
 * - AES encryption/decryption using CryptoJS
 * - Validation helpers for decrypted keys
 * - Provider-specific key format validation
 * 
 * Security: Uses ENCRYPTION_SALT from environment variables.
 * The same salt must be configured in both GAS frontend and Next.js backend.
 */

import CryptoJS from 'crypto-js';

// ============================================
// CONFIGURATION
// ============================================

const ENCRYPTION_SALT = process.env.ENCRYPTION_SALT || '';

if (!ENCRYPTION_SALT) {
  console.warn('[encryption] WARNING: ENCRYPTION_SALT is not set. API key decryption will fail.');
}

// ============================================
// CORE ENCRYPTION FUNCTIONS
// ============================================

/**
 * Decrypt an encrypted API key
 * 
 * @param encryptedApiKey - Base64 encoded encrypted string from frontend
 * @returns Decrypted API key string, or empty string if decryption fails
 */
export function decryptApiKey(encryptedApiKey: string): string {
  if (!encryptedApiKey) {
    return '';
  }
  
  try {
    const decrypted = CryptoJS.AES.decrypt(encryptedApiKey, ENCRYPTION_SALT).toString(CryptoJS.enc.Utf8);
    return decrypted;
  } catch (error) {
    console.error('[encryption] Decryption failed:', error);
    return '';
  }
}

/**
 * Encrypt an API key (primarily for testing/admin purposes)
 * 
 * @param apiKey - Plain text API key
 * @returns Base64 encoded encrypted string
 */
export function encryptApiKey(apiKey: string): string {
  if (!apiKey) {
    return '';
  }
  
  return CryptoJS.AES.encrypt(apiKey, ENCRYPTION_SALT).toString();
}

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Check if a decrypted key appears valid (not empty, not still encrypted)
 * 
 * This catches cases where:
 * - Decryption failed silently (empty string)
 * - Key was double-encrypted (still starts with U2F)
 * - Key is too short to be valid
 * 
 * @param key - Decrypted API key to validate
 * @returns true if key appears valid
 */
export function isValidDecryptedKey(key: string): boolean {
  if (!key || key.length < 10) {
    return false;
  }
  
  // Check if still encrypted (double-encryption issue)
  if (key.startsWith('U2F')) {
    console.warn('[encryption] Key appears to still be encrypted (double-encryption detected)');
    return false;
  }
  
  return true;
}

/**
 * API key format prefixes by provider
 * Used for basic format validation
 */
const API_KEY_PREFIXES: Record<string, string[]> = {
  CHATGPT: ['sk-'],           // OpenAI keys start with sk-
  CLAUDE: ['sk-ant-'],        // Anthropic keys start with sk-ant-
  GEMINI: ['AI'],             // Google AI keys often start with AI
  GROQ: ['gsk_'],             // Groq keys start with gsk_
  STRATICO: ['sk-'],          // Stratico uses OpenAI-compatible keys
};

/**
 * Validate API key format for a specific provider
 * 
 * Note: This is a basic format check, not a validity check.
 * The key could be in correct format but revoked/invalid.
 * 
 * @param key - Decrypted API key
 * @param provider - AI provider name (CHATGPT, CLAUDE, etc.)
 * @returns true if key matches expected format for provider
 */
export function validateKeyFormat(key: string, provider: string): boolean {
  if (!isValidDecryptedKey(key)) {
    return false;
  }
  
  const prefixes = API_KEY_PREFIXES[provider.toUpperCase()];
  if (!prefixes) {
    // Unknown provider - accept any non-empty key
    return true;
  }
  
  // Check if key starts with any valid prefix for this provider
  return prefixes.some(prefix => key.startsWith(prefix));
}

/**
 * Get expected API key prefix for error messages
 */
export function getExpectedKeyPrefix(provider: string): string {
  const prefixes = API_KEY_PREFIXES[provider.toUpperCase()];
  return prefixes ? prefixes[0] : '(unknown format)';
}