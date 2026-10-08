Linear dashboard shows a read-only summary of your open Linear issues inside Paseo. It adds a Linear item to the sidebar that opens a screen with the total of open issues, counts by state, by priority and by assignee, and the ten most recently updated issues. Each recent issue opens in Linear.

## Setup

The plugin reads a Linear personal API key from the `LINEAR_API_KEY` environment variable of the Paseo daemon. Create the key in Linear under Settings, Security and access, start the daemon with the variable set, and restart the daemon after changing it. Reloading the plugin does not pick up a new key. Without a key the screen shows a setup message instead of data.

Requires Paseo 0.11.0 or later and the Enable plugins switch turned on. It runs on desktop, browser and mobile clients.

## What it reads and sends

The daemon sends one GraphQL query to `https://api.linear.app/graphql` per refresh, using the key. The key stays on the daemon; the app only receives the computed summary. The plugin never creates, edits or deletes anything in Linear.

## Limits

- Only open issues are counted, meaning every state except completed and canceled.
- At most 500 issues are read per refresh, the most recently updated first. When more exist, the total is shown with a plus sign and a note.
- Data loads when the screen opens and when you press Refresh. There is no background sync or polling.
- All teams visible to the key are included. There is no team filter.
- Errors from Linear (rejected key, rate limit) are shown on the screen.

## Development

```bash
npm install
npm run typecheck
npm test
paseo plugin reload linear-dashboard
```

After the first `paseo plugin install /absolute/path/to/linear-dashboard`, check `paseo plugin ls` and `paseo plugin logs linear-dashboard`.
