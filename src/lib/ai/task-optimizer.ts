/**
 * Task Optimizer - Smart task detection and optimization
 * 
 * This module provides:
 * 1. Task type detection from natural language
 * 2. Optimized prompt templates per task type
 * 3. Processing strategy recommendations
 * 4. Optional formula alternatives
 * 
 * @version 1.0.0
 * @updated 2026-01-13
 */

// ============================================
// TASK TYPE DEFINITIONS
// ============================================

export type TaskType = 
  | 'translate'
  | 'summarize'
  | 'extract'
  | 'classify'
  | 'generate'
  | 'calculate'
  | 'clean'
  | 'rewrite'
  | 'custom';

export interface TaskConfig {
  type: TaskType;
  /** Whether this task can be batched efficiently */
  batchable: boolean;
  /** Recommended model for cost/quality balance */
  recommendedModel: 'fast' | 'balanced' | 'quality';
  /** Average tokens per row (for estimation) */
  avgTokensPerRow: number;
  /** Optional spreadsheet formula alternative */
  formulaAlternative?: string;
  /** Optimized prompt template */
  promptTemplate: string;
  /** System prompt addition for this task */
  systemPromptAddition?: string;
}

// ============================================
// TASK CONFIGURATIONS
// ============================================

const TASK_CONFIGS: Record<TaskType, TaskConfig> = {
  translate: {
    type: 'translate',
    batchable: true,
    recommendedModel: 'fast',
    avgTokensPerRow: 40,
    promptTemplate: '{language}: {{input}}',
    systemPromptAddition: 'You are a translator. Provide only the translation, no explanations.',
  },
  
  summarize: {
    type: 'summarize',
    batchable: false, // Summaries need full context
    recommendedModel: 'balanced',
    avgTokensPerRow: 100,
    promptTemplate: 'Summarize in {length}: {{input}}',
    systemPromptAddition: 'Be concise. Capture key points only.',
  },
  
  extract: {
    type: 'extract',
    batchable: true,
    recommendedModel: 'fast',
    avgTokensPerRow: 30,
    promptTemplate: 'Extract {target} from: {{input}}. Return only the extracted value or "None".',
    formulaAlternative: '=REGEXEXTRACT({input}, "{pattern}")',
  },
  
  classify: {
    type: 'classify',
    batchable: true,
    recommendedModel: 'fast',
    avgTokensPerRow: 25,
    promptTemplate: '{{input}} → {categories}?',
    systemPromptAddition: 'Respond with exactly one category. No explanations.',
  },
  
  generate: {
    type: 'generate',
    batchable: false, // Creative tasks need individual attention
    recommendedModel: 'quality',
    avgTokensPerRow: 150,
    promptTemplate: '{instruction} for: {{input}}',
  },
  
  calculate: {
    type: 'calculate',
    batchable: true,
    recommendedModel: 'fast',
    avgTokensPerRow: 35,
    // Use {headerName} for context, {{input}} for value
    promptTemplate: 'Calculate {calculation}. {headerName}: {{input}}. Today: {today}. Output format: {format}',
    formulaAlternative: '={formula}',
    systemPromptAddition: 'Return ONLY the calculated value. No explanations, no formulas, just the result.',
  },
  
  clean: {
    type: 'clean',
    batchable: true,
    recommendedModel: 'fast',
    avgTokensPerRow: 30,
    promptTemplate: 'Clean {{input}}: {rules}',
    formulaAlternative: '=TRIM(CLEAN({input}))',
    systemPromptAddition: 'Return only the cleaned value.',
  },
  
  rewrite: {
    type: 'rewrite',
    batchable: true,
    recommendedModel: 'balanced',
    avgTokensPerRow: 60,
    promptTemplate: 'Rewrite in {style}: {{input}}',
  },
  
  custom: {
    type: 'custom',
    batchable: true, // Assume batchable unless proven otherwise
    recommendedModel: 'balanced',
    avgTokensPerRow: 50,
    promptTemplate: '{{input}}',
  },
};

// ============================================
// TASK DETECTION PATTERNS
// ============================================

interface TaskPattern {
  type: TaskType;
  patterns: RegExp[];
  extractors?: Record<string, RegExp>;
}

const TASK_PATTERNS: TaskPattern[] = [
  {
    type: 'translate',
    patterns: [
      /translat(e|ion)/i,
      /convert to (spanish|french|german|chinese|japanese|korean|portuguese|italian|russian|arabic)/i,
      /in (spanish|french|german|chinese|japanese|korean|portuguese|italian|russian|arabic)$/i,
    ],
    extractors: {
      language: /(?:to |in )(spanish|french|german|chinese|japanese|korean|portuguese|italian|russian|arabic|english)/i,
    },
  },
  {
    type: 'summarize',
    patterns: [
      /summariz(e|ation)/i,
      /sum up/i,
      /brief(ly)?/i,
      /tl;?dr/i,
    ],
    extractors: {
      length: /(\d+)\s*(word|sentence|line)/i,
    },
  },
  {
    type: 'extract',
    patterns: [
      /extract/i,
      /find (all )?(email|phone|url|name|date|number)/i,
      /get (the )?(email|phone|url|name|date|number)/i,
      /pull out/i,
    ],
    extractors: {
      target: /(email|phone|url|name|date|number|address)/i,
    },
  },
  {
    type: 'classify',
    patterns: [
      /classif(y|ication)/i,
      /categoriz(e|ation)/i,
      /label/i,
      /sentiment/i,
      /is it .+ or .+\?/i,
      /positive.+negative/i,
      /urgent.+normal/i,
    ],
    extractors: {
      categories: /(?:as |into |: ?)([^.]+)$/i,
    },
  },
  {
    type: 'generate',
    patterns: [
      /generat(e|ion)/i,
      /creat(e|ion)/i,
      /writ(e|ing) (?:a |an )/i,
      /compose/i,
      /draft/i,
    ],
  },
  {
    type: 'calculate',
    patterns: [
      /calculat(e|ion)/i,
      /comput(e|ation)/i,
      /seniority/i,
      /age from/i,
      /years since/i,
      /days (between|since|until)/i,
      /difference/i,
    ],
    extractors: {
      calculation: /(seniority|age|years|months|days|difference)/i,
    },
  },
  {
    type: 'clean',
    patterns: [
      /clean/i,
      /remov(e|ing) (extra |duplicate )?/i,
      /trim/i,
      /fix format/i,
      /standardiz(e|ation)/i,
    ],
  },
  {
    type: 'rewrite',
    patterns: [
      /rewrit(e|ing)/i,
      /rephras(e|ing)/i,
      /paraphras(e|ing)/i,
      /make (it )?(more |less )?(formal|casual|professional|friendly)/i,
    ],
    extractors: {
      style: /(formal|casual|professional|friendly|concise|detailed)/i,
    },
  },
];

// ============================================
// FORMULA PATTERNS
// ============================================

interface FormulaPattern {
  taskMatch: RegExp;
  formula: string;
  description: string;
  /** 
   * Reliability level:
   * - 'guaranteed': 100% safe, always works (text transforms)
   * - 'conditional': Works if data is clean (dates, regex)
   */
  reliability: 'guaranteed' | 'conditional';
  /** Warning to show user for conditional formulas */
  warning?: string;
}

const FORMULA_PATTERNS: FormulaPattern[] = [
  // ============================================
  // GUARANTEED: 100% safe, always works
  // ============================================
  {
    taskMatch: /uppercase|upper case|to upper/i,
    formula: '=UPPER({input})',
    description: 'Convert to uppercase',
    reliability: 'guaranteed',
  },
  {
    taskMatch: /lowercase|lower case|to lower/i,
    formula: '=LOWER({input})',
    description: 'Convert to lowercase',
    reliability: 'guaranteed',
  },
  {
    taskMatch: /proper case|title case|capitalize/i,
    formula: '=PROPER({input})',
    description: 'Capitalize each word',
    reliability: 'guaranteed',
  },
  {
    taskMatch: /character count|count char|length/i,
    formula: '=LEN({input})',
    description: 'Count characters',
    reliability: 'guaranteed',
  },
  {
    taskMatch: /trim|remove spaces|clean spaces/i,
    formula: '=TRIM({input})',
    description: 'Remove extra spaces',
    reliability: 'guaranteed',
  },
  
  // ============================================
  // CONDITIONAL: Works if data is clean
  // Only suggest, don't auto-apply
  // ============================================
  {
    taskMatch: /seniority|years (of employment|since|working)/i,
    formula: '=DATEDIF({input}, TODAY(), "Y") & " years, " & DATEDIF({input}, TODAY(), "YM") & " months"',
    description: 'Calculate years and months since date',
    reliability: 'conditional',
    warning: 'Requires valid date format. May fail on inconsistent dates.',
  },
  {
    taskMatch: /age from (birth|dob|date of birth)/i,
    formula: '=DATEDIF({input}, TODAY(), "Y")',
    description: 'Calculate age from birthdate',
    reliability: 'conditional',
    warning: 'Requires valid date format.',
  },
  {
    taskMatch: /extract email/i,
    formula: '=REGEXEXTRACT({input}, "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}")',
    description: 'Extract email address',
    reliability: 'conditional',
    warning: 'Returns #N/A if no email found in cell.',
  },
  {
    taskMatch: /word count|count words/i,
    formula: '=IF(LEN(TRIM({input}))=0, 0, LEN(TRIM({input}))-LEN(SUBSTITUTE({input}," ",""))+1)',
    description: 'Count words in text',
    reliability: 'conditional',
    warning: 'Empty cells return 0.',
  },
];

// ============================================
// MAIN FUNCTIONS
// ============================================

export interface DetectedTask {
  type: TaskType;
  config: TaskConfig;
  extractedParams: Record<string, string>;
  confidence: 'high' | 'medium' | 'low';
  formulaAlternative?: {
    formula: string;
    description: string;
    /** 'guaranteed' = 100% safe, 'conditional' = may fail on bad data */
    reliability: 'guaranteed' | 'conditional';
    warning?: string;
  };
}

/**
 * Detect task type from natural language command
 */
export function detectTaskType(command: string): DetectedTask {
  const normalizedCommand = command.toLowerCase().trim();
  const extractedParams: Record<string, string> = {};
  let matchedType: TaskType = 'custom';
  let confidence: 'high' | 'medium' | 'low' = 'low';
  
  // Try to match against known patterns
  for (const taskPattern of TASK_PATTERNS) {
    for (const pattern of taskPattern.patterns) {
      if (pattern.test(normalizedCommand)) {
        matchedType = taskPattern.type;
        confidence = 'high';
        
        // Extract parameters if available
        if (taskPattern.extractors) {
          for (const [key, extractor] of Object.entries(taskPattern.extractors)) {
            const match = command.match(extractor);
            if (match) {
              extractedParams[key] = match[1];
            }
          }
        }
        break;
      }
    }
    if (confidence === 'high') break;
  }
  
  // Check for formula alternative
  let formulaAlternative: DetectedTask['formulaAlternative'] = undefined;
  for (const fp of FORMULA_PATTERNS) {
    if (fp.taskMatch.test(command)) {
      formulaAlternative = {
        formula: fp.formula,
        description: fp.description,
        reliability: fp.reliability,
        warning: fp.warning,
      };
      break;
    }
  }
  
  return {
    type: matchedType,
    config: TASK_CONFIGS[matchedType],
    extractedParams,
    confidence,
    formulaAlternative,
  };
}

/**
 * Build optimized prompt from task detection
 */
export function buildOptimizedPrompt(
  command: string,
  detected: DetectedTask,
  context?: {
    headerName?: string;
    today?: string;
  }
): string {
  const { config, extractedParams } = detected;
  let prompt = config.promptTemplate;
  
  console.log('[BuildPrompt] Starting with template:', prompt);
  console.log('[BuildPrompt] ExtractedParams:', extractedParams);
  console.log('[BuildPrompt] Context:', context);
  
  // Fill in extracted parameters
  for (const [key, value] of Object.entries(extractedParams)) {
    prompt = prompt.replace(`{${key}}`, value);
  }
  
  // Fill in context
  if (context?.today) {
    prompt = prompt.replace('{today}', context.today);
  }
  
  // Handle specific task types with smarter defaults
  switch (detected.type) {
    case 'translate':
      if (!extractedParams.language) {
        // Try to extract from original command
        const langMatch = command.match(/to (\w+)$/i);
        prompt = prompt.replace('{language}', langMatch?.[1] || 'the target language');
      }
      break;
      
    case 'classify':
      if (!extractedParams.categories) {
        // Use command as categories hint
        prompt = `Classify: {{input}}. ${command}`;
      }
      break;
      
    case 'calculate':
      // For calculate tasks, ensure we have good defaults
      if (!extractedParams.calculation) {
        // Extract what we're calculating from the command
        const calcMatch = command.match(/(seniority|age|years|months|days|difference)/i);
        extractedParams.calculation = calcMatch?.[1] || 'value';
      }
      
      console.log('[BuildPrompt:calculate] calculation =', extractedParams.calculation);
      
      // Fill in calculation
      prompt = prompt.replace('{calculation}', extractedParams.calculation);
      console.log('[BuildPrompt:calculate] after calc:', prompt);
      
      // Fill in header name for context (e.g., "employee start date")
      const headerLabel = context?.headerName || 'Input';
      console.log('[BuildPrompt:calculate] headerLabel =', headerLabel);
      prompt = prompt.replace('{headerName}', headerLabel);
      console.log('[BuildPrompt:calculate] after header:', prompt);
      
      // Set default format if not specified
      prompt = prompt.replace('{format}', 'X years, Y months');
      console.log('[BuildPrompt:calculate] after format:', prompt);
      
      // Fill in today if available
      if (context?.today) {
        prompt = prompt.replace('{today}', context.today);
        console.log('[BuildPrompt:calculate] after today:', prompt);
      }
      break;
      
    case 'summarize':
      if (!extractedParams.length) {
        prompt = prompt.replace('{length}', '1-2 sentences');
      }
      break;
      
    case 'custom':
      // For custom, use the original command as the prompt
      prompt = `${command}\n\nInput: {{input}}`;
      break;
  }
  
  // Clean up any remaining single-brace placeholders (NOT double braces like {{input}})
  // Use negative lookbehind/lookahead to avoid matching {{input}}
  const beforeCleanup = prompt;
  prompt = prompt.replace(/(?<!\{)\{[^{}]+\}(?!\})/g, '');
  
  if (beforeCleanup !== prompt) {
    console.log('[BuildPrompt] Cleanup removed placeholders:', beforeCleanup, '->', prompt);
  }
  
  console.log('[BuildPrompt] Final prompt:', prompt.trim());
  return prompt.trim();
}

/**
 * Get processing strategy recommendation
 */
export interface ProcessingStrategy {
  batchable: boolean;
  recommendedBatchSize: number;
  estimatedTokensPerRow: number;
  recommendedModel: 'fast' | 'balanced' | 'quality';
  systemPrompt?: string;
}

export function getProcessingStrategy(detected: DetectedTask, rowCount: number): ProcessingStrategy {
  const { config } = detected;
  
  // Determine batch size based on task type and row count
  let batchSize = config.batchable ? Math.min(20, rowCount) : 1;
  
  // Adjust for very long inputs (summarization)
  if (detected.type === 'summarize' || detected.type === 'generate') {
    batchSize = 1; // Process individually for quality
  }
  
  return {
    batchable: config.batchable,
    recommendedBatchSize: batchSize,
    estimatedTokensPerRow: config.avgTokensPerRow,
    recommendedModel: config.recommendedModel,
    systemPrompt: config.systemPromptAddition,
  };
}

/**
 * Map recommended model tier to actual model
 */
export function getRecommendedModel(
  tier: 'fast' | 'balanced' | 'quality',
  userPreference?: string
): { provider: string; model: string } {
  // If user has a preference and it's a quality task, respect it
  if (tier === 'quality' && userPreference) {
    return parseUserModel(userPreference);
  }
  
  // Otherwise use cost-optimized defaults
  switch (tier) {
    case 'fast':
      return { provider: 'GEMINI', model: 'gemini-2.0-flash' };
    case 'balanced':
      return { provider: 'GEMINI', model: 'gemini-1.5-flash' };
    case 'quality':
      return { provider: 'CLAUDE', model: 'claude-haiku-4-5' };
    default:
      return { provider: 'GEMINI', model: 'gemini-1.5-flash' };
  }
}

function parseUserModel(preference: string): { provider: string; model: string } {
  const providerMap: Record<string, { provider: string; model: string }> = {
    'CHATGPT': { provider: 'CHATGPT', model: 'gpt-4o-mini' },
    'CLAUDE': { provider: 'CLAUDE', model: 'claude-haiku-4-5' },
    'GEMINI': { provider: 'GEMINI', model: 'gemini-1.5-flash' },
    'GROQ': { provider: 'GROQ', model: 'llama-3.3-70b-versatile' },
  };
  return providerMap[preference] || providerMap['GEMINI'];
}

// ============================================
// EXPORTS
// ============================================

export const taskOptimizer = {
  detectTaskType,
  buildOptimizedPrompt,
  getProcessingStrategy,
  getRecommendedModel,
  TASK_CONFIGS,
  FORMULA_PATTERNS,
};

export default taskOptimizer;
