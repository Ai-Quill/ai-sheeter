-- ============================================
-- SEED SKILL RESPONSE EXAMPLES
-- ============================================
-- 
-- Cold-start fix: The AI needs few-shot examples showing HOW to 
-- generate correct responses. These are loaded by loadDynamicExamples()
-- from skill_usage table where is_good_example = TRUE.
--
-- This migration seeds curated examples for each major skill.
--
-- @version 1.0.0
-- @created 2026-02-04
-- ============================================

-- Helper function to insert seed examples
-- Note: Uses placeholder embedding (will be populated by initializeSeedEmbeddings)
CREATE OR REPLACE FUNCTION seed_skill_response_example(
  p_skill_id TEXT,
  p_command TEXT,
  p_ai_response JSONB,
  p_quality_score FLOAT DEFAULT 0.9
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO skill_usage (
    skill_id,
    skill_version,
    command,
    command_embedding,
    success,
    ai_response,
    is_good_example,
    example_quality_score
  )
  VALUES (
    p_skill_id,
    '2.0.0',
    p_command,
    array_fill(0::float, ARRAY[1536])::vector,  -- Placeholder, will be populated
    true,
    p_ai_response,
    true,
    p_quality_score
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- ============================================
-- FORMAT SKILL EXAMPLES
-- ============================================

-- Example 1: Single operation - header styling
SELECT seed_skill_response_example(
  'format',
  'Make the header bold with blue background and white text',
  '{
    "outputMode": "sheet",
    "sheetAction": "format",
    "sheetConfig": {
      "formatType": "text",
      "range": "A1:G1",
      "options": {
        "bold": true,
        "backgroundColor": "#1a73e8",
        "textColor": "#FFFFFF",
        "fontSize": 11
      }
    },
    "summary": "Format header row",
    "clarification": "Applying bold, blue background, white text to header row."
  }'::jsonb
);

-- Example 2: Multi-operation formatting (THIS IS KEY!)
SELECT seed_skill_response_example(
  'format',
  'Format this professionally: bold blue header with white text, currency format for columns C D E, and add borders',
  '{
    "outputMode": "sheet",
    "sheetAction": "format",
    "sheetConfig": {
      "operations": [
        {
          "range": "A1:G1",
          "formatting": {
            "bold": true,
            "backgroundColor": "#1a73e8",
            "textColor": "#FFFFFF",
            "fontSize": 11,
            "alignment": "center"
          }
        },
        {
          "range": "C2:C100",
          "formatting": {
            "formatType": "currency"
          }
        },
        {
          "range": "D2:D100",
          "formatting": {
            "formatType": "currency"
          }
        },
        {
          "range": "E2:E100",
          "formatting": {
            "formatType": "currency"
          }
        },
        {
          "range": "A1:G100",
          "formatting": {
            "borders": true
          }
        }
      ]
    },
    "summary": "Apply professional formatting",
    "clarification": "Applied bold blue header, currency format to columns C-E, and borders to all cells."
  }'::jsonb,
  0.95  -- High quality - this is a key example
);

-- Example 3: Currency only
SELECT seed_skill_response_example(
  'format',
  'Format column C as currency',
  '{
    "outputMode": "sheet",
    "sheetAction": "format",
    "sheetConfig": {
      "formatType": "currency",
      "range": "C2:C100",
      "options": {
        "decimals": 2
      }
    },
    "summary": "Format as currency",
    "clarification": "Applying currency format to column C."
  }'::jsonb
);

-- Example 4: Borders and alignment
SELECT seed_skill_response_example(
  'format',
  'Add borders to all cells and center the header',
  '{
    "outputMode": "sheet",
    "sheetAction": "format",
    "sheetConfig": {
      "operations": [
        {
          "range": "A1:G100",
          "formatting": {
            "borders": true
          }
        },
        {
          "range": "A1:G1",
          "formatting": {
            "alignment": "center"
          }
        }
      ]
    },
    "summary": "Add borders and center header",
    "clarification": "Adding borders to all cells and centering the header row."
  }'::jsonb
);

-- ============================================
-- CHART SKILL EXAMPLES
-- ============================================

-- Example 1: Bar/Column chart
SELECT seed_skill_response_example(
  'chart',
  'Create a bar chart comparing Q1 vs Q2 sales by rep',
  '{
    "outputMode": "sheet",
    "sheetAction": "chart",
    "sheetConfig": {
      "chartType": "column",
      "domainColumn": "B",
      "dataColumns": ["C", "D"],
      "seriesNames": ["Q1_Sales", "Q2_Sales"],
      "title": "Q1 vs Q2 Sales by Rep",
      "legendPosition": "bottom",
      "yAxisFormat": "currency"
    },
    "summary": "Create bar chart comparing Q1 vs Q2",
    "clarification": "Creating a column chart with rep names on X-axis and Q1/Q2 sales as series."
  }'::jsonb
);

-- Example 2: Pie chart
SELECT seed_skill_response_example(
  'chart',
  'Create a pie chart showing revenue by region',
  '{
    "outputMode": "sheet",
    "sheetAction": "chart",
    "sheetConfig": {
      "chartType": "pie",
      "domainColumn": "A",
      "dataColumns": ["B"],
      "title": "Revenue by Region",
      "pieSliceText": "percentage",
      "legendPosition": "right"
    },
    "summary": "Create pie chart",
    "clarification": "Creating a pie chart showing revenue distribution by region."
  }'::jsonb
);

-- Example 3: Line chart
SELECT seed_skill_response_example(
  'chart',
  'Create a line chart showing sales trend over time',
  '{
    "outputMode": "sheet",
    "sheetAction": "chart",
    "sheetConfig": {
      "chartType": "line",
      "domainColumn": "A",
      "dataColumns": ["B"],
      "seriesNames": ["Sales"],
      "title": "Sales Trend",
      "curveType": "smooth",
      "pointSize": 5
    },
    "summary": "Create line chart",
    "clarification": "Creating a smooth line chart showing sales trend over time."
  }'::jsonb
);

-- ============================================
-- CONDITIONAL FORMAT SKILL EXAMPLES
-- ============================================

-- Example 1: Comparison-based highlighting
SELECT seed_skill_response_example(
  'conditionalFormat',
  'Highlight rows green where Q2 beat target, red where below target',
  '{
    "outputMode": "sheet",
    "sheetAction": "conditionalFormat",
    "sheetConfig": {
      "range": "A2:G100",
      "rules": [
        {
          "condition": "customFormula",
          "value": "=$D2>$E2",
          "format": { "backgroundColor": "#90EE90" }
        },
        {
          "condition": "customFormula",
          "value": "=$D2<$E2",
          "format": { "backgroundColor": "#FFB6C1" }
        }
      ]
    },
    "summary": "Highlight rows based on target comparison",
    "clarification": "Adding green highlighting where Q2 > Target, red where Q2 < Target."
  }'::jsonb
);

-- Example 2: Simple threshold
SELECT seed_skill_response_example(
  'conditionalFormat',
  'Highlight cells greater than 100000 in green',
  '{
    "outputMode": "sheet",
    "sheetAction": "conditionalFormat",
    "sheetConfig": {
      "range": "C2:C100",
      "rules": [
        {
          "condition": "greaterThan",
          "value": 100000,
          "format": { "backgroundColor": "#90EE90" }
        }
      ]
    },
    "summary": "Highlight values over 100000",
    "clarification": "Highlighting cells greater than 100000 in green."
  }'::jsonb
);

-- Example 3: Negative values
SELECT seed_skill_response_example(
  'conditionalFormat',
  'Make negative values red',
  '{
    "outputMode": "sheet",
    "sheetAction": "conditionalFormat",
    "sheetConfig": {
      "range": "C2:E100",
      "rules": [
        {
          "condition": "negative",
          "format": { "backgroundColor": "#FFB6C1", "textColor": "#8B0000" }
        }
      ]
    },
    "summary": "Highlight negative values",
    "clarification": "Highlighting negative values in red."
  }'::jsonb
);

-- ============================================
-- SHEET OPS SKILL EXAMPLES
-- ============================================

-- Example 1: Freeze and sort (USES operations ARRAY)
SELECT seed_skill_response_example(
  'sheetOps',
  'Freeze the header row and sort by Q2_Sales descending',
  '{
    "outputMode": "sheet",
    "sheetAction": "sheetOps",
    "sheetConfig": {
      "operations": [
        { "operation": "freezeRows", "rows": 1 },
        { "operation": "sort", "range": "A1:G31", "sortBy": [{ "column": "D", "ascending": false }] }
      ]
    },
    "summary": "Freeze header and sort by Q2_Sales",
    "clarification": "Freezing top row and sorting by Q2_Sales column descending."
  }'::jsonb,
  0.95
);

-- Example 2: Just freeze rows
SELECT seed_skill_response_example(
  'sheetOps',
  'Freeze the first row',
  '{
    "outputMode": "sheet",
    "sheetAction": "sheetOps",
    "sheetConfig": {
      "operations": [
        { "operation": "freezeRows", "rows": 1 }
      ]
    },
    "summary": "Freeze header row",
    "clarification": "Freezing the first row so it stays visible when scrolling."
  }'::jsonb
);

-- Example 3: Sort only
SELECT seed_skill_response_example(
  'sheetOps',
  'Sort by Sales column descending',
  '{
    "outputMode": "sheet",
    "sheetAction": "sheetOps",
    "sheetConfig": {
      "operations": [
        { "operation": "sort", "sortBy": [{ "column": "C", "ascending": false }] }
      ]
    },
    "summary": "Sort data by Sales",
    "clarification": "Sorting data by Sales column in descending order."
  }'::jsonb
);

-- ============================================
-- DATA VALIDATION SKILL EXAMPLES
-- ============================================

SELECT seed_skill_response_example(
  'dataValidation',
  'Add a dropdown with High, Medium, Low to column F',
  '{
    "outputMode": "sheet",
    "sheetAction": "dataValidation",
    "sheetConfig": {
      "range": "F2:F100",
      "validationType": "dropdown",
      "values": ["High", "Medium", "Low"],
      "allowInvalid": false
    },
    "summary": "Add priority dropdown",
    "clarification": "Adding dropdown validation with High/Medium/Low options."
  }'::jsonb
);

-- ============================================
-- WRITE DATA SKILL EXAMPLES
-- ============================================

SELECT seed_skill_response_example(
  'writeData',
  'Create a table from this data:
Name,Age,City
John,30,NYC
Jane,25,LA',
  '{
    "outputMode": "sheet",
    "sheetAction": "writeData",
    "sheetConfig": {
      "data": [
        ["Name", "Age", "City"],
        ["John", 30, "NYC"],
        ["Jane", 25, "LA"]
      ],
      "startCell": "A1"
    },
    "summary": "Create table from data",
    "clarification": "Writing the provided data to the sheet starting at A1."
  }'::jsonb
);

-- ============================================
-- FORMULA SKILL EXAMPLES (Calculated Columns - FORMULA FIRST)
-- Uses outputMode: "formula" NOT sheetAction
-- ============================================

-- Example 1: Conditional bonus calculation
SELECT seed_skill_response_example(
  'formula',
  'Add a new column called Bonus that calculates 5% of Q2_Sales if they beat their target, otherwise 0',
  '{
    "outputMode": "formula",
    "isMultiStep": false,
    "isCommand": true,
    "steps": [{
      "action": "formula",
      "description": "Bonus",
      "prompt": "=IF(D{{ROW}}>E{{ROW}}, D{{ROW}}*0.05, 0)",
      "outputFormat": "formula"
    }],
    "summary": "Add conditional bonus column",
    "clarification": "Adding Bonus column: 5% of Q2 if Q2 > Target, otherwise 0.\n\n✅ FREE ✅ Instant ✅ Auto-updates"
  }'::jsonb,
  0.95
);

-- Example 2: Commission calculation
SELECT seed_skill_response_example(
  'formula',
  'Create a Commission column that is 10% of Sales',
  '{
    "outputMode": "formula",
    "isMultiStep": false,
    "isCommand": true,
    "steps": [{
      "action": "formula",
      "description": "Commission",
      "prompt": "=C{{ROW}}*0.1",
      "outputFormat": "formula"
    }],
    "summary": "Add commission column",
    "clarification": "Adding Commission column: 10% of Sales.\n\n✅ FREE ✅ Instant ✅ Auto-updates"
  }'::jsonb
);

-- Example 3: Variance calculation
SELECT seed_skill_response_example(
  'formula',
  'Add a Variance column showing the difference between Actual and Budget',
  '{
    "outputMode": "formula",
    "isMultiStep": false,
    "isCommand": true,
    "steps": [{
      "action": "formula",
      "description": "Variance",
      "prompt": "=C{{ROW}}-D{{ROW}}",
      "outputFormat": "formula"
    }],
    "summary": "Add variance column",
    "clarification": "Adding Variance column: Actual minus Budget.\n\n✅ FREE ✅ Instant ✅ Auto-updates"
  }'::jsonb
);

-- Example 4: Status based on performance
SELECT seed_skill_response_example(
  'formula',
  'Add a Performance column that says Good if Sales > 100000, otherwise Needs Improvement',
  '{
    "outputMode": "formula",
    "isMultiStep": false,
    "isCommand": true,
    "steps": [{
      "action": "formula",
      "description": "Performance",
      "prompt": "=IF(C{{ROW}}>100000, \"Good\", \"Needs Improvement\")",
      "outputFormat": "formula"
    }],
    "summary": "Add performance status column",
    "clarification": "Adding Performance column based on sales threshold.\n\n✅ FREE ✅ Instant ✅ Auto-updates"
  }'::jsonb
);

-- Example 5: Growth percentage calculation
SELECT seed_skill_response_example(
  'formula',
  'Calculate the growth percentage between Q1 and Q2',
  '{
    "outputMode": "formula",
    "isMultiStep": false,
    "isCommand": true,
    "steps": [{
      "action": "formula",
      "description": "Growth %",
      "prompt": "=(D{{ROW}}-C{{ROW}})/C{{ROW}}",
      "outputFormat": "formula"
    }],
    "summary": "Calculate growth percentage",
    "clarification": "Adding Growth % column: (Q2 - Q1) / Q1.\n\n✅ FREE ✅ Instant ✅ Auto-updates"
  }'::jsonb
);

-- ============================================
-- FILTER SKILL EXAMPLES
-- ============================================

SELECT seed_skill_response_example(
  'filter',
  'Show only rows where Status is Active',
  '{
    "outputMode": "sheet",
    "sheetAction": "filter",
    "sheetConfig": {
      "column": "F",
      "condition": "equals",
      "value": "Active"
    },
    "summary": "Filter by Active status",
    "clarification": "Filtering to show only rows where Status equals Active."
  }'::jsonb
);

SELECT seed_skill_response_example(
  'filter',
  'Filter to show sales greater than 150000',
  '{
    "outputMode": "sheet",
    "sheetAction": "filter",
    "sheetConfig": {
      "column": "C",
      "condition": "greaterThan",
      "value": 150000
    },
    "summary": "Filter by sales amount",
    "clarification": "Filtering to show rows where Sales is greater than 150000."
  }'::jsonb
);

-- ============================================
-- CLEANUP
-- ============================================
DROP FUNCTION IF EXISTS seed_skill_response_example;

-- ============================================
-- ADD INDEX FOR BETTER PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_skill_usage_examples_embedding 
ON skill_usage USING ivfflat (command_embedding vector_cosine_ops)
WHERE is_good_example = TRUE AND command_embedding IS NOT NULL;
