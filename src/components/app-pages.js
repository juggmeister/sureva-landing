// Mock screens of the Sureva app (Home, Forecast, Streaks), built from the app's own
// components and tokens. Sized in the app's points: inside .app, 1em = 10pt.

const icon = (id) => `<svg><use href="#i-${id}"/></svg>`;

const card = (badge, title, sub, body) => `
  <div class="acard">
    <div class="acard__head">
      <span class="acard__badge">${icon(badge)}</span>
      <span class="acard__titles"><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</span>
    </div>
    ${body}
  </div>`;

export function homePage() {
  const tiles = [
    ['2h 14m', 'Protected', true],
    ['18m', 'Unprotected'],
    ['2', 'Reapplications'],
    ['1', 'Sessions Today'],
  ].map(([v, l, hero]) => `<span class="tile${hero ? ' tile--hero' : ''}" data-pop><b>${v}</b><small>${l}</small></span>`).join('');

  const kv = [
    ['Peak UV', '9.1', 'is-danger'],
    ['Alerts', '3', ''],
    ['Session UV dose', '64% of safe limit', 'is-warn'],
  ].map(([k, v, c]) => `<div class="kv" data-pop><span>${k}</span><b class="${c}">${v}</b></div>`).join('');

  return `
  <div class="app app--tab app--home" data-page="home">
    <div class="hm-top">
      <span class="hm-avatar"><b>JR</b></span>
      <span class="hm-greet"><small>Good afternoon,</small><b>Jordan</b></span>
      <span class="hm-start">${icon('flash')}<span>Start Session</span></span>
    </div>
    ${card('shield', 'Today’s Protection', '', `<div class="tiles">${tiles}</div>`)}
    ${card('time', 'Last Session', 'Beach, Saturday', `${kv}<div class="ls-score" data-pop><span><small>DURATION</small><b>3h 05m</b></span><span><small>SCORE</small><b class="is-good">86</b></span></div>`)}
  </div>`;
}

// hourly UV for a bright coastal day, 7 AM to 7 PM
const HOURLY = [0.4, 1.3, 2.8, 4.6, 6.4, 8.0, 9.1, 8.8, 7.4, 5.4, 3.3, 1.6, 0.5];

function curve(id, w = 300, h = 104) {
  const x = (i) => 6 + (i / (HOURLY.length - 1)) * (w - 12);
  const y = (v) => h - 8 - (v / 11) * (h - 22);
  let d = `M${x(0)},${y(HOURLY[0])}`;
  for (let i = 1; i < HOURLY.length; i++) {
    const cx = (x(i - 1) + x(i)) / 2;
    d += ` C${cx},${y(HOURLY[i - 1])} ${cx},${y(HOURLY[i])} ${x(i)},${y(HOURLY[i])}`;
  }
  const area = `${d} L${x(HOURLY.length - 1)},${h} L${x(0)},${h} Z`;
  const now = 4; // 11 AM
  return `
    <svg class="fc-curve" viewBox="0 0 ${w} ${h}">
      <defs>
        <linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF7A33" stop-opacity=".32"/><stop offset="1" stop-color="#FF7A33" stop-opacity="0"/></linearGradient>
      </defs>
      <rect class="fc-peak" x="${x(5)}" y="4" width="${x(7) - x(5)}" height="${h - 4}" rx="6"/>
      <path class="fc-area" d="${area}" fill="url(#${id})"/>
      <path class="fc-line" d="${d}" pathLength="1"/>
      <circle class="fc-now" cx="${x(now)}" cy="${y(HOURLY[now])}" r="5"/>
    </svg>
    <div class="fc-axis"><span>7a</span><span>10a</span><span>1p</span><span>4p</span><span>7p</span></div>`;
}

export function forecastPage(idSuffix = 'hero') {
  const week = [
    ['Thu', '24', 6.4, 'moderate', true], ['Fri', '25', 9.1, 'high'], ['Sat', '26', 8.2, 'high'],
    ['Sun', '27', 4.8, 'moderate'], ['Mon', '28', 3.1, 'low'], ['Tue', '29', 7.0, 'high'], ['Wed', '30', 5.6, 'moderate'],
  ].map(([d, n, uv, lvl, today]) => `
    <span class="wk__col wk--${lvl}${today ? ' is-today' : ''}" style="--h:${(Math.max(8, (uv / 11) * 64) / 64).toFixed(3)}">
      <b>${uv}</b><i data-grow></i><small>${d}</small><small>${n}</small>
    </span>`).join('');

  const stats = `
    <div class="fc-stats">
      <span><span class="fc-val"><b class="is-warn">6.4</b><i class="pill is-warn">High</i></span><small>UV right now</small></span>
      <i class="fc-div"></i>
      <span><span class="fc-val"><b class="is-danger">9.1</b><i class="pill is-danger">Very high</i></span><small>Peak 12–2 PM</small></span>
    </div>`;

  const callout = `
    <div class="fc-callout">
      <span class="fc-badge">${icon('warn')}Peak 12–2 PM</span>
      <span>Your SPF 50 lasts about 70 min in this window.</span>
    </div>`;

  return `
  <div class="app app--tab app--forecast" data-page="forecast">
    <p class="app__h1">Plan your sun</p>
    ${card('sun', 'Today’s UV Forecast', 'Santa Monica, updated 11:40', `${stats}<div class="fc-chart">${curve(`fc-fill-${idSuffix}`)}</div>${callout}`)}
    ${card('cal', 'This Week', 'Risk level for your skin', `<div class="wk">${week}</div>`)}
  </div>`;
}

export function insightsPage() {
  const patterns = [
    ['Most exposed', 'Saturdays, 12–2 PM'],
    ['Fastest wear-off', 'Trail runs over 28°C'],
    ['Best on-time reapply', 'Beach days, 94%'],
  ].map(([k, v]) => `<div class="kv" data-pop><span>${k}</span><b>${v}</b></div>`).join('');

  const week = [0.62, 0.8, 0.71, 0.94, 0.88, 0.97, 0.9].map((v, i) => `
    <span class="cb" style="--v:${v}"><i data-grow></i><small>${'MTWTFSS'[i]}</small></span>`).join('');

  return `
  <div class="app app--tab app--insights" data-page="insights">
    <div class="in-top"><p class="app__h1">Insights</p><span class="in-export">Export PDF</span></div>
    <div class="take" data-pop>
      <p class="take__head"><i>${icon('sun')}</i>SUREVA’S READ ON YOU</p>
      <p class="take__body">You protect well on beach days but slip on long runs. Humidity is your biggest drain: when it’s over 70%, reapply about 20 minutes sooner.</p>
    </div>
    ${card('chart', 'Reapplied on time', 'This week, 88% average', `<div class="cbars">${week}</div>`)}
    ${card('cal', 'Your Patterns', '', patterns)}
  </div>`;
}

export function passportPage() {
  const pins = [
    [22, 58, 14, true], [37, 44, 6], [55, 63, 9], [68, 36, 3], [80, 52, 5], [46, 30, 2],
  ].map(([x, y, n, best]) => `<i class="pin${best ? ' pin--best' : ''}" style="left:${x}%;top:${y}%" data-pop><b>${n}</b></i>`).join('');

  const places = [
    ['Santa Monica', '14 sessions', '7.2'],
    ['Joshua Tree', '6 sessions', '8.9'],
    ['Maui', '9 sessions', '9.6'],
  ].map(([p, s, uv]) => `
    <div class="pp-row" data-pop><span class="pp-dot"></span><span><b>${p}</b><small>${s}</small></span><em>UV ${uv}</em></div>`).join('');

  return `
  <div class="app app--tab app--passport" data-page="passport">
    <div class="tb tb--title"><span class="tb__back"><svg><use href="#i-back"/></svg></span><b>Passport</b><span></span></div>
    <div class="pp-map">
      <svg viewBox="0 0 300 180" preserveAspectRatio="none" aria-hidden="true">
        <path class="pp-land" d="M0 0h300v58c-22 6-30 26-52 30s-34-14-58-6-26 34-50 38-40-10-62-2-40 30-78 26V0z"/>
        <path class="pp-coast" d="M0 144c38 4 56-18 78-26s38 6 62 2 26-30 50-38 36 10 58 6 30-24 52-30"/>
      </svg>
      ${pins}
    </div>
    <div class="pp-stats" data-pop>
      <span><b>12</b><small>Places Protected</small></span>
      <span><b>4</b><small>Regions Covered</small></span>
      <span><b class="is-good">96</b><small>Best Score</small></span>
    </div>
    ${places}
  </div>`;
}

// the post-session report: score, Sureva's take, what drove it, how the alerts went
export function reportPage() {
  const drivers = [
    ['Water', 0.38, '#3B82C4'],
    ['UV intensity', 0.31, 'var(--orange)'],
    ['Heat & humidity', 0.19, 'var(--warning)'],
    ['Activity', 0.12, 'var(--navy)'],
  ].map(([k, v, c]) => `<p class="rp-bar" style="--c:${c};--v:${v}" data-pop><span>${k}</span><b>${Math.round(v * 100)}%</b><i></i></p>`).join('');

  const alerts = [
    ['First alert, 12:16 PM', 'Reapplied in 4 min'],
    ['Second alert, 1:41 PM', 'Reapplied in 6 min'],
    ['Time unprotected', '0 min'],
  ].map(([k, v]) => `<div class="kv" data-pop><span>${k}</span><b class="is-good">${v}</b></div>`).join('');

  return `
  <div class="app app--report" data-page="report">
    <div class="tb tb--title"><span class="tb__back"><svg><use href="#i-back"/></svg></span><b>Session</b><span></span></div>
    <div class="rp-hero" data-pop>
      <div class="rp-ring" style="--p:.92"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44"/><circle cx="50" cy="50" r="44" pathLength="1"/></svg><span><b>92</b><small>Score</small></span></div>
      <div class="rp-meta"><b>Malibu Beach</b><small>Saturday, 3 h 05</small><i class="pill is-good">Best this month</i></div>
    </div>
    <div class="take" data-pop>
      <p class="take__head"><i>${icon('sun')}</i>SUREVA’S TAKE</p>
      <p class="take__body">Both alerts answered inside six minutes. Water, not sun, wore it down most: next beach day, reapply straight after you towel off.</p>
    </div>
    ${card('chart', 'What Drove Your Depletion', 'Share of protection lost', `<div class="rp-bars">${drivers}</div>`)}
    ${card('time', 'Alert Compliance', '2 of 2 answered', alerts)}
  </div>`;
}

export function streaksPage() {
  // a month of logged days; the last 52 in a row
  const days = Array.from({ length: 35 }, (_, i) => {
    const state = i < 3 ? 'off' : i === 33 ? 'today' : i > 33 ? 'future' : 'on';
    return `<i class="cal cal--${state}" data-cal></i>`;
  }).join('');

  const badges = [
    ['Dawn Patrol', 'dawn'],
    ['High Noon', 'peak'],
    ['Surf Regular', 'water'],
  ].map(([n, k]) => `<span class="bdg bdg--${k}" data-pop><i>${icon(k === 'water' ? 'drop' : 'sun')}</i><small>${n}</small></span>`).join('');

  return `
  <div class="app app--tab app--streaks" data-page="streaks">
    <p class="app__h1">Streaks</p>
    <div class="sk-panel">
      <div class="sk-card">
        <div class="sk-head"><span class="sk-flame">${icon('flame')}</span><b data-streak>52</b><small>days protected in a row</small></div>
        <div class="sk-dow"><small>M</small><small>T</small><small>W</small><small>T</small><small>F</small><small>S</small><small>S</small></div>
        <div class="sk-cal">${days}</div>
        <i class="sk-div"></i>
        <div class="sk-stats">
          <span><small>Active Streak</small><b>52</b></span>
          <span><small>Longest Streak</small><b>61<em>Days</em></b></span>
          <span><small>No Activity</small><b>03<em>Days</em></b></span>
        </div>
      </div>
    </div>
    <p class="app__h2">Badges</p>
    <div class="sk-badges">${badges}</div>
  </div>`;
}
