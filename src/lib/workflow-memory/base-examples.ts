/**
 * Base Examples for Few-Shot Learning
 * 
 * These examples are used when no similar workflows exist in memory.
 * They teach the AI what good workflow output looks like.
 * 
 * IMPORTANT: These examples must be:
 * 1. Diverse - covering different domains and use cases
 * 2. High-quality - showing exactly the format we expect
 * 3. Realistic - using actual prompts that work well
 * 4. Complete - including all required fields
 * 
 * @version 1.0.0
 * @updated 2026-01-20
 */

export interface BaseExample {
  command: string;
  context: string;  // Brief description of the data context
  workflow: {
    steps: Array<{
      action: string;
      description: string;
      prompt: string;
      outputFormat: string;
    }>;
    summary: string;
    clarification: string;
  };
}

/**
 * Base examples for cold start - covers major use cases
 */
export const BASE_EXAMPLES: BaseExample[] = [
  // ============================================
  // EXAMPLE 1: Sales Pipeline Analysis
  // ============================================
  {
    command: "Our sales team writes detailed notes but we don't have time to read them all. We need pipeline insights, next steps, and risk flags.",
    context: "Columns: Company, Deal Size, Stage, Sales Notes",
    workflow: {
      steps: [
        {
          action: "extract",
          description: "Extract buying signals and blockers from notes",
          prompt: `Analyze these sales notes and extract:

1. BUYING SIGNALS: Positive indicators (budget confirmed, timeline set, champion identified, decision maker engaged)
2. BLOCKERS: Concerns, objections, or obstacles mentioned
3. COMPETITORS: Any competitor mentions

Be specific - quote the actual signals/blockers from the notes.

Format: Signal: [specific signal] | Blocker: [specific blocker] | Competitor: [name or "none"]`,
          outputFormat: "Signal | Blocker | Competitor"
        },
        {
          action: "analyze",
          description: "Assess deal health and win probability",
          prompt: `Based on the deal stage, size, and the extracted signals/blockers, assess:

1. DEAL HEALTH:
   - Healthy: Strong signals, minor/no blockers
   - At Risk: Mixed signals, significant blockers
   - Critical: Weak signals, major blockers

2. WIN PROBABILITY: High (70%+), Medium (40-70%), Low (<40%)

3. KEY RISK: The single biggest factor that could kill this deal

Format: [Health] | [Probability] | Risk: [specific risk]`,
          outputFormat: "Health | Probability | Risk"
        },
        {
          action: "generate",
          description: "Generate specific next action for rep",
          prompt: `Based on the deal status and risks identified, generate ONE specific, actionable next step.

Be concrete and specific:
- BAD: "Follow up with customer"
- GOOD: "Schedule technical deep-dive with CTO to address API integration concerns by Friday"

Include: WHO should do WHAT by WHEN`,
          outputFormat: "Next action"
        }
      ],
      summary: "3-step sales pipeline analysis: extract signals, assess health, generate actions",
      clarification: "I'll analyze each deal's notes to extract buying signals and blockers, assess the deal health and win probability, and generate specific next actions for your reps."
    }
  },

  // ============================================
  // EXAMPLE 2: Customer Feedback Analysis
  // ============================================
  {
    command: "Categorize customer feedback by sentiment and topic, then suggest appropriate responses",
    context: "Columns: Customer Name, Feedback Text, Date",
    workflow: {
      steps: [
        {
          action: "classify",
          description: "Classify sentiment of feedback",
          prompt: `Classify the sentiment of this customer feedback:

- POSITIVE: Happy, satisfied, praising, recommending
- NEGATIVE: Unhappy, frustrated, complaining, threatening to leave  
- NEUTRAL: Factual, requesting information, neither positive nor negative
- MIXED: Contains both positive and negative elements

Also rate intensity: Strong or Mild

Format: [Sentiment] ([Intensity])`,
          outputFormat: "Sentiment (Intensity)"
        },
        {
          action: "extract",
          description: "Extract main topic and specific issue",
          prompt: `Extract the main topic and specific issue from this feedback:

TOPICS: Product Quality, Customer Service, Pricing, Delivery, Usability, Feature Request, Bug Report, Other

Be specific about WHAT exactly they're commenting on.

Format: [Topic]: [Specific issue in 5-10 words]`,
          outputFormat: "Topic: Specific issue"
        },
        {
          action: "generate",
          description: "Draft appropriate response",
          prompt: `Draft a brief, appropriate response to this feedback based on sentiment:

For NEGATIVE: Acknowledge, apologize, offer solution or escalation path
For POSITIVE: Thank them, encourage sharing/review, mention loyalty program
For NEUTRAL: Answer directly, provide requested info, offer further help

Keep response under 50 words. Be empathetic and professional.`,
          outputFormat: "Draft response"
        }
      ],
      summary: "3-step feedback analysis: classify sentiment, extract topic, draft response",
      clarification: "I'll classify each piece of feedback by sentiment, identify the main topic and issue, then draft an appropriate response you can customize."
    }
  },

  // ============================================
  // EXAMPLE 3: Resume/Candidate Screening
  // ============================================
  {
    command: "Screen these resumes against our job requirements and flag the best candidates",
    context: "Columns: Candidate Name, Resume/Experience Summary, Applied Position",
    workflow: {
      steps: [
        {
          action: "extract",
          description: "Extract key qualifications from resume",
          prompt: `Extract the following from this candidate's resume/profile:

1. YEARS OF EXPERIENCE: Total relevant years
2. KEY SKILLS: Top 3-5 most relevant skills
3. EDUCATION: Highest degree and field
4. NOTABLE: Any standout achievements or companies

Format: [Years]yrs | Skills: [skill1, skill2, skill3] | [Degree] | Notable: [achievement]`,
          outputFormat: "Years | Skills | Education | Notable"
        },
        {
          action: "classify",
          description: "Rate match against typical job requirements",
          prompt: `Rate how well this candidate matches typical requirements:

- STRONG MATCH: Meets or exceeds all key requirements
- GOOD MATCH: Meets most requirements, minor gaps
- PARTIAL MATCH: Meets some requirements, notable gaps
- WEAK MATCH: Missing several key requirements

Include the main strength and main gap.

Format: [Match Level] - Strength: [strength] | Gap: [gap or "none"]`,
          outputFormat: "Match Level - Strength | Gap"
        },
        {
          action: "generate",
          description: "Generate screening decision and notes",
          prompt: `Based on the qualifications and match level, provide:

1. DECISION: Advance (phone screen), Maybe (review with team), or Pass
2. If Advance: 2 specific questions to ask in phone screen
3. If Pass: Brief reason (for records)

Be specific and actionable.`,
          outputFormat: "Decision + Notes"
        }
      ],
      summary: "3-step resume screening: extract qualifications, rate match, generate decision",
      clarification: "I'll extract key qualifications from each resume, rate the match against requirements, and provide a screening decision with specific follow-up questions or notes."
    }
  },

  // ============================================
  // EXAMPLE 4: Data Quality / Validation
  // ============================================
  {
    command: "Check this data for quality issues and suggest corrections",
    context: "Columns: Name, Email, Phone, Address",
    workflow: {
      steps: [
        {
          action: "validate",
          description: "Check data completeness and format",
          prompt: `Check this record for data quality issues:

1. COMPLETENESS: Are required fields filled? (Name, Email required; Phone, Address optional)
2. FORMAT: 
   - Email: valid format (x@y.z)?
   - Phone: consistent format?
   - Name: properly capitalized?
3. OBVIOUS ERRORS: Typos, impossible values, test data

Format: [Complete/Incomplete] | Issues: [list issues or "none"]`,
          outputFormat: "Status | Issues"
        },
        {
          action: "clean",
          description: "Suggest corrected values",
          prompt: `For any issues found, suggest the corrected value:

- Fix capitalization (john doe → John Doe)
- Fix obvious typos
- Standardize phone format to (XXX) XXX-XXXX
- Flag but don't guess at missing data

If no corrections needed: "No corrections"

Format: [Field]: [Original] → [Corrected]`,
          outputFormat: "Corrections"
        }
      ],
      summary: "2-step data validation: check quality, suggest corrections",
      clarification: "I'll check each record for completeness and format issues, then suggest specific corrections for any problems found."
    }
  },

  // ============================================
  // EXAMPLE 5: Content Summarization
  // ============================================
  {
    command: "Summarize these articles and extract the key takeaways",
    context: "Columns: Title, Article Text, Source",
    workflow: {
      steps: [
        {
          action: "summarize",
          description: "Create concise summary of article",
          prompt: `Summarize this article in 2-3 sentences:

1. What is the main topic/event?
2. What is the key finding or conclusion?
3. Why does it matter?

Be concise but capture the essence. No filler words.`,
          outputFormat: "2-3 sentence summary"
        },
        {
          action: "extract",
          description: "Extract key takeaways and facts",
          prompt: `Extract 2-3 key takeaways from this article:

Focus on:
- Actionable insights
- Surprising facts or statistics
- Important quotes or claims

Format as bullet points, each under 15 words.`,
          outputFormat: "Bullet point takeaways"
        }
      ],
      summary: "2-step content analysis: summarize article, extract takeaways",
      clarification: "I'll create a concise summary of each article and extract the key takeaways you can quickly scan."
    }
  },

  // ============================================
  // EXAMPLE 6: Multi-Aspect Sentiment Analysis
  // ============================================
  {
    command: "Analyze sentiment by aspect: rate Performance, UX, Pricing, and Features as Positive/Negative/Neutral for each feedback",
    context: "Columns: Customer, Feedback Text, Product",
    workflow: {
      steps: [
        {
          action: "classify",
          description: "Rate sentiment for Performance, UX, Pricing, Features",
          prompt: `Analyze this feedback and rate sentiment for EACH of these aspects:

1. PERFORMANCE: Speed, reliability, uptime, responsiveness
2. UX (User Experience): Ease of use, interface, design, navigation
3. PRICING: Value for money, cost concerns, pricing model
4. FEATURES: Functionality, capabilities, feature requests

For each aspect, return:
- POSITIVE: If feedback explicitly praises this aspect
- NEGATIVE: If feedback explicitly criticizes this aspect  
- NEUTRAL: If aspect not mentioned OR neutral comment

Output exactly 4 values separated by " | ".

Example: "Positive | Negative | Neutral | Positive"`,
          outputFormat: "Performance | UX | Pricing | Features"
        }
      ],
      summary: "Aspect-based sentiment analysis across 4 dimensions",
      clarification: "I'll analyze each piece of feedback and rate sentiment for Performance, UX, Pricing, and Features separately."
    }
  }
];

/**
 * Get a subset of examples most relevant to the user's command
 * (Simple keyword matching for fallback when no semantic matches)
 */
export function getRelevantBaseExamples(command: string, count: number = 3): BaseExample[] {
  const lowerCommand = command.toLowerCase();
  
  // Score each example by keyword relevance
  const scored = BASE_EXAMPLES.map(example => {
    let score = 0;
    const exampleText = (example.command + ' ' + example.context).toLowerCase();
    
    // Check for domain keywords
    if (lowerCommand.includes('sales') || lowerCommand.includes('deal') || lowerCommand.includes('pipeline')) {
      if (exampleText.includes('sales')) score += 3;
    }
    if (lowerCommand.includes('feedback') || lowerCommand.includes('customer') || lowerCommand.includes('review')) {
      if (exampleText.includes('feedback') || exampleText.includes('customer')) score += 3;
    }
    if (lowerCommand.includes('resume') || lowerCommand.includes('candidate') || lowerCommand.includes('hiring')) {
      if (exampleText.includes('resume') || exampleText.includes('candidate')) score += 3;
    }
    if (lowerCommand.includes('data') || lowerCommand.includes('quality') || lowerCommand.includes('clean')) {
      if (exampleText.includes('quality') || exampleText.includes('validation')) score += 3;
    }
    if (lowerCommand.includes('summarize') || lowerCommand.includes('article') || lowerCommand.includes('content')) {
      if (exampleText.includes('summarize') || exampleText.includes('article')) score += 3;
    }
    if (lowerCommand.includes('sentiment') || lowerCommand.includes('aspect') || lowerCommand.includes('rate')) {
      if (exampleText.includes('sentiment') || exampleText.includes('aspect')) score += 3;
    }
    
    // Check for action keywords
    if (lowerCommand.includes('extract') && exampleText.includes('extract')) score += 1;
    if (lowerCommand.includes('classify') && exampleText.includes('classify')) score += 1;
    if (lowerCommand.includes('analyze') && exampleText.includes('analyze')) score += 1;
    if (lowerCommand.includes('generate') && exampleText.includes('generate')) score += 1;
    
    return { example, score };
  });
  
  // Sort by score descending, take top N
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map(s => s.example);
}

export default BASE_EXAMPLES;
