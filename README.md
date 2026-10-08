# Paseo Linear plugin

A small Linear client for [Paseo](https://paseo.sh). It adds a Linear item to the sidebar. The screen it opens lists your open issues, shows each issue's details, and lets you change a few fields without leaving Paseo.

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

## Configure LINEAR_API_KEY

1. In Linear, open Settings, Security and access, and create a personal API key.
2. Start the Paseo daemon with `LINEAR_API_KEY` set in its environment.
3. Restart the daemon after any change to the key. Reloading the plugin does not pick up a new value.

The key is read only by the daemon. It is sent to `https://api.linear.app/graphql` in the `Authorization` header and nowhere else. It is never returned to the app, written to a file or logged. Without a key the screen shows setup instructions.

## Use

Open the Linear item in the sidebar. The screen loads when it opens and again when you press Refresh. There is no polling or background sync.

- **Summary:** the number of open issues and counts by state, priority and assignee.
- **Teams and projects:** pick a team or project to narrow the summary and the issue list.
- **Issue list:** the 25 most recently updated open issues. Select one to see it next to the list, or in place of it on narrow screens.

## Interactive features

For the selected issue you can:

- read the description, state, priority, assignee, team, project, dates and the first 50 comments;
- change the state, priority or assignee with one tap;
- edit the title and description and save them together;
- see the first 50 attachments and open one in the browser;
- open the issue in Linear.

Every change is a separate request from the daemon to Linear. If Linear rejects it, the screen shows Linear's message and the issue stays as it was. Attachments whose address is not http or https are listed but cannot be opened.

## Permissions

The plugin runs with the daemon's permissions. It needs outbound HTTPS access to `api.linear.app`. It reads issues, teams, projects, members, comments and attachments, and it writes only through Linear's `issueUpdate` mutation, and only when you press a control. The API key you create decides what Linear allows.

## Limits

- Only open issues are listed, meaning every state except completed and canceled. At most 500 are read per refresh.
- Comments are read-only. The plugin does not create or edit comments, upload files, or create issues.
- Teams, projects, states and members each load up to 100 entries.
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
