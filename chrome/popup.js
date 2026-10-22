// Panoptent — açılır pencere
const conn = document.getElementById('conn');
const toggle = document.getElementById('toggle');
const pair = document.getElementById('pair');
let tab = null;

const STATE = { ready: 'bağlı', needPair: 'izin bekliyor', pairing: 'VS Code’da onay bekliyor', denied: 'reddedildi', connecting: 'bağlanıyor' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

async function refresh() {
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const st = await chrome.runtime.sendMessage({ type: 'popupState' });
  const list = (st && st.workspaces) || [];
  const ready = list.filter((w) => w.state === 'ready');
  if (!list.length) {
    conn.className = 'card warn';
    conn.innerHTML = '<b>VS Code bulunamadı.</b> Kontrol et:<ol style="margin:6px 0 0;padding-left:18px">' +
      '<li>VS Code’da <b>Panoptent 0.7.1+</b> kurulu ve pencere yenilenmiş (<i>Developer: Reload Window</i>)</li>' +
      '<li>VS Code’da bir <b>proje klasörü</b> açık</li>' +
      '<li>VS Code’un sağ altında <b>göz</b> simgesi görünüyor</li></ol>';
  } else {
    conn.className = 'card' + (ready.length ? ' ok' : ' warn');
    conn.innerHTML = list
      .map((w) => `<label class="ws"><input type="radio" name="ws" value="${w.port}" ${w.port === st.active ? 'checked' : ''} ${w.state !== 'ready' ? 'disabled' : ''}>
        <span class="dot ${w.state}"></span>${esc(w.name)}<small>${STATE[w.state] || w.state}</small></label>`)
      .join('');
    conn.querySelectorAll('input[name=ws]').forEach((r) =>
      r.addEventListener('change', () => chrome.runtime.sendMessage({ type: 'popupChoose', tabId: tab.id, port: Number(r.value) })),
    );
  }
  pair.hidden = !list.some((w) => w.state === 'needPair' || w.state === 'denied');
  const on = tab && tab.url ? (await chrome.storage.local.get('on:' + new URL(tab.url).origin))['on:' + new URL(tab.url).origin] : false;
  toggle.textContent = on ? 'Bu sekmede Panoptent’i kapat' : 'Bu sekmede Panoptent’i aç';
  toggle.disabled = !tab || !/^https?:/.test(tab.url || '');
}

toggle.addEventListener('click', async () => {
  if (!tab) return;
  await chrome.runtime.sendMessage({ type: 'popupToggle', tabId: tab.id });
  window.close();
});
pair.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'popupPair' });
  conn.innerHTML = 'VS Code’da çıkan pencerede <b>İzin ver</b>’e bas…';
  setTimeout(refresh, 1500);
});
chrome.runtime.onMessage.addListener((m) => { if (m.type === 'status') refresh(); });

refresh();
setTimeout(refresh, 900);
