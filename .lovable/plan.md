

# Plan: Restructure Training Programs with Detail Pages and Rich Descriptions

## Summary
Transform the training programs system to support rich markdown descriptions with individual detail pages for each training/bundle. The main `/trainings` page will show only excerpts (summaries), and users must click through to a dedicated detail page (`/trainings/:id`) to see full descriptions and access the registration form.

---

## Changes Overview

### 1. Database Changes
Add a new `excerpt` field to the `training_programs` table:

```sql
ALTER TABLE public.training_programs 
ADD COLUMN excerpt text;
```

- **excerpt**: Short summary text (plain text or simple markdown) displayed on the main listing page
- **description**: Full rich markdown content displayed on the individual training detail page

---

### 2. New Route Structure

| Route | Purpose |
|-------|---------|
| `/trainings` | Listing page showing all trainings with excerpts only (no form) |
| `/trainings/:id` | Detail page for a specific training with full description + registration form |

---

### 3. File Changes

#### A. Create New File: `src/pages/TrainingDetail.tsx`
A new dedicated page for individual training/bundle details:

- Fetches single training by ID from URL parameter
- Displays full rich markdown description using ReactMarkdown
- Contains the complete registration form
- Mobile-first responsive design
- Shows related trainings/bundles section
- Reuses existing form logic from current `TrainingPrograms.tsx`

#### B. Modify: `src/pages/TrainingPrograms.tsx` (Main Listing)
Simplify to be a catalog/listing page:

- Remove the registration form section entirely
- Replace full descriptions with excerpts
- Each training card links to `/trainings/:id`
- Change "Select Program" button to "View Details" or "Learn More"
- Keep the visual hierarchy (individual trainings, then bundles)
- Maintain step-based visual structure but without the form step

#### C. Modify: `src/App.tsx`
Add the new route:

```tsx
<Route path="/trainings/:programId" element={<TrainingDetail />} />
```

#### D. Modify: `src/pages/admin/TrainingPrograms.tsx`
Update the admin form:

- Add new "Excerpt" field (simple Textarea, ~2-3 rows)
- Replace the description Textarea with the RichMarkdownEditor component
- Update form state and mutation to handle `excerpt` field
- Add helpful labels explaining excerpt vs description purpose

---

### 4. Visual Design - Mobile First

#### Main Listing Page (`/trainings`)
```
+----------------------------------+
|           HEADER                 |
+----------------------------------+
|     Private Sound Training       |
|          Programs                |
|    [Short intro paragraph]       |
+----------------------------------+
|                                  |
|  TRAINING LEVELS                 |
|  +--------------------------+    |
|  |  Level 1 Name            |    |
|  |  [Excerpt text...]       |    |
|  |  $XXX (was $XXX)         |    |
|  |  [Learn More]            |    |
|  +--------------------------+    |
|                                  |
|  +--------------------------+    |
|  |  Level 2 Name            |    |
|  |  [Excerpt text...]       |    |
|  |  ...                     |    |
|  +--------------------------+    |
|                                  |
|  --- or save with a bundle ---   |
|                                  |
|  BUNDLES                         |
|  +--------------------------+    |
|  |  Bundle Name             |    |
|  |  [Excerpt text...]       |    |
|  |  $XXX (Save $XX)         |    |
|  |  [Learn More]            |    |
|  +--------------------------+    |
|                                  |
+----------------------------------+
|           FOOTER                 |
+----------------------------------+
```

#### Detail Page (`/trainings/:id`)
```
+----------------------------------+
|           HEADER                 |
+----------------------------------+
|     Training Name                |
|     $XXX (was $XXX)              |
|     + 3.5% processing fee        |
|     [Save $XX badge]             |
|                                  |
|  [Register Now button]           |
+----------------------------------+
|                                  |
|  FULL DESCRIPTION                |
|  (Rich markdown rendered)        |
|  - Lists                         |
|  - **Bold**, *italic*            |
|  - Links                         |
|  - Paragraphs                    |
|                                  |
+----------------------------------+
|                                  |
|  REGISTRATION FORM               |
|  [Full Name]                     |
|  [Email]                         |
|  [Phone]                         |
|  [Preferred Dates]               |
|  [x] Terms checkbox              |
|  [Proceed to Payment - $XXX]     |
|                                  |
+----------------------------------+
|                                  |
|  ALSO AVAILABLE / BUNDLES        |
|  (Related trainings section)     |
|                                  |
+----------------------------------+
|           FOOTER                 |
+----------------------------------+
```

---

### 5. Technical Details

#### Database Migration
```sql
-- Add excerpt column
ALTER TABLE public.training_programs 
ADD COLUMN excerpt text;

-- Optional: Copy first ~200 chars of description as initial excerpt
-- (Can be done manually by admin after migration)
```

#### TypeScript Interface Update
```typescript
interface TrainingProgram {
  id: string;
  name: string;
  excerpt: string | null;        // NEW: Short summary
  description: string | null;    // Existing: Now for rich markdown
  price_cents: number;
  original_price_cents: number | null;
  processing_fee_percent: number;
  is_bundle: boolean;
  display_order: number;
  availability_info: string | null;
  related_training_ids: string[] | null;
  // ... other fields
}
```

#### Rich Markdown Rendering (Detail Page)
```tsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

<ReactMarkdown 
  remarkPlugins={[remarkGfm]}
  components={{
    p: ({children}) => <p className="mb-4 leading-relaxed">{children}</p>,
    ul: ({children}) => <ul className="mb-4 list-disc pl-6 space-y-2">{children}</ul>,
    ol: ({children}) => <ol className="mb-4 list-decimal pl-6 space-y-2">{children}</ol>,
    a: ({href, children}) => <a href={href} className="text-primary hover:underline" target="_blank">{children}</a>,
    strong: ({children}) => <strong className="font-semibold">{children}</strong>,
    // ... more custom styling
  }}
>
  {description}
</ReactMarkdown>
```

#### Admin Form - Description Field
Replace simple Textarea with RichMarkdownEditor:
```tsx
import RichMarkdownEditor from '@/components/RichMarkdownEditor';

<div className="space-y-2">
  <Label>Excerpt (Short Summary)</Label>
  <Textarea 
    value={formData.excerpt}
    onChange={(e) => setFormData({...formData, excerpt: e.target.value})}
    rows={2}
    placeholder="Brief description shown on the listing page"
  />
</div>

<div className="space-y-2">
  <Label>Full Description (Markdown)</Label>
  <RichMarkdownEditor
    value={formData.description}
    onChange={(val) => setFormData({...formData, description: val})}
  />
</div>
```

---

### 6. Backward Compatibility with Direct Links

The existing direct link pattern `/trainings?program=ID` should redirect to `/trainings/:id`:

```tsx
// In TrainingPrograms.tsx
const programIdFromUrl = searchParams.get('program');
if (programIdFromUrl) {
  return <Navigate to={`/trainings/${programIdFromUrl}`} replace />;
}
```

---

### 7. Files to Create/Modify Summary

| File | Action |
|------|--------|
| `supabase/migrations/xxx.sql` | CREATE - Add `excerpt` column |
| `src/integrations/supabase/types.ts` | UPDATE - Add `excerpt` to type |
| `src/pages/TrainingDetail.tsx` | CREATE - New detail page |
| `src/pages/TrainingPrograms.tsx` | UPDATE - Simplify to listing only |
| `src/pages/admin/TrainingPrograms.tsx` | UPDATE - Add excerpt field + rich editor |
| `src/App.tsx` | UPDATE - Add new route |

---

### 8. Implementation Order

1. Create database migration to add `excerpt` column
2. Update TypeScript types
3. Create the new `TrainingDetail.tsx` page with full functionality
4. Modify `TrainingPrograms.tsx` to be listing-only with navigation
5. Update admin page with excerpt field and rich markdown editor
6. Add new route to `App.tsx`
7. Test all flows (listing, detail, admin CRUD, payment)

