-- ============================================
-- ADD BETTER WRITE DATA SEED EXAMPLES
-- ============================================
-- 
-- The existing writeData seeds were too simple and didn't match
-- real user patterns like "Create a table from this data:" followed
-- by CSV content.
--
-- LEARNING: Seed examples should match ACTUAL user patterns,
-- including multi-line commands with inline data.
--
-- @version 1.0.0
-- @created 2026-02-03
-- ============================================

-- Recreate the seed function
CREATE OR REPLACE FUNCTION seed_intent_cache_placeholder(
  p_command TEXT,
  p_output_mode TEXT,
  p_skill_id TEXT,
  p_sheet_action TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO intent_cache (
    canonical_command,
    embedding,
    intent,
    is_seed,
    category
  )
  VALUES (
    p_command,
    array_fill(0::float, ARRAY[1536])::vector,
    jsonb_build_object(
      'outputMode', p_output_mode,
      'skillId', p_skill_id,
      'sheetAction', p_sheet_action,
      'confidence', 1.0
    ),
    true,
    p_category
  )
  ON CONFLICT DO NOTHING;
END;
$$;

-- ============================================
-- REALISTIC WRITE DATA EXAMPLES
-- These match actual user patterns with inline CSV data
-- ============================================

-- Pattern: "Create a table from this data:" + CSV content
SELECT seed_intent_cache_placeholder(
  'Create a table from this data:
Name,Age,City
John,30,NYC
Jane,25,LA',
  'sheet', 'writeData', 'writeData', 'writeData'
);

SELECT seed_intent_cache_placeholder(
  'Create a table from this sales data:
Region,Sales,Target
North,125000,120000
South,98000,100000',
  'sheet', 'writeData', 'writeData', 'writeData'
);

-- Pattern: "Please help create table for this data:" (user's actual pattern)
SELECT seed_intent_cache_placeholder(
  'Please help create table for this data:
Deal Name,Company,Stage,Amount
Acme Deal,Acme Corp,Negotiation,50000',
  'sheet', 'writeData', 'writeData', 'writeData'
);

-- Pattern: "Build a table with:" + data
SELECT seed_intent_cache_placeholder(
  'Build a table with:
Product,Price,Quantity
Widget A,29.99,100
Widget B,49.99,50',
  'sheet', 'writeData', 'writeData', 'writeData'
);

-- Pattern: Markdown table
SELECT seed_intent_cache_placeholder(
  'Create this table:
| Name | Department | Salary |
| John | Engineering | 80000 |
| Jane | Marketing | 75000 |',
  'sheet', 'writeData', 'writeData', 'writeData'
);

-- Pattern: Simple comma-separated in command
SELECT seed_intent_cache_placeholder(
  'Add this data: Item,Cost,Stock
Apple,1.50,100
Banana,0.75,200',
  'sheet', 'writeData', 'writeData', 'writeData'
);

-- Pattern: "Paste this data" with CSV
SELECT seed_intent_cache_placeholder(
  'Paste this data:
Employee,Role,Start Date
Alice,Manager,2023-01-15
Bob,Developer,2023-03-01',
  'sheet', 'writeData', 'writeData', 'writeData'
);

-- Pattern: "Insert this" with tab-separated style
SELECT seed_intent_cache_placeholder(
  'Insert this data into the sheet:
Month,Revenue,Expenses,Profit
Jan,45000,32000,13000
Feb,52000,35000,17000',
  'sheet', 'writeData', 'writeData', 'writeData'
);

-- Pattern: Longer data (more realistic)
SELECT seed_intent_cache_placeholder(
  'Create a table from this:
Region,Rep,Q1,Q2,Target,Status
North,Alice Chen,125000,142000,120000,Active
South,Bob Smith,98000,87000,100000,At Risk
East,Carol Davis,156000,178000,150000,Active',
  'sheet', 'writeData', 'writeData', 'writeData'
);

-- Pattern: "Help me create" (polite request)
SELECT seed_intent_cache_placeholder(
  'Help me create a table with this data:
Task,Owner,Due Date,Status
Design Review,John,2024-01-15,Pending
Code Review,Jane,2024-01-20,In Progress',
  'sheet', 'writeData', 'writeData', 'writeData'
);

-- ============================================
-- COMPOUND COMMANDS - These should still be writeData
-- (freeze/sort are secondary to the data import)
-- ============================================

SELECT seed_intent_cache_placeholder(
  'Create a table from this data and freeze the header:
Name,Email,Phone
John,john@example.com,555-1234',
  'sheet', 'writeData', 'writeData', 'writeData'
);

SELECT seed_intent_cache_placeholder(
  'Create a table from this data, freeze header, sort by Sales:
Rep,Sales,Region
Alice,125000,North
Bob,98000,South',
  'sheet', 'writeData', 'writeData', 'writeData'
);

-- ============================================
-- CONTRAST: Questions about data (NOT writeData)
-- ============================================

SELECT seed_intent_cache_placeholder(
  'What are the top 3 sales by region from this data?',
  'chat', 'chat', NULL, 'chat'
);

SELECT seed_intent_cache_placeholder(
  'Summarize the sales data and tell me the trends',
  'chat', 'chat', NULL, 'chat'
);

-- ============================================
-- COMPLEX FORMAT EXAMPLES
-- These match actual user patterns with multiple operations
-- ============================================

-- Pattern: Professional formatting with multiple operations
SELECT seed_intent_cache_placeholder(
  'Format this professionally: bold blue header with white text, currency format for sales columns, add borders',
  'sheet', 'format', 'format', 'format'
);

SELECT seed_intent_cache_placeholder(
  'Make the header bold with dark blue background and white text',
  'sheet', 'format', 'format', 'format'
);

SELECT seed_intent_cache_placeholder(
  'Format columns C and D as currency and add borders to all cells',
  'sheet', 'format', 'format', 'format'
);

SELECT seed_intent_cache_placeholder(
  'Make it look professional with formatting',
  'sheet', 'format', 'format', 'format'
);

SELECT seed_intent_cache_placeholder(
  'Add alternating row colors and borders',
  'sheet', 'format', 'format', 'format'
);

-- ============================================
-- CONDITIONAL FORMAT EXAMPLES
-- ============================================

SELECT seed_intent_cache_placeholder(
  'Highlight rows green where Q2 beat target, red where below target',
  'sheet', 'conditionalFormat', 'conditionalFormat', 'conditionalFormat'
);

SELECT seed_intent_cache_placeholder(
  'Color code cells based on value: green for high, red for low',
  'sheet', 'conditionalFormat', 'conditionalFormat', 'conditionalFormat'
);

-- ============================================
-- SHEET OPS EXAMPLES
-- ============================================

SELECT seed_intent_cache_placeholder(
  'Freeze the header row and sort by Q2_Sales descending',
  'sheet', 'sheetOps', 'sheetOps', 'sheetOps'
);

SELECT seed_intent_cache_placeholder(
  'Sort the data by Sales column descending',
  'sheet', 'sheetOps', 'sheetOps', 'sheetOps'
);

-- ============================================
-- CLEANUP
-- ============================================
DROP FUNCTION IF EXISTS seed_intent_cache_placeholder;
