class TripExpenseSync {
  constructor(onChange) {
    this.onChange = onChange;
    this.hosted = /^https?:$/.test(location.protocol);
    this.busy = false;
    if (!this.hosted) {
      document.getElementById('syncStatus').textContent = 'Offline file: expenses stay on this device. Open the shared online trip to sync.';
      return;
    }
    const validRoom = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
    const fragment = new URLSearchParams(location.hash.slice(1)).get('trip');
    const saved = S.get('gr_shared_room', null);
    this.room = validRoom(fragment) ? fragment : validRoom(saved) ? saved : crypto.randomUUID();
    S.set('gr_shared_room', this.room);
    history.replaceState(null, '', location.pathname + location.search + '#trip=' + this.room);
    this.onChange(S.get('gr_shared_ex_' + this.room, []));
    this.poll();
    this.timer = setInterval(() => { if (!document.hidden) this.poll(); }, 5000);
    window.addEventListener('online', () => this.poll());
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.poll(); });
  }

  status(message) {
    document.getElementById('syncStatus').textContent = message;
  }

  async request(method = 'GET', expense) {
    const response = await fetch('/.netlify/functions/expenses', {
      method,
      cache: 'no-store',
      headers: { 'X-Trip-Room': this.room, ...(expense ? { 'Content-Type': 'application/json' } : {}) },
      body: expense ? JSON.stringify(expense) : undefined,
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      let error;
      try { error = await response.json(); } catch {}
      throw new Error(error?.error || 'Shared storage is unavailable. Please try again.');
    }
    return response.json();
  }

  async poll() {
    if (this.busy) return;
    this.busy = true;
    try {
      const records = await this.request();
      S.set('gr_shared_ex_' + this.room, records);
      this.onChange(records);
      this.status('Shared expenses are up to date. Updates appear within 5 seconds. Click Add expense to share an amount.');
    } catch {
      this.status('Not connected to shared storage. Showing the last saved shared expenses. Check your connection and try again.');
    } finally {
      this.busy = false;
    }
  }

  async add(expense) {
    await this.request('POST', expense);
    await this.poll();
  }

  async remove(id) {
    await this.request('DELETE', { id });
    await this.poll();
  }

}

function startTripSync() {
  let pendingRender = false;
  SYNC = new TripExpenseSync(records => {
    if (!pendingRender && JSON.stringify(ex) === JSON.stringify(records)) return;
    ex = records;
    const active = document.activeElement;
    if (active?.tagName === 'TEXTAREA') { pendingRender = true; return; }
    pendingRender = false;
    const fields = ['eD', 'eC', 'eN', 'eP', 'eA', 'eF'];
    const draft = Object.fromEntries(fields.map(id => [id, document.getElementById(id)?.value]));
    const activeId = active?.id;
    const cursor = active?.selectionStart;
    const pendingId = document.getElementById('eAdd')?.dataset.pendingId;
    const pendingDraft = document.getElementById('eAdd')?.dataset.pendingDraft;
    render(1);
    for (const id of fields) {
      const field = document.getElementById(id);
      if (field && draft[id] !== undefined) field.value = draft[id];
    }
    const addButton = document.getElementById('eAdd');
    if (addButton && pendingId) {
      addButton.dataset.pendingId = pendingId;
      addButton.dataset.pendingDraft = pendingDraft;
    }
    const restored = activeId && document.getElementById(activeId);
    if (restored) {
      restored.focus({ preventScroll: true });
      if (typeof cursor === 'number' && restored.type !== 'number') restored.setSelectionRange?.(cursor, cursor);
    }
  });
}
