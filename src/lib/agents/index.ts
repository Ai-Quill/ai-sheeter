/**
 * Agents Module - AI SDK ToolLoopAgent Implementation
 * 
 * This module provides the new SDK-based agent architecture:
 * - ToolLoopAgent with 10 specialized tools
 * - Self-correction using Evaluator-Optimizer pattern
 * - Automatic looping until goal is achieved
 * 
 * Enable with: USE_SDK_AGENT=true environment variable
 * 
 * @version 1.0.0
 * @created 2026-02-05
 */

export { createSheetsAgent, convertAgentResultToLegacyFormat } from './sheets-agent';
export type { DataContext } from './sheets-agent';
export { allTools } from './tools';
