
# Update Version to 1.32

## Task
Update the app version from current value to **1.32** in the database.

## Implementation
1. **Update Database**: Change the `value` field in the `app_config` table where `key = 'version'` to `'1.32'`

## Technical Details
The version is stored in the `app_config` table and fetched via the `useAppVersion` hook in `src/hooks/useAppVersion.ts`. The Settings page displays this version at the bottom.

## After Approval
Once I update the version, you can publish the app using:
- **Desktop**: Click the Publish button (web icon) in the top right
- **Mobile**: Tap '...' in the bottom-right corner → "Publish"
