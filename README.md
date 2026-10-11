# maxmonice-portfolio

## Coding activity heatmaps

The portfolio displays the public contribution history for GitHub and the public submission calendar for LeetCode. The browser requests `/api/coding-activity`; the Vercel serverless function queries GitHub's official GraphQL API and LeetCode's unofficial GraphQL endpoint, independently, and caches the response for five minutes. Provider errors, missing configuration, and rate limits are shown in the corresponding card rather than replaced with sample activity.

### Configure locally

1. Copy `.env.example` to `.env` and add a GitHub token. Keep `.env` private; it is excluded from Git.
2. Create a GitHub personal access token from **Settings → Developer settings → Personal access tokens**. Use a fine-grained token with **Profile: Read-only** permission, or a classic token with only the `read:user` scope; repository access is not needed. The token is only read by the serverless function and is never sent to the browser.
3. Confirm `GITHUB_USERNAME` and `LEETCODE_USERNAME` match your public profile usernames.
4. Install the Vercel CLI if needed, then run `vercel dev` from the project directory. Open the local URL it prints; opening `index.html` directly will not provide the `/api` route.

For a Vercel deployment, add `GITHUB_USERNAME`, `GITHUB_TOKEN`, and `LEETCODE_USERNAME` as project environment variables for each environment, then redeploy. Never set the GitHub token as a client-side variable or commit a real `.env` file.

### Validation

This project has no package manifest or existing test runner. Check JavaScript syntax with `node --check script.js` and `node --check api/coding-activity.js`. Verify live data by running `vercel dev` with the environment variables configured and checking `/api/coding-activity`; if an upstream is unavailable or rate-limited, its heatmap reports that status.