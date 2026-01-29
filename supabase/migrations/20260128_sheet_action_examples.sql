-- ============================================
-- Sheet Action Base Examples
-- Version: 1.0.0
-- Date: 2026-01-28
-- 
-- Adds sheet action examples for few-shot learning:
-- - Charts, formatting, conditional formatting
-- - Data validation, filtering
-- 
-- These examples teach the AI by showing what 
-- outputMode: 'sheet' looks like, enabling semantic
-- matching via embeddings rather than keyword detection.
-- ============================================

-- Example: Chart Creation
INSERT INTO workflow_memory (
  command,
  workflow,
  domain,
  data_context,
  is_template,
  is_public,
  template_name,
  template_description,
  template_category,
  success_count
) VALUES (
  'Create a chart showing revenue trends over time',
  '{
    "outputMode": "sheet",
    "sheetAction": "chart",
    "sheetConfig": {
      "chartType": "line",
      "title": "Revenue Trends",
      "xAxisTitle": "Time Period",
      "yAxisTitle": "Revenue"
    },
    "summary": "Create line chart for time-series data",
    "clarification": "Creating a line chart to visualize how revenue changes over time.",
    "steps": []
  }'::JSONB,
  'visualization',
  '{
    "dataColumns": ["A", "B"],
    "headers": {"A": "Month", "B": "Revenue"},
    "rowCount": 12
  }'::JSONB,
  TRUE,
  TRUE,
  'Create Trend Chart',
  'Create a line chart to visualize trends over time',
  'visualization',
  10
) ON CONFLICT DO NOTHING;

-- Example: Bar Chart for Comparison
INSERT INTO workflow_memory (
  command,
  workflow,
  domain,
  data_context,
  is_template,
  is_public,
  template_name,
  template_description,
  template_category,
  success_count
) VALUES (
  'Visualize sales comparison by product category',
  '{
    "outputMode": "sheet",
    "sheetAction": "chart",
    "sheetConfig": {
      "chartType": "bar",
      "title": "Sales by Category",
      "xAxisTitle": "Category",
      "yAxisTitle": "Sales"
    },
    "summary": "Create bar chart to compare categories",
    "clarification": "Creating a bar chart to compare sales across different product categories.",
    "steps": []
  }'::JSONB,
  'visualization',
  '{
    "dataColumns": ["A", "B"],
    "headers": {"A": "Category", "B": "Sales"},
    "rowCount": 8
  }'::JSONB,
  TRUE,
  TRUE,
  'Category Comparison Chart',
  'Create a bar chart to compare values across categories',
  'visualization',
  10
) ON CONFLICT DO NOTHING;

-- Example: Currency Formatting
INSERT INTO workflow_memory (
  command,
  workflow,
  domain,
  data_context,
  is_template,
  is_public,
  template_name,
  template_description,
  template_category,
  success_count
) VALUES (
  'Format the price column as currency',
  '{
    "outputMode": "sheet",
    "sheetAction": "format",
    "sheetConfig": {
      "formatType": "currency",
      "options": {
        "decimals": 2
      }
    },
    "summary": "Apply currency formatting",
    "clarification": "Formatting the selected range as currency with dollar signs and 2 decimal places.",
    "steps": []
  }'::JSONB,
  'formatting',
  '{
    "dataColumns": ["A", "B"],
    "headers": {"A": "Product", "B": "Price"},
    "rowCount": 10
  }'::JSONB,
  TRUE,
  TRUE,
  'Currency Formatting',
  'Format numbers as currency with proper symbols and decimals',
  'formatting',
  10
) ON CONFLICT DO NOTHING;

-- Example: Percentage Formatting
INSERT INTO workflow_memory (
  command,
  workflow,
  domain,
  data_context,
  is_template,
  is_public,
  template_name,
  template_description,
  template_category,
  success_count
) VALUES (
  'Format as percentages',
  '{
    "outputMode": "sheet",
    "sheetAction": "format",
    "sheetConfig": {
      "formatType": "percent",
      "options": {
        "decimals": 1
      }
    },
    "summary": "Apply percentage formatting",
    "clarification": "Converting decimal values to percentage format (e.g., 0.15 → 15%).",
    "steps": []
  }'::JSONB,
  'formatting',
  '{
    "dataColumns": ["A", "B"],
    "headers": {"A": "Item", "B": "Rate"},
    "rowCount": 10
  }'::JSONB,
  TRUE,
  TRUE,
  'Percentage Formatting',
  'Format decimal numbers as percentages',
  'formatting',
  10
) ON CONFLICT DO NOTHING;

-- Example: Conditional Formatting - Highlight High Values
INSERT INTO workflow_memory (
  command,
  workflow,
  domain,
  data_context,
  is_template,
  is_public,
  template_name,
  template_description,
  template_category,
  success_count
) VALUES (
  'Highlight values above 100 in green',
  '{
    "outputMode": "sheet",
    "sheetAction": "conditionalFormat",
    "sheetConfig": {
      "rules": [
        {
          "condition": "greaterThan",
          "value": 100,
          "format": {
            "backgroundColor": "#90EE90"
          }
        }
      ]
    },
    "summary": "Add conditional formatting for high values",
    "clarification": "Highlighting cells with values greater than 100 with a green background.",
    "steps": []
  }'::JSONB,
  'formatting',
  '{
    "dataColumns": ["A", "B"],
    "headers": {"A": "Item", "B": "Value"},
    "rowCount": 20
  }'::JSONB,
  TRUE,
  TRUE,
  'Highlight High Values',
  'Conditionally highlight cells that exceed a threshold',
  'formatting',
  10
) ON CONFLICT DO NOTHING;

-- Example: Conditional Formatting - Flag Low Values
INSERT INTO workflow_memory (
  command,
  workflow,
  domain,
  data_context,
  is_template,
  is_public,
  template_name,
  template_description,
  template_category,
  success_count
) VALUES (
  'Flag negative numbers in red',
  '{
    "outputMode": "sheet",
    "sheetAction": "conditionalFormat",
    "sheetConfig": {
      "rules": [
        {
          "condition": "lessThan",
          "value": 0,
          "format": {
            "backgroundColor": "#FFB6C1"
          }
        }
      ]
    },
    "summary": "Add conditional formatting for negative values",
    "clarification": "Highlighting cells with negative values with a red background to flag issues.",
    "steps": []
  }'::JSONB,
  'formatting',
  '{
    "dataColumns": ["A", "B"],
    "headers": {"A": "Account", "B": "Balance"},
    "rowCount": 15
  }'::JSONB,
  TRUE,
  TRUE,
  'Flag Negative Values',
  'Highlight negative numbers in red to identify issues',
  'formatting',
  10
) ON CONFLICT DO NOTHING;

-- Example: Dropdown Data Validation
INSERT INTO workflow_memory (
  command,
  workflow,
  domain,
  data_context,
  is_template,
  is_public,
  template_name,
  template_description,
  template_category,
  success_count
) VALUES (
  'Add a dropdown with High, Medium, Low options',
  '{
    "outputMode": "sheet",
    "sheetAction": "dataValidation",
    "sheetConfig": {
      "validationType": "dropdown",
      "values": ["High", "Medium", "Low"]
    },
    "summary": "Create priority dropdown",
    "clarification": "Adding a dropdown list with High, Medium, and Low options for consistent data entry.",
    "steps": []
  }'::JSONB,
  'data_entry',
  '{
    "dataColumns": ["A", "B", "C"],
    "headers": {"A": "Task", "B": "Priority", "C": "Status"},
    "rowCount": 10
  }'::JSONB,
  TRUE,
  TRUE,
  'Priority Dropdown',
  'Add dropdown validation for priority selection',
  'data_entry',
  10
) ON CONFLICT DO NOTHING;

-- Example: Checkbox Data Validation
INSERT INTO workflow_memory (
  command,
  workflow,
  domain,
  data_context,
  is_template,
  is_public,
  template_name,
  template_description,
  template_category,
  success_count
) VALUES (
  'Add checkboxes to this column',
  '{
    "outputMode": "sheet",
    "sheetAction": "dataValidation",
    "sheetConfig": {
      "validationType": "checkbox"
    },
    "summary": "Add checkbox validation",
    "clarification": "Adding checkboxes for easy true/false selection and tracking.",
    "steps": []
  }'::JSONB,
  'data_entry',
  '{
    "dataColumns": ["A", "B", "C"],
    "headers": {"A": "Task", "B": "Complete", "C": "Notes"},
    "rowCount": 10
  }'::JSONB,
  TRUE,
  TRUE,
  'Add Checkboxes',
  'Add checkbox validation for task completion tracking',
  'data_entry',
  10
) ON CONFLICT DO NOTHING;

-- Example: Filter Data
INSERT INTO workflow_memory (
  command,
  workflow,
  domain,
  data_context,
  is_template,
  is_public,
  template_name,
  template_description,
  template_category,
  success_count
) VALUES (
  'Filter to show only active customers',
  '{
    "outputMode": "sheet",
    "sheetAction": "filter",
    "sheetConfig": {
      "criteria": [
        {
          "column": "B",
          "condition": "equals",
          "value": "Active"
        }
      ]
    },
    "summary": "Apply status filter",
    "clarification": "Filtering the data to show only rows where status equals Active.",
    "steps": []
  }'::JSONB,
  'data_analysis',
  '{
    "dataColumns": ["A", "B", "C"],
    "headers": {"A": "Customer", "B": "Status", "C": "Revenue"},
    "rowCount": 50
  }'::JSONB,
  TRUE,
  TRUE,
  'Filter by Status',
  'Filter data to show only specific status values',
  'data_analysis',
  10
) ON CONFLICT DO NOTHING;

-- Example: Numeric Filter
INSERT INTO workflow_memory (
  command,
  workflow,
  domain,
  data_context,
  is_template,
  is_public,
  template_name,
  template_description,
  template_category,
  success_count
) VALUES (
  'Show only orders above 1000 dollars',
  '{
    "outputMode": "sheet",
    "sheetAction": "filter",
    "sheetConfig": {
      "criteria": [
        {
          "column": "C",
          "condition": "greaterThan",
          "value": 1000
        }
      ]
    },
    "summary": "Filter by amount threshold",
    "clarification": "Filtering to show only rows where the amount exceeds $1000.",
    "steps": []
  }'::JSONB,
  'data_analysis',
  '{
    "dataColumns": ["A", "B", "C"],
    "headers": {"A": "Order ID", "B": "Customer", "C": "Amount"},
    "rowCount": 100
  }'::JSONB,
  TRUE,
  TRUE,
  'Filter by Amount',
  'Filter data by numeric threshold',
  'data_analysis',
  10
) ON CONFLICT DO NOTHING;

-- ============================================
-- VERIFICATION
-- ============================================

SELECT 
  template_category,
  COUNT(*) as example_count
FROM workflow_memory 
WHERE is_template = TRUE
GROUP BY template_category
ORDER BY template_category;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
SELECT 'Sheet action examples added to workflow_memory for few-shot learning' AS status;
