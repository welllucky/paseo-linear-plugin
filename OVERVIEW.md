Linear dashboard is a reduced, interactive Linear client inside Paseo. It opens from a sidebar item as a full screen, and as a panel in a workspace tab or in the right-side Explorer. It shows open-issue totals, counts by state, priority and assignee, team and project filters, and the 25 most recently updated issues. Selecting an issue shows its description, state, priority, assignee, team, project, dates, recent activity, comments and attachments inline, and lets you change the state, priority, assignee, title and description.

## Setup

Create a Linear personal API key under Settings, Security and access, then paste it in Settings, Plugins, Linear dashboard, Linear, and press Save. Test connection checks that Linear accepts it, and Remove deletes the saved key. If no key is saved, the daemon falls back to the `LINEAR_API_KEY` environment variable, which needs a daemon restart to change. Without either, the view shows a setup message instead of data.

Requires Paseo 0.11.0 or later and the Enable plugins switch turned on. It runs on desktop, browser and mobile clients.

## Permissions

The daemon sends GraphQL requests to `https://api.linear.app/graphql` using the key: queries for issues, teams, projects, comments and attachments, and the `issueUpdate` mutation when you change a field. The saved key is a file readable only by the daemon user, stored as plain text. The app sends it once on Save and afterwards only learns whether a key is set; it is never returned, logged or shown in errors. The plugin never creates or deletes issues and never edits comments, and it has no bulk actions. What Linear allows is decided by the key.

## Limits

- Only open issues are counted, meaning every state except completed and canceled.
- At most 500 issues are read per refresh, the most recently updated first. When more exist, the total is shown with a plus sign and a note.
- Data loads when the screen opens and when you press Refresh. There is no background sync or polling.
- Teams, projects, states and members load up to 100 entries each. Comments and attachments load up to 50 each, and the screen says when more exist.
- Assignee choices are the members of the issue's team.
- Attachments with a non-http(s) address are listed but cannot be opened.
- Activity lists up to 25 recent status, priority, assignee and title changes. Comments are read-only; there is no file upload or issue creation.
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
