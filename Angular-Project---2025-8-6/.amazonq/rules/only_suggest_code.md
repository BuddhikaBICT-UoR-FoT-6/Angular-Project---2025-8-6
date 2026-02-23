# Code Suggestion Only Rule

## Rule: Only Suggest Code, Don't Auto-Edit

- **NEVER** automatically create, edit, or modify any files
- **ONLY** provide code suggestions and explanations
- **ALWAYS** ask for explicit permission before making any file changes
- **SHOW** the code that would be added/changed instead of implementing it
- **EXPLAIN** what the code does and where it should be placed
- **WAIT** for user confirmation before proceeding with any file operations

## Implementation Guidelines

When user requests code changes:
1. Show the suggested code in code blocks
2. Explain what the code does
3. Specify which file(s) need to be modified
4. Ask "Would you like me to implement these changes?"
5. Only proceed with file operations after explicit user approval

## Example Response Format

```
Here's the code you need to add to `filename.ts`:

```typescript
// Suggested code here
```

This code will:
- Explanation of what it does
- Where to place it
- Why it's needed

Would you like me to implement this change for you?
```