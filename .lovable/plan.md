

# Fix User Search to Actually Find Users

## Problem
The search functionality is not returning any results, even though users like "Dan", "a tester", and "Scrap" exist in the database. The fix to strip the "@" symbol was applied but the underlying Supabase query is failing.

## Root Cause
The Supabase JavaScript client's `.or()` filter syntax has issues with the `%` wildcard character in `ilike` patterns. When the search term `%dan%` is placed directly in the filter string, it doesn't work correctly.

**Current broken code:**
```typescript
.or(`name.ilike.${searchTerm},handle.ilike.${searchTerm}`)
// Results in: name.ilike.%dan%,handle.ilike.%dan%
```

The `%` character needs special handling in the PostgREST filter syntax.

## Solution
Use the proper Supabase filter pattern by encoding the wildcards or restructuring the query:

**Option 1: Use `textSearch` instead of `ilike`** (not ideal for partial matching)

**Option 2: Use separate filters with `or`** 
```typescript
.or(`name.ilike.*dan*,handle.ilike.*dan*`)
```
PostgREST uses `*` as the wildcard in URL query strings, which gets converted to `%` internally.

**Option 3: Execute two queries and combine** (less efficient)

## Changes Required

| File | Change |
|------|--------|
| `src/hooks/useUserSearch.ts` | Fix the `.or()` filter to use `*` wildcards instead of `%` |

## Implementation

```typescript
// In src/hooks/useUserSearch.ts, line 40-46

// Use * instead of % for the Supabase filter syntax
const searchTerm = `*${cleanQuery}*`;

const { data, error } = await supabase
  .from('profiles')
  .select('id, user_id, name, handle, avatar_url')
  .or(`name.ilike.${searchTerm},handle.ilike.${searchTerm}`)
  .neq('user_id', user?.id || '')
  .limit(20);
```

## Expected Result
After this fix:
- Searching "dan" will find user "Dan"
- Searching "a tester" will find user "a tester"  
- Searching "scrap" will find user "Scrap"
- Searching "@dan" will also work (@ is stripped first)

