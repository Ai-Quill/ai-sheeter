# Database Migrations

## Active Migrations

| Date | File | Description |
|------|------|-------------|
| 2026-01-19 | `20260119_workflow_learning.sql` | Legacy template system (workflow_templates) |
| 2026-01-20 | `20260120_workflow_memory.sql` | Vector-based workflow memory with pgvector |
| 2026-01-21 | `20260121_suggestions_learning.sql` | Suggestions tracking columns |
| 2026-01-22 | `20260122_workflow_base_examples.sql` | ⭐ Template system + seed data |

## Running Migrations

```bash
# Using Supabase CLI
cd ai-sheet-backend
supabase db push

# Or run specific file
psql $DATABASE_URL -f supabase/migrations/20260122_workflow_base_examples.sql
```

## Verification

```sql
-- Check templates
SELECT template_name, template_category, success_count 
FROM workflow_memory 
WHERE is_template = TRUE;

-- Should return 6 templates
```

## Order Dependency

Migrations must run in order:
1. `20260120_workflow_memory.sql` - Creates base table
2. `20260121_suggestions_learning.sql` - Adds suggestion columns
3. `20260122_workflow_base_examples.sql` - Adds template columns + seeds data

---

See [workflow-templates.md](../../docs/architecture/workflow-templates.md) for system documentation.
