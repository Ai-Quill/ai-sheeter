#!/bin/bash
# ============================================
# Seed Workflow Templates
# ============================================
# 
# Runs the workflow templates migration and verifies it worked
# 
# Usage:
#   ./scripts/seed-workflow-templates.sh

set -e  # Exit on error

echo "🌱 Seeding workflow templates..."
echo ""

# Check if supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Install it first:"
    echo "   brew install supabase/tap/supabase"
    exit 1
fi

# Run the migration
echo "📦 Running migration..."
supabase db push

echo ""
echo "✅ Migration complete!"
echo ""

# Verify templates were seeded
echo "🔍 Verifying templates..."
echo ""

# Query to check templates
QUERY="
SELECT 
  template_name, 
  template_category,
  jsonb_array_length(workflow->'steps') as steps,
  success_count
FROM workflow_memory 
WHERE is_template = TRUE
ORDER BY template_category, template_name;
"

# Run verification query
echo "Templates in database:"
echo "$QUERY" | supabase db execute

echo ""
echo "✅ Verification complete!"
echo ""
echo "Next steps:"
echo "  1. Deploy backend to apply changes"
echo "  2. Test template fetching: curl http://localhost:3000/api/templates"
echo "  3. Test workflow generation with multi-aspect command"
echo ""
