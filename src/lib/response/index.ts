/**
 * Response Processing Module
 * 
 * Handles normalization and validation of AI responses.
 * 
 * @version 1.0.0
 */

export {
  normalizeSheetResponse,
  COLOR_MAP,
  extractConditionalRulesFromCommand,
  inferActionFromConfig,
  type RawSheetResponse,
  type NormalizedSheetResponse,
} from './normalizer';
