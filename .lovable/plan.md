

# Fix User Search to Find Existing Users

## Problem
When searching for users like "@dan", "@a tester", or "@scrap", they don't appear in results even though they exist in the database.

## Root Causes
1. **@ symbol in search** - When you search "@dan", the search looks for `%@dan%` which doesn't match "Dan" in the name field
2. **Handles are empty** - All users have null handles, so handle-based search fails

## Solution

### 1. Strip @ Symbol from Search Query
**File: `src/hooks/useUserSearch.ts`**

Before searching, remove any leading `@` symbol from the query so "@dan" becomes "dan":

```typescript
// Clean the search query - remove @ prefix if present
const cleanQuery = debouncedQuery.replace(/^@/, '').trim();
const searchTerm = `%${cleanQuery}%`;
```

### 2. Auto-Generate Handles for Existing Users (Optional)
If handles should be searchable, we could auto-generate them from names when null. For now, the name search will work once we strip the @ symbol.

## Changes Required

| File | Change |
|------|--------|
| `src/hooks/useUserSearch.ts` | Strip `@` prefix from search query before searching |

## Expected Result
After this fix:
- Searching "@dan" will find user "Dan"
- Searching "dan" will find user "Dan"
- Searching "a tester" or "@a tester" will find user "a tester"

