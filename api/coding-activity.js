const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const CACHE_DURATION = 5 * 60 * 1000;
let cachedResponse;

const getDateRange = () => {
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  const start = new Date(end.getTime() - 364 * DAY_IN_MILLISECONDS);
  return { start, end };
};

const getDaysInRange = (activities, start, end) => {
  const days = [];
  for (let time = start.getTime(); time <= end.getTime(); time += DAY_IN_MILLISECONDS) {
    const date = new Date(time).toISOString().slice(0, 10);
    days.push({ date, count: activities.get(date) || 0 });
  }
  return days;
};

const getErrorMessage = (provider, error) => {
  if (error.name === 'TimeoutError' || error.name === 'AbortError') {
    return `${provider} did not respond in time. Please try again later.`;
  }
  if (error.message === 'RATE_LIMITED') {
    return `${provider} is temporarily rate-limiting requests. Please try again later.`;
  }
  if (error.message === 'AUTHENTICATION_FAILED') {
    return 'GitHub could not authenticate the server token. Check the token and its read-only profile permission.';
  }
  if (error.message === 'PROFILE_NOT_FOUND') {
    return `The public ${provider} profile could not be found.`;
  }
  if (error.message === 'CONFIGURATION_MISSING') {
    return `${provider} activity is not configured on the server.`;
  }
  return `${provider} activity is currently unavailable. Please try again later.`;
};

const requestJson = async (url, options) => {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(8000)
  });
  if (response.status === 429) throw new Error('RATE_LIMITED');
  if (response.status === 401) throw new Error('AUTHENTICATION_FAILED');
  if (response.status === 403) throw new Error('UPSTREAM_UNAVAILABLE');
  if (!response.ok) throw new Error('UPSTREAM_UNAVAILABLE');
  return response.json();
};

const getGithubActivity = async (start, end) => {
  const token = process.env.GITHUB_TOKEN;
  const username = process.env.GITHUB_USERNAME;
  if (!token || !username) throw new Error('CONFIGURATION_MISSING');

  const query = `
    query ContributionCalendar($username: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $username) {
        contributionsCollection(from: $from, to: $to) {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                date
                contributionCount
              }
            }
          }
        }
      }
    }
  `;
  const payload = await requestJson('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github+json'
    },
    body: JSON.stringify({
      query,
      variables: {
        username,
        from: start.toISOString(),
        to: new Date(end.getTime() + DAY_IN_MILLISECONDS - 1).toISOString()
      }
    })
  });

  if (payload.errors?.length) {
    if (payload.errors.some((error) => error.type === 'RATE_LIMITED')) {
      throw new Error('RATE_LIMITED');
    }
    throw new Error('UPSTREAM_UNAVAILABLE');
  }
  const weeks = payload.data?.user?.contributionsCollection?.contributionCalendar?.weeks;
  if (!Array.isArray(weeks)) {
    if (payload.data?.user === null) throw new Error('PROFILE_NOT_FOUND');
    throw new Error('UPSTREAM_UNAVAILABLE');
  }

  const activities = new Map();
  for (const week of weeks) {
    if (!Array.isArray(week.contributionDays)) throw new Error('UPSTREAM_UNAVAILABLE');
    for (const day of week.contributionDays) {
      const date = new Date(`${day.date}T00:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date)
        || Number.isNaN(date.getTime())
        || date.toISOString().slice(0, 10) !== day.date
        || !Number.isSafeInteger(day.contributionCount)
        || day.contributionCount < 0) {
        throw new Error('UPSTREAM_UNAVAILABLE');
      }
      activities.set(day.date, day.contributionCount);
    }
  }
  return {
    available: true,
    days: getDaysInRange(activities, start, end),
    totalContributions: payload.data.user.contributionsCollection.contributionCalendar.totalContributions
  };
};

const getLeetcodeYear = async (username, year) => {
  const query = `
    query UserCalendar($username: String!, $year: Int!) {
      matchedUser(username: $username) {
        userCalendar(year: $year) {
          submissionCalendar
        }
      }
    }
  `;
  const payload = await requestJson('https://leetcode.com/graphql/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Referer: `https://leetcode.com/${encodeURIComponent(username)}/`,
      Origin: 'https://leetcode.com',
      'User-Agent': 'Mozilla/5.0 (compatible; PortfolioActivity/1.0)'
    },
    body: JSON.stringify({ query, variables: { username, year } })
  });

  if (payload.errors?.length) {
    if (payload.errors.some((error) => /rate limit/i.test(error.message || ''))) {
      throw new Error('RATE_LIMITED');
    }
    throw new Error('UPSTREAM_UNAVAILABLE');
  }
  const userCalendar = payload.data?.matchedUser?.userCalendar;
  if (userCalendar === undefined || userCalendar === null) {
    if (payload.data?.matchedUser === null) throw new Error('PROFILE_NOT_FOUND');
    throw new Error('UPSTREAM_UNAVAILABLE');
  }
  const rawCalendar = userCalendar.submissionCalendar;
  const calendar = typeof rawCalendar === 'string' ? JSON.parse(rawCalendar) : rawCalendar;
  if (!calendar || typeof calendar !== 'object' || Array.isArray(calendar)) {
    throw new Error('UPSTREAM_UNAVAILABLE');
  }

  const activities = new Map();
  for (const [timestamp, rawCount] of Object.entries(calendar)) {
    const count = Number(rawCount);
    const date = new Date(Number(timestamp) * 1000);
    if (!/^\d+$/.test(timestamp)
      || !Number.isSafeInteger(count)
      || count < 0
      || Number.isNaN(date.getTime())) {
      throw new Error('UPSTREAM_UNAVAILABLE');
    }
    activities.set(date.toISOString().slice(0, 10), count);
  }
  return activities;
};

const getLeetcodeActivity = async (start, end) => {
  const username = process.env.LEETCODE_USERNAME;
  if (!username) throw new Error('CONFIGURATION_MISSING');

  const years = [...new Set([start.getUTCFullYear(), end.getUTCFullYear()])];
  const calendars = await Promise.all(years.map((year) => getLeetcodeYear(username, year)));
  const activities = new Map();
  for (const calendar of calendars) {
    for (const [date, count] of calendar) activities.set(date, count);
  }
  return { available: true, days: getDaysInRange(activities, start, end) };
};

const getProviderResult = async (provider, fetchActivity, start, end) => {
  try {
    return await fetchActivity(start, end);
  } catch (error) {
    return { available: false, error: getErrorMessage(provider, error) };
  }
};

module.exports = async (request, response) => {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed.' });
  }

  if (cachedResponse && cachedResponse.expiresAt > Date.now()) {
    response.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return response.status(200).json(cachedResponse.data);
  }

  const { start, end } = getDateRange();
  const [github, leetcode] = await Promise.all([
    getProviderResult('GitHub', getGithubActivity, start, end),
    getProviderResult('LeetCode', getLeetcodeActivity, start, end)
  ]);
  const data = { github, leetcode };
  cachedResponse = { data, expiresAt: Date.now() + CACHE_DURATION };

  response.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  return response.status(200).json(data);
};
