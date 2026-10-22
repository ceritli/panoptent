// Panoptent — açılır pencere
const I18N = window.PanoptentI18n;
I18N.add({
  en: {
    'pp.tagline': 'Select & Edit · Claude Code',
    'pp.searching': 'Looking for VS Code…',
    'pp.turnOn': 'Turn on Panoptent in this tab',
    'pp.turnOff': 'Turn off Panoptent in this tab',
    'pp.pair': 'Connect to VS Code',
    'pp.hint': 'Shortcuts: <kbd>Alt+Shift+P</kbd> on/off · <kbd>Alt+Shift+E</kbd> selection mode. Your project must be open in VS Code with the Panoptent extension installed.',
    'pp.st.ready': 'connected',
    'pp.st.needPair': 'waiting for permission',
    'pp.st.pairing': 'waiting for approval in VS Code',
    'pp.st.denied': 'denied',
    'pp.st.connecting': 'connecting',
    'pp.notFound': '<b>VS Code not found.</b> Check that:<ol style="margin:6px 0 0;padding-left:18px">' +
      '<li><b>Panoptent 0.7.1+</b> is installed in VS Code and the window was reloaded (<i>Developer: Reload Window</i>)</li>' +
      '<li>a <b>project folder</b> is open in VS Code</li>' +
      '<li>the <b>eye</b> icon shows in the bottom-right of VS Code</li></ol>',
    'pp.pressAllow': 'Click <b>Allow</b> in the dialog that opened in VS Code…',
  },
  tr: {
    'pp.tagline': 'Seç & Düzenle · Claude Code',
    'pp.searching': 'VS Code aranıyor…',
    'pp.turnOn': 'Bu sekmede Panoptent’i aç',
    'pp.turnOff': 'Bu sekmede Panoptent’i kapat',
    'pp.pair': 'VS Code’a bağlan',
    'pp.hint': 'Kısayollar: <kbd>Alt+Shift+P</kbd> aç/kapat · <kbd>Alt+Shift+E</kbd> seçim modu. VS Code’da projen açık ve Panoptent eklentisi kurulu olmalı.',
    'pp.st.ready': 'bağlı',
    'pp.st.needPair': 'izin bekliyor',
    'pp.st.pairing': 'VS Code’da onay bekliyor',
    'pp.st.denied': 'reddedildi',
    'pp.st.connecting': 'bağlanıyor',
    'pp.notFound': '<b>VS Code bulunamadı.</b> Kontrol et:<ol style="margin:6px 0 0;padding-left:18px">' +
      '<li>VS Code’da <b>Panoptent 0.7.1+</b> kurulu ve pencere yenilenmiş (<i>Developer: Reload Window</i>)</li>' +
      '<li>VS Code’da bir <b>proje klasörü</b> açık</li>' +
      '<li>VS Code’un sağ altında <b>göz</b> simgesi görünüyor</li></ol>',
    'pp.pressAllow': 'VS Code’da çıkan pencerede <b>İzin ver</b>’e bas…',
  },
});
const t = I18N.t;

const conn = document.getElementById('conn');
const toggle = document.getElementById('toggle');
const pair = document.getElementById('pair');
let tab = null;

const STATES = ['ready', 'needPair', 'pairing', 'denied', 'connecting'];
const stateLabel = (s) => (STATES.indexOf(s) !== -1 ? t('pp.st.' + s) : s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// Dil: yerel seçim ('lang') > VS Code'un son gönderdiği ('vsLang') > tarayıcı dili
function applyLang(o) {
  I18N.setLang(o.lang || o.vsLang || navigator.language);
  document.documentElement.lang = I18N.lang;
  I18N.localize(document);
}
I18N.onChange(() => refresh());
chrome.storage.onChanged.addListener((ch, area) => {
  if (area === 'local' && (ch.lang || ch.vsLang)) chrome.storage.local.get(['lang', 'vsLang'], applyLang);
});

async function refresh() {
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const st = await chrome.runtime.sendMessage({ type: 'popupState' });
  const list = (st && st.workspaces) || [];
  const ready = list.filter((w) => w.state === 'ready');
  if (!list.length) {
    conn.className = 'card warn';
    conn.innerHTML = t('pp.notFound');
  } else {
    conn.className = 'card' + (ready.length ? ' ok' : ' warn');
    conn.innerHTML = list
      .map((w) => `<label class="ws"><input type="radio" name="ws" value="${w.port}" ${w.port === st.active ? 'checked' : ''} ${w.state !== 'ready' ? 'disabled' : ''}>
        <span class="dot ${w.state}"></span>${esc(w.name)}<small>${esc(stateLabel(w.state))}</small></label>`)
      .join('');
    conn.querySelectorAll('input[name=ws]').forEach((r) =>
      r.addEventListener('change', () => chrome.runtime.sendMessage({ type: 'popupChoose', tabId: tab.id, port: Number(r.value) })),
    );
  }
  pair.hidden = !list.some((w) => w.state === 'needPair' || w.state === 'denied');
  const on = tab && tab.url ? (await chrome.storage.local.get('on:' + new URL(tab.url).origin))['on:' + new URL(tab.url).origin] : false;
  toggle.textContent = on ? t('pp.turnOff') : t('pp.turnOn');
  toggle.disabled = !tab || !/^https?:/.test(tab.url || '');
}

toggle.addEventListener('click', async () => {
  if (!tab) return;
  await chrome.runtime.sendMessage({ type: 'popupToggle', tabId: tab.id });
  window.close();
});
pair.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'popupPair' });
  conn.innerHTML = t('pp.pressAllow');
  setTimeout(refresh, 1500);
});
chrome.runtime.onMessage.addListener((m) => { if (m.type === 'status') refresh(); });

chrome.storage.local.get(['lang', 'vsLang'], (o) => {
  applyLang(o);
  refresh();
  setTimeout(refresh, 900);
});
