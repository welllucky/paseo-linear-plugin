# Paseo Linear plugin

A small Linear client for [Paseo](https://paseo.sh). It adds a Linear item to the sidebar, a Linear panel for the workspace and the right-side Explorer, and a settings screen for the API key. The view lists your open issues, shows each issue's details, and lets you change a few fields without leaving Paseo.

The plugin id is `linear-dashboard`. The npm package is `@welllucky/paseo-linear-plugin`.

## Requirements

- Paseo 0.11.0 or later, with plugins enabled.
- A Linear personal API key.
- Node.js 22 or later, only if you develop or build the plugin yourself.

## Install

The plugin is distributed from GitHub. Clone the repository and install it by path:

```bash
git clone https://github.com/welllucky/paseo-linear-plugin.git
cd paseo-linear-plugin
npm install
paseo plugin install "$(pwd)"
paseo plugin ls
```

Releases are also published as `@welllucky/paseo-linear-plugin` on GitHub Packages. To pull one, point the `@welllucky` scope at that registry and authenticate with a token that can read packages:

```ini
# ~/.npmrc
@welllucky:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=<token with read:packages>
```

Then `npm pack @welllucky/paseo-linear-plugin`, unpack the archive and install that directory with `paseo plugin install`.

## Configure the Linear API key

1. In Linear, open Settings, Security and access, and create a personal API key.
2. In Paseo, open Settings, Plugins, Linear dashboard, Linear (or press Open settings in the plugin when it is not connected).
3. Paste the key and press Save. Use Test connection to confirm Linear accepts it, and Remove to delete the saved key.

The key can come from two places. The daemon picks the first one it finds:

1. The key saved in the plugin settings.
2. The `LINEAR_API_KEY` environment variable of the daemon process.

So `LINEAR_API_KEY` keeps working as a fallback. Removing the saved key switches back to it. Changing the environment variable needs a daemon restart. Saving or removing a key in the settings takes effect immediately.

The key stays on the daemon machine:

- It is saved in `$PASEO_HOME/plugin-data/linear-dashboard/token` (`~/.paseo/...` when `PASEO_HOME` is unset), in a directory only the daemon user can read (mode 0700, file 0600). It is stored as plain text, like other Paseo host files, not in an encrypted vault.
- The app sends it once when you press Save. No request returns it: the app only learns whether a key is set and whether it came from the settings or the environment.
- It goes to `https://api.linear.app/graphql` in the `Authorization` header and nowhere else. It is never logged, and error text is scrubbed of the key and of anything shaped like a Linear key before it reaches the app or the logs.
- It is not part of Paseo's shared plugin settings document, which every connected client can read.

Without a key the view shows setup instructions.

## Use

Open Linear from the sidebar item, or add the Linear panel as a tab in a workspace or in the Explorer on the right. The Explorer and tab panel use the stacked layout: a compact header, the workspace link, filters and an open-issue summary (a state bar plus priority and assignee lines), then a dense issue list. Selecting an issue replaces the list with the issue and a Back button. The full screen loads when it opens and again when you press Refresh. There is no polling or background sync.

- **Summary:** the number of open issues, a proportional bar by state, and counts by priority and assignee. A colored edge on a row marks Urgent and High issues.
- **Teams and projects:** pick a team or project to narrow the summary and the issue list.
- **Issue list:** the 25 most recently updated open issues. Select one to see it next to the list, or in place of it on narrow screens.

## Link a workspace to a Linear project

In the workspace or Explorer panel, the top of the view shows the local project (its name and root path) and the Linear project it is linked to.

- **Link** opens a searchable list of your Linear projects. Pick one to link the current workspace's project root to it.
- **Change** picks a different project. **Unlink** removes the link.
- While a link exists, the summary and issue list are filtered to that project automatically, and the manual project chips are hidden. The team filter still works.
- Without a link, the manual team and project filters work as before.
- If the linked project no longer exists in Linear, the bar says so, the link is not applied, and the manual filter stays in force until you change or remove it.

Links are stored as plugin settings scoped to the daemon host, keyed by the project root path, so every Paseo client connected to that daemon sees the same links. Only the Linear project id and name and the local project name are stored, never the API key. Workspaces that share a project root share a link. The full-screen Linear view is not tied to a workspace and never applies a link.

## Interactive features

For the selected issue you can:

- read the description, state, priority, assignee, team, project, dates, recent activity (status, priority, assignee and title changes) and the first 50 comments, all inline;
- change the state, priority or assignee with one tap;
- edit the title and description and save them together;
- see the first 50 attachments and open one in the browser;
- open the issue in Linear.

Nothing is bulk or destructive: you cannot delete issues, comments or attachments. Every change is a separate request from the daemon to Linear. If Linear rejects it, the screen shows Linear's message and the issue stays as it was. Attachments whose address is not http or https are listed but cannot be opened.

## Permissions

The plugin runs with the daemon's permissions. It needs outbound HTTPS access to `api.linear.app`. It reads issues, teams, projects, members, comments and attachments, and it writes only through Linear's `issueUpdate` mutation, and only when you press a control. The API key you create decides what Linear allows.

## Limits

- Only open issues are listed, meaning every state except completed and canceled. At most 500 are read per refresh.
- Activity shows up to 25 recent history entries and only the changes listed above. Comments are read-only. The plugin does not create or edit comments, upload files, or create issues.
- The catalog is read in small requests (teams, then each team's states, members and projects), so Linear's query complexity limit is never reached. Each list loads up to 500 entries, 100 per page.
- The saved key applies to the whole daemon, so every client of that host shares one Linear account.
- Assignee choices are the members of the issue's team.
- There is no sync, notification or offline mode.
- The plugin has not been verified against a live Linear workspace. Tests mock `fetch` and never call Linear.

## Development

```bash
npm install
npm run typecheck
npm test
npm run check        # Biome format, lint and import order
npm run check:fix    # apply Biome fixes
npm run audit:mobile # no DOM APIs in client/ outside client/web.ts
npm run verify       # all of the above
paseo plugin reload linear-dashboard
```

Code layout:

- `shared/` holds the Zod contracts and pure helpers.
- `server/` holds the RPC handlers and the Linear GraphQL calls.
- `client/` holds the React Native screen. Only `client/web.ts` may touch browser APIs.

`npm install` sets up [Lefthook](https://lefthook.dev). The pre-commit hook runs Biome on staged files, the type check and the mobile audit. Lefthook is a local dev dependency, so the `lefthook` binary may not be on your `PATH`. Use `npx lefthook install` to set up the hook and `npx lefthook run pre-commit --all-files` to run it by hand.

## Release

Releases are automatic. A push to `main` runs the CI workflow in `.github/workflows/ci.yml`: type check, tests, Biome and the mobile audit. If they pass, [semantic-release](https://semantic-release.gitbook.io) reads the commits since the last tag and decides the version from [Conventional Commits](https://www.conventionalcommits.org):

- `fix:` makes a patch release.
- `feat:` makes a minor release.
- `BREAKING CHANGE:` in the footer, or `!` after the type, makes a major release.
- Other types (`docs:`, `chore:`, `test:`) release nothing.

When a release is due, the workflow creates the Git tag and GitHub release with generated notes, and publishes the package to GitHub Packages. The version in `package.json` stays at `0.0.0-development` in the repository. semantic-release sets the real one during the run.

The release job uses the built-in `GITHUB_TOKEN` with `contents`, `packages`, `issues` and `pull-requests` write access, and nothing more. It runs only on pushes to `main`. Feature branches and pull requests run the checks and never publish.

To set it up in a fork, enable Actions, make sure the repository's workflow permissions allow the job to request those scopes, and change the package scope in `package.json` and the workflow to your own GitHub user or organization.
