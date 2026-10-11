const bootScreen = document.querySelector('#boot-screen');
const bootLine = document.querySelector('#boot-line');
const roleElement = document.querySelector('#typing-role');
const asciiArt = document.querySelector('.ascii-art');
const roles = ['Java Developer', 'Backend Developer', 'Computer Science Student', 'Problem Solver'];
let roleIndex = 0;
let characterIndex = 0;
let deleting = false;

asciiArt.textContent = asciiArt.textContent.replace('▯', '⣿').replace('ⴾ', '⣴⣾');

const typeRole = () => {
  const currentRole = roles[roleIndex];
  roleElement.textContent = deleting
    ? currentRole.slice(0, characterIndex - 1)
    : currentRole.slice(0, characterIndex + 1);
  characterIndex += deleting ? -1 : 1;

  let delay = deleting ? 42 : 78;
  if (!deleting && characterIndex === currentRole.length) {
    deleting = true;
    delay = 1500;
  } else if (deleting && characterIndex === 0) {
    deleting = false;
    roleIndex = (roleIndex + 1) % roles.length;
    delay = 350;
  }
  window.setTimeout(typeRole, delay);
};

window.setTimeout(() => {
  bootLine.innerHTML = 'Loading interface <span class="cursor"></span>';
}, 650);
window.setTimeout(() => {
  bootScreen.classList.add('is-hidden');
  document.body.classList.add('ready');
  typeRole();
}, 1500);

for (const link of document.querySelectorAll('a[href^="#"]')) {
  link.addEventListener('click', (event) => {
    const target = document.querySelector(link.getAttribute('href'));
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

const formatActivityDate = (date) => new Intl.DateTimeFormat('en', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC'
}).format(new Date(`${date}T00:00:00Z`));

const activityLevel = (count, maximum) => {
  if (count === 0) return 0;
  const ratio = count / maximum;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
};

const renderHeatmap = (calendar, provider, days) => {
  const start = new Date(`${days[0].date}T00:00:00Z`);
  const end = new Date(`${days[days.length - 1].date}T00:00:00Z`);
  const gridStart = new Date(start);
  gridStart.setUTCDate(gridStart.getUTCDate() - gridStart.getUTCDay());
  const gridEnd = new Date(end);
  gridEnd.setUTCDate(gridEnd.getUTCDate() + (6 - gridEnd.getUTCDay()));

  const counts = new Map(days.map((day) => [day.date, day.count]));
  const maximum = Math.max(1, ...days.map((day) => day.count));
  const weeks = [];
  for (let weekStart = new Date(gridStart); weekStart <= gridEnd; weekStart.setUTCDate(weekStart.getUTCDate() + 7)) {
    const week = document.createElement('div');
    week.className = 'heatmap-week';
    week.setAttribute('role', 'group');
    const weekLabel = `${formatActivityDate(weekStart.toISOString().slice(0, 10))} – ${formatActivityDate(new Date(weekStart.getTime() + 6 * 86400000).toISOString().slice(0, 10))}`;
    week.setAttribute('aria-label', weekLabel);
    for (let weekday = 0; weekday < 7; weekday += 1) {
      const date = new Date(weekStart);
      date.setUTCDate(date.getUTCDate() + weekday);
      const isoDate = date.toISOString().slice(0, 10);
      const isInRange = date >= start && date <= end;
      const count = counts.get(isoDate) || 0;
      const day = document.createElement('span');
      day.className = `heatmap-day activity-level-${isInRange ? activityLevel(count, maximum) : 0}`;
      day.setAttribute('role', 'img');
      day.title = isInRange
        ? `${count} ${provider === 'github' ? 'contributions' : 'submissions'} on ${formatActivityDate(isoDate)}`
        : '';
      day.setAttribute('aria-label', day.title || 'Outside selected period');
      if (!isInRange) day.setAttribute('aria-hidden', 'true');
      week.append(day);
    }
    weeks.push({ element: week, start: new Date(weekStart) });
  }

  const calendarGrid = document.createElement('div');
  calendarGrid.className = 'heatmap-calendar';
  const weekdays = document.createElement('div');
  weekdays.className = 'heatmap-weekdays';
  weekdays.setAttribute('aria-hidden', 'true');
  for (const label of ['', 'Mon', '', 'Wed', '', 'Fri', '']) {
    const weekday = document.createElement('span');
    weekday.textContent = label;
    weekdays.append(weekday);
  }

  const weeksWrap = document.createElement('div');
  weeksWrap.className = 'heatmap-weeks-wrap';
  const months = document.createElement('div');
  months.className = 'heatmap-months';
  months.style.gridTemplateColumns = `repeat(${weeks.length}, 11px)`;
  let previousMonth = '';
  for (const [index, week] of weeks.entries()) {
    const firstVisibleDate = new Date(Math.max(week.start.getTime(), start.getTime()));
    if (firstVisibleDate > end) continue;
    let monthDate = index === 0 ? firstVisibleDate : null;
    for (let weekday = 0; weekday < 7; weekday += 1) {
      const date = new Date(week.start);
      date.setUTCDate(date.getUTCDate() + weekday);
      if (date >= start && date <= end && date.getUTCDate() === 1) {
        monthDate = date;
        break;
      }
    }
    if (!monthDate) continue;
    const monthKey = `${monthDate.getUTCFullYear()}-${monthDate.getUTCMonth()}`;
    if (monthKey === previousMonth) continue;
    previousMonth = monthKey;
    const label = document.createElement('span');
    label.textContent = new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' }).format(monthDate);
    label.style.gridColumn = String(index + 1);
    months.append(label);
  }

  const weeksElement = document.createElement('div');
  weeksElement.className = 'heatmap-weeks';
  weeks.forEach((week) => weeksElement.append(week.element));
  weeksWrap.append(months, weeksElement);
  calendarGrid.append(weekdays, weeksWrap);
  calendar.replaceChildren(calendarGrid);
};

const updateActivityCard = (provider, result) => {
  const total = document.querySelector(`#${provider}-total`);
  const status = document.querySelector(`#${provider}-status`);
  const calendar = document.querySelector(`#${provider}-calendar`);
  if (!result || !result.available || !Array.isArray(result.days)) {
    total.textContent = 'Unavailable';
    status.textContent = result?.error || 'Activity data is currently unavailable.';
    status.classList.add('heatmap-error');
    return;
  }
  const activityName = provider === 'github' ? 'contributions' : 'submissions';
  const pastYear = result.days.reduce((sum, day) => sum + day.count, 0);
  total.textContent = `${pastYear.toLocaleString()} ${activityName} · past year`;
  status.textContent = result.days.some((day) => day.count > 0)
    ? `Public ${provider === 'github' ? 'contribution' : 'submission'} activity for the past year.`
    : 'No public activity was recorded for this period.';
  renderHeatmap(calendar, provider, result.days);
};

const loadCodingActivity = async () => {
  try {
    const response = await fetch('/api/coding-activity');
    const data = await response.json();
    if (!response.ok || !data || typeof data !== 'object') {
      throw new Error('The activity service returned an invalid response.');
    }
    updateActivityCard('github', data.github);
    updateActivityCard('leetcode', data.leetcode);
  } catch (error) {
    for (const provider of ['github', 'leetcode']) {
      updateActivityCard(provider, { available: false, error: 'Unable to load activity right now. Please try again later.' });
    }
  }
};

loadCodingActivity();
