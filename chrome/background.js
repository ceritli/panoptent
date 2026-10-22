// Panoptent — arka plan (service worker)
// VS Code pencereleriyle (Panoptent köprüsü, ws://127.0.0.1:47811-47820) bağlantıyı yönetir,
// sekmelerdeki içerik betikleriyle VS Code arasında mesaj taşır.

const BASE_PORT = 47811;
const PORT_RANGE = 10;

/** port -> { ws, state: 'connecting'|'needPair'|'pairing'|'ready'|'denied', name, root } */
const vs = new Map();
/** tabId -> chrome.runtime.Port */
const tabs = new Map();
/** tabId -> seçilen VS Code portu */
const tabWs = new Map();
let scanning = false;
let wantPair = false;

const get = (k) => new Promise((r) => chrome.storage.local.get(k, (o) => r(o[k])));
const set = (o) => new Promise((r) => chrome.storage.local.set(o, r));

function readyList() {
  return [...vs.entries()]
    .filter(([, c]) => c.name && c.state !== 'probing')
    .map(([port, c]) => ({ port, name: c.name, root: c.root, state: c.state }));
}

function broadcastStatus() {
  const list = readyList();
  for (const [tabId, p] of tabs) {
    try {
      p.postMessage({ type: 'status', workspaces: list, active: pickFor(tabId) });
    } catch (e) { /* sekme kapanmış */ }
  }
  chrome.runtime.sendMessage({ type: 'status', workspaces: list }).catch(() => {});
  const ready = list.filter((w) => w.state === 'ready').length;
  chrome.action.setBadgeText({ text: ready ? '' : list.some((w) => w.state === 'needPair' || w.state === 'pairing') ? '!' : '' });
  chrome.action.setBadgeBackgroundColor({ color: '#f97316' });
}

/** Sekme için kullanılacak VS Code penceresi (port). */
function pickFor(tabId) {
  const chosen = tabWs.get(tabId);
  if (chosen && vs.get(chosen)?.state === 'ready') return chosen;
  const ready = [...vs.entries()].filter(([, c]) => c.state === 'ready');
  return ready.length ? ready[0][0] : null;
}

/**
 * Önce sessizce HTTP ile yokla: kapalı porta açılan WebSocket, Chrome'un eklenti
 * hata listesine engellenemeyen bir "ERR_CONNECTION_REFUSED" kaydı düşüyor; fetch düşürmüyor.
 */
async function probe(port) {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(700), cache: 'no-store' });
    const j = await r.json();
    return j && j.app === 'panoptent';
  } catch (e) {
    return false;
  }
}

async function connect(port) {
  if (vs.has(port)) return;
  const entry = { ws: null, state: 'probing', name: '', root: '' };
  vs.set(port, entry);
  if (!(await probe(port))) {
    vs.delete(port);
    return;
  }
  entry.state = 'connecting';
  let ws;
  try {
    ws = new WebSocket(`ws://127.0.0.1:${port}`);
  } catch (e) {
    vs.delete(port);
    return;
  }
  entry.ws = ws;
  const timer = setTimeout(() => { try { ws.close(); } catch (e) {} }, 2500);
  ws.onopen = () => clearTimeout(timer);
  ws.onmessage = async (ev) => {
    let m;
    try { m = JSON.parse(ev.data); } catch (e) { return; }
    switch (m.type) {
      case 'hi': {
        entry.name = m.workspace.name;
        entry.root = m.workspace.root;
        const token = await get('token');
        ws.send(JSON.stringify({ type: 'hello', token, pair: !token && wantPair }));
        entry.state = token ? 'connecting' : (wantPair ? 'pairing' : 'needPair');
        broadcastStatus();
        return;
      }
      case 'needPair':
        entry.state = 'needPair';
        if (wantPair) { entry.state = 'pairing'; ws.send(JSON.stringify({ type: 'hello', pair: true })); }
        broadcastStatus();
        return;
      case 'pairing':
        entry.state = 'pairing';
        broadcastStatus();
        return;
      case 'paired':
        await set({ token: m.token });
        wantPair = false;
        // diğer VS Code pencereleri de aynı anahtarla bağlansın
        for (const [p, c] of vs) if (p !== port && c.state !== 'ready') { try { c.ws.close(); } catch (e) {} }
        setTimeout(scan, 300);
        return;
      case 'denied':
        entry.state = 'denied';
        wantPair = false;
        broadcastStatus();
        return;
      case 'welcome':
        entry.state = 'ready';
        entry.settings = { sendTo: m.sendTo, openOnSelect: m.openOnSelect, claudeExt: m.claudeExt, canRollback: m.canRollback };
        broadcastStatus();
        for (const [tabId, p] of tabs) if (pickFor(tabId) === port) send(p, Object.assign({ type: 'welcome' }, entry.settings, { workspace: m.workspace }));
        return;
    }
    // VS Code'dan gelen olaylar: belirli sekmeye ya da bu pencereyi kullanan tüm sekmelere
    if (m.tab !== null && m.tab !== undefined) {
      const p = tabs.get(m.tab);
      if (p) send(p, m);
    } else {
      for (const [tabId, p] of tabs) if (pickFor(tabId) === port) send(p, m);
    }
  };
  ws.onclose = () => {
    clearTimeout(timer);
    vs.delete(port);
    broadcastStatus();
  };
  ws.onerror = () => {};
}

function send(p, m) {
  try { p.postMessage(m); } catch (e) { /* yok say */ }
}

let lastScan = 0;
async function scan() {
  if (scanning) return;
  scanning = true;
  lastScan = Date.now();
  await Promise.all(Array.from({ length: PORT_RANGE }, (_, i) => BASE_PORT + i).filter((p) => !vs.has(p)).map(connect));
  scanning = false;
  broadcastStatus();
}

// Açık sekme varken bağlantıyı canlı tut ve kopanları yeniden dene
setInterval(() => { if (tabs.size) scan(); }, 5000);

function toVS(tabId, msg) {
  const port = pickFor(tabId);
  const c = port && vs.get(port);
  if (!c || c.state !== 'ready') return false;
  c.ws.send(JSON.stringify(Object.assign({}, msg, { tab: tabId })));
  return true;
}

chrome.runtime.onConnect.addListener((p) => {
  if (p.name !== 'panoptent' || !p.sender || !p.sender.tab) return;
  const tabId = p.sender.tab.id;
  tabs.set(tabId, p);
  scan();
  setTimeout(broadcastStatus, 300);
  p.onDisconnect.addListener(() => {
    if (tabs.get(tabId) === p) tabs.delete(tabId);
  });
  p.onMessage.addListener(async (m) => {
    switch (m.type) {
      case 'injectOverlay':
        chrome.scripting.executeScript({ target: { tabId, allFrames: false }, files: ['overlay.js'], world: 'MAIN' }).catch((e) => send(p, { type: 'toast', kind: 'err', text: 'Seçim katmanı yüklenemedi: ' + e.message }));
        return;
      case 'pair':
        wantPair = true;
        for (const [, c] of vs) if (c.state === 'needPair' || c.state === 'denied') { c.state = 'pairing'; try { c.ws.send(JSON.stringify({ type: 'hello', pair: true })); } catch (e) {} }
        if (!vs.size) scan();
        broadcastStatus();
        return;
      case 'chooseWorkspace':
        tabWs.set(tabId, m.port);
        broadcastStatus();
        toVS(tabId, { type: 'getState' });
        return;
      case 'hint': {
        // seçilen öğenin kaynak dosyasına göre doğru VS Code penceresini otomatik seç
        if (!m.file || tabWs.has(tabId)) return;
        const norm = (s) => String(s).replace(/\\/g, '/').toLowerCase();
        for (const [port, c] of vs) {
          if (c.state === 'ready' && c.root && norm(m.file).startsWith(norm(c.root))) {
            tabWs.set(tabId, port);
            broadcastStatus();
            toVS(tabId, { type: 'getState' });
            break;
          }
        }
        return;
      }
      case 'getState':
        broadcastStatus();
        if (!toVS(tabId, m)) send(p, { type: 'status', workspaces: readyList(), active: pickFor(tabId) });
        return;
      default:
        if (!toVS(tabId, m)) send(p, { type: 'notConnected', for: m.type, tokens: (m.entries || []).map((e) => e.token) });
    }
  });
});

// Popup ve kısayollar
chrome.runtime.onMessage.addListener((m, sender, reply) => {
  if (m.type === 'popupState') {
    scan();
    chrome.tabs.query({ active: true, currentWindow: true }, (t) => {
      const tab = t[0];
      reply({ workspaces: readyList(), active: tab ? pickFor(tab.id) : null, hasContent: tab ? tabs.has(tab.id) : false });
    });
    return true;
  }
  if (m.type === 'popupPair') {
    wantPair = true;
    for (const [, c] of vs) if (c.state === 'needPair' || c.state === 'denied') { c.state = 'pairing'; try { c.ws.send(JSON.stringify({ type: 'hello', pair: true })); } catch (e) {} }
    scan();
    broadcastStatus();
    reply({ ok: true });
    return false;
  }
  if (m.type === 'popupChoose') {
    tabWs.set(m.tabId, m.port);
    broadcastStatus();
    toVS(m.tabId, { type: 'getState' });
    reply({ ok: true });
    return false;
  }
  if (m.type === 'popupToggle') {
    toggleTab(m.tabId).then(() => reply({ ok: true }));
    return true;
  }
  return false;
});

async function ensureContent(tabId) {
  if (tabs.has(tabId)) return true;
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    await new Promise((r) => setTimeout(r, 150));
    return true;
  } catch (e) {
    return false;
  }
}

async function toggleTab(tabId) {
  if (!(await ensureContent(tabId))) return;
  const p = tabs.get(tabId);
  if (p) send(p, { type: 'toggleEnabled' });
}

chrome.commands.onCommand.addListener(async (cmd, tab) => {
  if (!tab) return;
  if (cmd === 'toggle-panoptent') return toggleTab(tab.id);
  if (cmd === 'toggle-select') {
    if (!(await ensureContent(tab.id))) return;
    const p = tabs.get(tab.id);
    if (p) send(p, { type: 'toggleSelect' });
  }
});

scan();
