// Markup for a 3D phone holding one app page. Used by the app section; the hero's
// phone is authored in index.html so it paints before any script runs.

const STATUS_ICONS = `<svg class="sb__icons" viewBox="0 0 68 12"><g fill="currentColor"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="4.6" y="5.6" width="3" height="6.4" rx="1"/><rect x="9.2" y="3.2" width="3" height="8.8" rx="1"/><rect x="13.8" y="0.6" width="3" height="11.4" rx="1"/><path d="M30.5 2.2c2.6 0 5 1 6.8 2.7l1.3-1.3A11.4 11.4 0 0 0 30.5.3a11.4 11.4 0 0 0-8.1 3.3l1.3 1.3a9.5 9.5 0 0 1 6.8-2.7zm0 3.8c1.6 0 3 .6 4.1 1.6l1.3-1.3a7.6 7.6 0 0 0-10.8 0l1.3 1.3A5.8 5.8 0 0 1 30.5 6zm0 3.7c.6 0 1.1.2 1.5.6l-1.5 1.6-1.5-1.6c.4-.4.9-.6 1.5-.6z"/><rect x="43.5" y="0.8" width="21" height="10.4" rx="3" fill="none" stroke="currentColor" stroke-opacity=".4"/><rect x="45.3" y="2.6" width="15.4" height="6.8" rx="1.6"/><rect x="65.6" y="4" width="1.6" height="4" rx=".8" opacity=".4"/></g></svg>`;

const TABS = [['home', 'home', 'Home'], ['forecast', 'cloudsun', 'Forecast'], ['history', 'time', 'History'], ['insights', 'chart', 'Insights'], ['streaks', 'flame', 'Streaks']];

function tabbar(active) {
  const i = TABS.findIndex(([k]) => k === active);
  const tabs = TABS.map(([key, ic, label], n) => `
    <span data-tab="${key}"${n === i ? ' class="is-active"' : ''}><svg><use href="#i-${ic}"/></svg><small>${label}</small>${key === 'streaks' ? '<em>52</em>' : ''}</span>`).join('');
  return `<div class="tabbar" style="--tab:${Math.max(0, i)}"><i class="tabbar__ind"></i>${tabs}</div>`;
}

export function phone(pageHTML, { tab = null } = {}) {
  return `
  <div class="phone phone--flat">
    <div class="phone__layers"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
    <div class="phone__body">
      <div class="phone__bezel">
        <div class="screen">
          <div class="pages">${pageHTML}</div>
          <div class="sb"><span class="sb__time">9:41</span>${STATUS_ICONS}</div>
          ${tab ? tabbar(tab) : ''}
          <i class="app__home"></i>
        </div>
        <i class="phone__island"></i>
        <i class="phone__glare"></i>
      </div>
    </div>
  </div>`;
}
