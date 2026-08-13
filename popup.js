const DEFAULTS = { sites: [], reader: false, font: '', scale: 100, stealth: true, fonts: [], theme: 'system' };
const FALLBACK_FONTS = [
  'Arial', 'Calibri', 'Cambria', 'Candara', 'Consolas', 'Constantia', 'Corbel',
  'Courier New', 'Georgia', 'Segoe UI', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana'
];

const $ = id => document.getElementById(id);
const save = patch => chrome.storage.local.set(patch);

let host = '';
let tabId = null;
let state = DEFAULTS;

const reload = () => { if (tabId != null) chrome.tabs.reload(tabId); };

// Áp dụng tức thì vào tab đang mở. Thất bại = content script cũ đã orphan (extension vừa
// reload) hoặc trang không cho inject — kệ, storage vẫn giữ giá trị cho lần load sau.
const preview = patch => {
  if (tabId != null) chrome.tabs.sendMessage(tabId, { type: 'tvt1:preview', patch }).catch(() => {});
};

// Kéo slider bắn hàng trăm event; chỉ ghi storage khi ngơi tay.
let saveTimer = null;
const saveLater = patch => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => save(patch), 150);
};

function renderSite() {
  const has = state.sites.includes(host);
  $('host').textContent = host || 'Trang này không áp dụng được';
  $('toggleSite').textContent = has ? 'Xóa khỏi danh sách' : 'Thêm vào danh sách';
  $('toggleSite').classList.toggle('danger', has);
  $('toggleSite').disabled = !host;
  $('siteCard').classList.toggle('on', has);
  $('count').textContent = `Danh sách áp dụng: ${state.sites.length} trang`;
}

function renderFonts() {
  const list = state.fonts.length ? state.fonts : FALLBACK_FONTS;
  const sel = $('font');
  sel.innerHTML = '<option value="">(Mặc định)</option>';
  for (const f of list) {
    const o = document.createElement('option');
    o.value = o.textContent = f;
    o.style.fontFamily = JSON.stringify(f);
    sel.appendChild(o);
  }
  sel.value = state.font;
  $('fontMsg').textContent = state.fonts.length
    ? `${state.fonts.length} font hệ thống`
    : 'Đang dùng danh sách font phổ biến.';
}

function render() {
  renderSite();
  $('reader').checked = state.reader;
  $('opts').hidden = !state.reader;
  $('stealth').checked = state.stealth;
  $('scale').value = state.scale;
  $('scaleVal').textContent = state.scale;
  $('theme').value = state.theme;
  renderFonts();
}

$('toggleSite').addEventListener('click', () => {
  if (!host) return;
  const sites = state.sites.includes(host)
    ? state.sites.filter(s => s !== host)
    : [...state.sites, host];
  state.sites = sites;
  save({ sites });
  renderSite();
  reload();
});

$('reader').addEventListener('change', e => {
  state.reader = e.target.checked;
  $('opts').hidden = !state.reader;
  save({ reader: state.reader });
  reload();
});

// Tắt "Xóa vết" cần reload để trang trả lại title/favicon thật.
$('stealth').addEventListener('change', e => {
  state.stealth = e.target.checked;
  save({ stealth: state.stealth });
  reload();
});

// Font + cỡ chữ áp dụng sống qua storage.onChanged trong content.js, không reload tab.
$('font').addEventListener('change', e => {
  state.font = e.target.value;
  preview({ font: state.font });
  save({ font: state.font });
});

$('scale').addEventListener('input', e => {
  const scale = Number(e.target.value);
  $('scaleVal').textContent = scale;
  state.scale = scale;
  preview({ scale });
  saveLater({ scale });
});

$('theme').addEventListener('change', e => {
  state.theme = e.target.value;
  preview({ theme: state.theme });
  save({ theme: state.theme });
});

// Local Font Access API: needs a user gesture, so it lives behind a button.
$('loadFonts').addEventListener('click', async () => {
  if (!window.queryLocalFonts) {
    $('fontMsg').textContent = 'Trình duyệt không hỗ trợ đọc font hệ thống.';
    return;
  }
  try {
    const found = await window.queryLocalFonts();
    const fonts = [...new Set(found.map(f => f.family))].sort();
    state.fonts = fonts;
    save({ fonts });
    renderFonts();
  } catch (err) {
    $('fontMsg').textContent = 'Không đọc được font: ' + err.message;
  }
});

(async () => {
  state = await chrome.storage.local.get(DEFAULTS);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  tabId = tab?.id ?? null;
  try { host = new URL(tab.url).hostname; } catch { host = ''; }
  render();
})();
