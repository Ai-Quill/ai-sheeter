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
  | 'analyze'  // NEW: Complex multi-factor reasoning tasks
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
  
  analyze: {
    type: 'analyze',
    batchable: false, // Analysis needs individual attention for quality
    recommendedModel: 'quality',
    avgTokensPerRow: 200,
    promptTemplate: 'Analyze {{input}} and provide: {outputs}',
    systemPromptAddition: 'You are an expert analyst. Provide clear, structured insights. For multiple outputs, separate with |||.',
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
  // ============================================
  // ANALYZE - Must be checked BEFORE classify!
  // Complex multi-factor reasoning tasks
  // ============================================
  {
    type: 'analyze',
    patterns: [
      // Multi-output patterns (highest priority)
      /return:?\s*\w+\s*\|\s*\w+/i,  // "return: X | Y | Z"
      /provide:?\s*\w+[,\s]+\w+[,\s]+(?:and\s+)?\w+/i, // "provide X, Y, and Z"
      /\w+\s*\|\|\|\s*\w+/i, // "X ||| Y ||| Z"
      /columns?\s+[A-Z],?\s*[A-Z],?\s*(?:and\s+)?[A-Z]/i, // "columns G, H, and I"
      
      // Analysis keywords
      /analyz(e|is)/i,
      /insight/i,
      /pipeline\s+(intelligence|insights?)/i,
      /business\s+intelligence/i,
      /deal\s+(health|status|analysis)/i,
      
      // Complex problem descriptions (need reasoning)
      /nobody.*(time|read|understand)/i, // "nobody has time to read"
      /leadership\s+wants/i,
      /falling\s+through\s+(the\s+)?cracks/i,
      
      // Multi-stakeholder needs
      /wants?\s+.+,\s*\w+\s+needs?\s+/i, // "X wants A, Y needs B"
    ],
    extractors: {
      outputs: /(?:return|provide|generate):?\s*(.+?)(?:\.|$)/i,
    },
  },
  
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
      /extract\s+(the\s+)?(key\s+)?(buying\s+)?signals?/i,
      /extract\s+(the\s+)?objections?/i,
      /extract\s+(the\s+)?competitors?/i,
      /extract/i,
      /find (all )?(email|phone|url|name|date|number)/i,
      /get (the )?(email|phone|url|name|date|number)/i,
      /pull out/i,
    ],
    extractors: {
      target: /(email|phone|url|name|date|number|address|signal|objection|competitor)/i,
    },
  },
  {
    type: 'classify',
    patterns: [
      // Simple classification patterns (NOT complex analysis)
      /^classif(y|ication)\s+(as|into)\s+/i,  // "classify as Hot/Cold"
      /^categoriz(e|ation)\s+(as|into)\s+/i, // "categorize into X/Y"
      /^label\s+(as|each)\s+/i,
      /^(is it|is this)\s+.+\s+or\s+.+\?/i,  // "is it X or Y?"
      /sentiment\s+(analysis|score)/i,
      /^(positive|negative)\s+or\s+/i,
      /^(urgent|normal)\s+or\s+/i,
      /\b(hot|warm|cold)\b.*\b(hot|warm|cold)\b/i, // "Hot/Warm/Cold" categories
    ],
    extractors: {
      categories: /(?:as |into |: ?)([^.]+)$/i,
    },
  },
  {
    type: 'generate',
    patterns: [
      /generat(e|ion)\s+(specific\s+)?(next\s+)?(action|step|recommendation)/i,
      /suggest\s+(next\s+)?(action|step)/i,
      /recommend\s+(next\s+)?(action|step)/i,
      /what\s+should\s+(we|they|I)\s+do/i,
      /creat(e|ion)\s+(?:a\s+)?recommendation/i,
      /writ(e|ing)\s+(?:a |an )/i,
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
    taskMatch: /outstanding|overdue|days? (since|outstanding|overdue|elapsed)/i,
    formula: '=TODAY()-{input}',
    description: 'Calculate days since date (outstanding/overdue days)',
    reliability: 'conditional',
    warning: 'Requires valid date format. Returns negative if date is in future.',
  },
  {
    taskMatch: /days? (until|remaining|left|to)/i,
    formula: '={input}-TODAY()',
    description: 'Calculate days until date',
    reliability: 'conditional',
    warning: 'Requires valid date format. Returns negative if date is in past.',
  },
  {
    taskMatch: /days? between|date diff/i,
    formula: '=DATEDIF({input}, TODAY(), "D")',
    description: 'Calculate days between dates',
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
        const calcMatch = command.match(/(seniority|age|years|months|days?|outstanding|overdue|difference)/i);
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
      
      // Set format based on calculation type
      let defaultFormat = 'X years, Y months';
      const lowerCalc = extractedParams.calculation?.toLowerCase() || '';
      const lowerCommand = command.toLowerCase();
      
      if (lowerCalc.includes('day') || lowerCommand.includes('outstanding') || lowerCommand.includes('overdue') || lowerCommand.includes('days since') || lowerCommand.includes('days until')) {
        defaultFormat = 'number of days (integer)';
      } else if (lowerCalc === 'age') {
        defaultFormat = 'age in years (integer)';
      }
      
      prompt = prompt.replace('{format}', defaultFormat);
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
      
    case 'analyze':
      // For analysis tasks, create a structured prompt
      if (extractedParams.outputs) {
        prompt = prompt.replace('{outputs}', extractedParams.outputs);
      } else {
        // Create structured output format from command analysis
        prompt = `Analyze this data and provide structured insights:\n${command}\n\nData: {{input}}\n\nProvide outputs separated by |||`;
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
  
  // Adjust for very long inputs (summarization, generation, analysis)
  if (detected.type === 'summarize' || detected.type === 'generate' || detected.type === 'analyze') {
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
      return { provider: 'GEMINI', model: 'gemini-2.5-flash' };
    case 'balanced':
      return { provider: 'GEMINI', model: 'gemini-2.5-flash' };
    case 'quality':
      return { provider: 'CLAUDE', model: 'claude-haiku-4-5' };
    default:
      return { provider: 'GEMINI', model: 'gemini-2.5-flash' };
  }
}

function parseUserModel(preference: string): { provider: string; model: string } {
  const providerMap: Record<string, { provider: string; model: string }> = {
    'CHATGPT': { provider: 'CHATGPT', model: 'gpt-5-mini' },
    'CLAUDE': { provider: 'CLAUDE', model: 'claude-haiku-4-5' },
    'GEMINI': { provider: 'GEMINI', model: 'gemini-2.5-flash' },
    'GROQ': { provider: 'GROQ', model: 'meta-llama/llama-4-scout-17b-16e-instruct' },
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
