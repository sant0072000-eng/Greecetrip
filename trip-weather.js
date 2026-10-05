(() => {
  const routes = [
    ['ath'],
    ['ath', 'cor', 'myc', 'epi', 'nau'],
    ['nau', 'ast', 'leo', 'kos', 'ger', 'mon'],
    ['mon', 'gyt', 'are', 'dir', 'vat', 'man'],
    ['man', 'are', 'kar', 'kal', 'kor', 'met', 'voi', 'pyl'],
    ['pyl', 'voi', 'kyp', 'bas', 'kry', 'vit'],
    ['vit', 'dim', 'ste', 'kry', 'mai'],
    ['vit', 'tri', 'nem', 'cor', 'ath'],
    ['ath', 'san'],
    ['san', 'oia', 'fir', 'pyr'],
    ['san', 'pyr', 'akr', 'ath'],
    ['ath'], ['ath'], ['ath'],
  ];
  const mainPlaces = ['ath', 'nau', 'mon', 'man', 'pyl', 'vit', 'san'];
  const cache = new Map();
  let activeRequest = null;
  let error = '';
  let getContext;
  let fetchedAt = '';

  function escape(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  }

  function greekDate(now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Athens', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
    const part = (type) => parts.find((entry) => entry.type === type).value;
    return `${part('year')}-${part('month')}-${part('day')}`;
  }

  function tomorrowIndex(now = new Date()) {
    const tomorrow = new Date(`${greekDate(now)}T12:00:00Z`);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const index = Math.round((tomorrow.getTime() - Date.UTC(2026, 9, 9, 12)) / 86400000);
    return index >= 0 && index < routes.length && ((index >= 1 && index <= 7) || index === 9 || index === 10) ? index : -1;
  }

  function dateFor(index) {
    return `2026-10-${String(9 + index).padStart(2, '0')}`;
  }

  function condition(code) {
    if (code === 0) return 'Clear sky';
    if (code === 1) return 'Mainly clear';
    if (code === 2) return 'Partly cloudy';
    if (code === 3) return 'Overcast';
    if ([45, 48].includes(code)) return 'Fog';
    if ([51, 53, 55, 56, 57].includes(code)) return 'Drizzle';
    if ([61, 63, 65, 66, 67].includes(code)) return 'Rain';
    if ([80, 81, 82].includes(code)) return 'Rain showers';
    if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Snow / snow showers';
    if ([95, 96, 99].includes(code)) return 'Thunderstorms';
    return 'Conditions unavailable';
  }

  function wet(forecast) {
    return forecast && (forecast.probability > 0 || forecast.rain > 0 || forecast.showers > 0 || [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(forecast.code));
  }

  function temperature(value) {
    return typeof value === 'number' ? `${Math.round(value)}°C` : '—';
  }

  function rainText(forecast) {
    const probability = typeof forecast.probability === 'number' ? `${Math.round(forecast.probability)}% precipitation chance` : 'Precipitation chance unavailable';
    const amount = typeof forecast.rain === 'number' && typeof forecast.showers === 'number' ? ` · ${(forecast.rain + forecast.showers).toFixed(1)} mm rain / showers` : '';
    return probability + amount;
  }

  function isFresh(id) {
    const entry = cache.get(id);
    return entry && Date.now() - entry.received < 15 * 60 * 1000;
  }

  function placeHTML(id, index) {
    const entry = cache.get(id);
    if (!entry) return '';
    const place = entry.data;
    const current = place.current;
    const forecast = place.days.find((item) => item.date === dateFor(index));
    const time = current.time ? `${current.time.slice(11, 16)} on ${current.time.slice(0, 10)} (Greece)` : 'Time unavailable';
    const stale = !isFresh(id) ? '<p class="weather-risk">Outdated weather — refresh before relying on it.</p>' : '';
    const forecastHTML = forecast
      ? `<div class="weather-forecast"><b>${dateFor(index)} forecast</b> · ${escape(condition(forecast.code))}<br>${temperature(forecast.low)}–${temperature(forecast.high)} · <span class="${wet(forecast) ? 'weather-risk' : ''}">${escape(rainText(forecast))}</span></div>`
      : `<div class="weather-meta">${dateFor(index) < greekDate() ? 'This visit date has passed; only current conditions are shown.' : 'Forecast for this visit is not available yet. Check again closer to the date.'}</div>`;
    return `<div class="weather-place"><b>${escape(place.name)}</b>${stale}<div class="weather-now"><span class="weather-temp">${temperature(current.temperature)}</span><span>${escape(condition(current.code))}</span></div><div class="weather-meta">Feels like ${temperature(current.feelsLike)} · Wind ${typeof current.wind === 'number' ? `${Math.round(current.wind)} km/h` : 'unavailable'}<br>Current model estimate: ${escape(time)}</div>${forecastHTML}</div>`;
  }

  function alertHTML() {
    const index = tomorrowIndex();
    if (index < 0) return '';
    const date = dateFor(index);
    const context = getContext();
    const items = routes[index].map((id) => {
      const entry = cache.get(id);
      return { id, entry, forecast: entry?.data.days.find((item) => item.date === date) };
    });
    const missing = items.some((item) => !item.forecast || !isFresh(item.id) || item.forecast.probability === null || item.forecast.rain === null || item.forecast.showers === null || item.forecast.code === null);
    const risks = items.filter((item) => wet(item.forecast) && isFresh(item.id));
    const title = risks.length ? 'Rain / showers possible on tomorrow’s ride' : 'Tomorrow’s ride weather check';
    let text;
    if (risks.length) {
      text = `<ul>${risks.map((item) => `<li><b>${escape(item.entry.data.name)}</b>: ${escape(rainText(item.forecast))} · ${escape(condition(item.forecast.code))}</li>`).join('')}</ul><p>Pack waterproofs and check conditions again before setting off. Allow for slippery roads and reduced visibility.</p>`;
    } else {
      text = `<p>${missing ? (activeRequest ? 'Checking tomorrow’s route…' : 'Tomorrow’s complete forecast is unavailable. Do not assume the route is dry; refresh or check another forecast before riding.') : 'No rain or showers are currently indicated at the planned stops. This is not a guarantee of dry roads.'}</p>`;
    }
    if (missing && risks.length) text += '<p>Some route forecasts are missing or outdated; this warning may not cover every stop.</p>';
    return `<section class="card weather-alert" role="status"><div class="weather-head"><h2>${title}</h2><button type="button" class="weather-refresh" data-weather-refresh ${activeRequest ? 'disabled' : ''}>${activeRequest ? 'Checking…' : 'Refresh'}</button></div><p><b>${escape(context.days[index].t)} · ${date}</b></p>${text}<p class="weather-meta">Whole-day forecasts at planned stops, including optional detours; not an exact track forecast. Warnings appear only while this handbook is open.</p></section>`;
  }

  function update() {
    if (!getContext) return;
    const context = getContext();
    const alert = document.getElementById('weatherAlert');
    if (alert) alert.innerHTML = alertHTML();
    const panel = document.getElementById('tripWeather');
    if (!panel) return;
    const ids = context.view === 'days' ? routes[context.day] : mainPlaces;
    const available = ids.filter((id) => cache.has(id));
    const status = error ? `<p class="weather-status" role="status">${escape(error)}</p>` : available.length < ids.length ? '<p class="weather-status" role="status">Loading live weather for your stops…</p>' : '';
    let body;
    if (context.view === 'days') {
      const primary = context.places[context.day];
      body = placeHTML(primary, context.day);
      const others = ids.filter((id) => id !== primary).map((id) => placeHTML(id, context.day)).join('');
      if (others) body += `<details><summary>Weather along the way (${ids.length - 1} nearby forecasts)</summary>${others}</details>`;
    } else {
      body = ids.map((id) => {
        const next = context.places.findIndex((place, index) => place === id && dateFor(index) >= greekDate());
        const first = context.places.indexOf(id);
        return placeHTML(id, next >= 0 ? next : first);
      }).join('');
    }
    const refreshed = fetchedAt ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Athens', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(fetchedAt)) : '';
    panel.innerHTML = `<div class="weather-head"><h2>Live weather</h2><button type="button" class="weather-refresh" data-weather-refresh ${activeRequest ? 'disabled' : ''}>${activeRequest ? 'Checking…' : 'Refresh'}</button></div>${status}${body || ''}<p class="weather-meta">${refreshed ? `Retrieved ${escape(refreshed)} (Greece). ` : ''}Weather data: <a class="map" href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a>. Current conditions are model estimates, not on-site observations. Forecasts may change; distant visit dates appear as they become available. Refreshes automatically every 15 minutes while open.</p>`;
  }

  async function load(force = false) {
    if (!getContext || activeRequest) return;
    const context = getContext();
    const index = tomorrowIndex();
    const visible = context.view === 'days' ? routes[context.day] : context.view === 'info' ? mainPlaces : [];
    const needed = [...new Set([...visible, ...(index >= 0 ? routes[index] : [])])].filter((id) => force || !isFresh(id));
    if (!needed.length) { update(); return; }
    if (location.protocol === 'file:') {
      error = 'Live weather needs the online handbook and an internet connection.';
      update();
      return;
    }
    const controller = new AbortController();
    activeRequest = controller;
    error = '';
    update();
    const timeout = setTimeout(() => controller.abort(), 20000);
    let succeeded = false;
    try {
      const response = await fetch(`/.netlify/functions/weather?places=${needed.join(',')}`, { signal: controller.signal });
      if (!response.ok) throw new Error('Weather unavailable');
      const result = await response.json();
      if (!result.places || !Number.isFinite(Date.parse(result.fetchedAt)) || needed.some((id) => !result.places[id]?.current || !Array.isArray(result.places[id]?.days))) throw new Error('Incomplete forecast');
      for (const id of needed) cache.set(id, { data: result.places[id], received: Math.min(Date.now(), Date.parse(result.fetchedAt)) });
      fetchedAt = result.fetchedAt;
      succeeded = true;
    } catch {
      error = 'Live weather could not be updated. Check your connection and tap Refresh. Missing forecasts do not mean no rain.';
    } finally {
      clearTimeout(timeout);
      activeRequest = null;
      update();
      if (succeeded) {
        const context = getContext();
        const index = tomorrowIndex();
        const visible = context.view === 'days' ? routes[context.day] : context.view === 'info' ? mainPlaces : [];
        if ([...visible, ...(index >= 0 ? routes[index] : [])].some((id) => !cache.has(id))) load();
      }
    }
  }

  window.TripWeather = {
    start(context) { getContext = context; load(); },
    render() { update(); load(); },
  };
  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-weather-refresh]')) load(true);
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { update(); load(); }
  });
  window.addEventListener('online', () => load());
  setInterval(() => { if (!document.hidden) { update(); load(); } }, 15 * 60 * 1000);
})();
