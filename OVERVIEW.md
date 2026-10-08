Linear dashboard is a reduced, interactive Linear client inside Paseo. A Linear item in the sidebar opens a screen with open-issue totals, counts by state, priority and assignee, team and project filters, and the 25 most recently updated issues. Selecting an issue shows its description, state, priority, assignee, team, project, dates, comments and attachments, and lets you change the state, priority, assignee, title and description.

## Setup

The plugin reads a Linear personal API key from the `LINEAR_API_KEY` environment variable of the Paseo daemon. Create the key in Linear under Settings, Security and access, start the daemon with the variable set, and restart the daemon after changing it. Reloading the plugin does not pick up a new key. Without a key the screen shows a setup message instead of data.

Requires Paseo 0.11.0 or later and the Enable plugins switch turned on. It runs on desktop, browser and mobile clients.

## Permissions

The daemon sends GraphQL requests to `https://api.linear.app/graphql` using the key: queries for issues, teams, projects, comments and attachments, and the `issueUpdate` mutation when you change a field. The key stays on the daemon; the app only receives results. The plugin never creates or deletes issues and never edits comments. What Linear allows is decided by the key.

## Limits

- Only open issues are counted, meaning every state except completed and canceled.
- At most 500 issues are read per refresh, the most recently updated first. When more exist, the total is shown with a plus sign and a note.
- Data loads when the screen opens and when you press Refresh. There is no background sync or polling.
- Teams, projects, states and members load up to 100 entries each. Comments and attachments load up to 50 each, and the screen says when more exist.
- Assignee choices are the members of the issue's team.
- Attachments with a non-http(s) address are listed but cannot be opened.
- Comments are read-only; there is no file upload or issue creation.
- Errors from Linear (rejected key, rate limit, invalid change) are shown on the screen and the issue stays unchanged.
- Tests mock `fetch`; the plugin has not been run against a live workspace.

## Development

```bash
npm install
npm run typecheck
npm test
npm run check
npm run audit:mobile
paseo plugin reload linear-dashboard
```

After the first `paseo plugin install /absolute/path/to/linear-dashboard`, check `paseo plugin ls` and `paseo plugin logs linear-dashboard`.
