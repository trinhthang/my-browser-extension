const SITE_DEFAULTS = { reader: true, font: '', scale: 100, stealth: true, theme: 'system', keepColors: false };
const FALLBACK_FONTS = [
  'Arial', 'Calibri', 'Cambria', 'Candara', 'Consolas', 'Constantia', 'Corbel',
  'Courier New', 'Georgia', 'Segoe UI', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana'
];

const $ = id => document.getElementById(id);

let host = '';
let tabId = null;
let sites = {};   // hostname -> config riêng
let fonts = [];   // danh sách font hệ thống, dùng chung mọi trang
let state = { ...SITE_DEFAULTS };  // config của host đang xem

const enabled = () => !!host && host in sites;

const reload = () => { if (tabId != null) chrome.tabs.reload(tabId); };

// Áp dụng tức thì vào tab đang mở. Thất bại = content script cũ đã orphan (extension vừa
// reload) hoặc trang không cho inject — kệ, storage vẫn giữ giá trị cho lần load sau.
const preview = patch => {
  if (tabId != null) chrome.tabs.sendMessage(tabId, { type: 'tvt1:preview', patch }).catch(() => {});
};

const saveSites = () => chrome.storage.local.set({ sites });

// Kéo slider bắn hàng trăm event; chỉ ghi storage khi ngơi tay.
let saveTimer = null;
const saveLater = () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveSites, 150);
};

// state và sites[host] là cùng một object, sửa state là sửa luôn config của host.
const put = patch => Object.assign(state, patch);

function renderSite() {
  const has = enabled();
  $('host').textContent = host || 'Trang này không áp dụng được';
  $('toggleSite').textContent = has ? 'Xóa khỏi danh sách' : 'Thêm vào danh sách';
  $('toggleSite').classList.toggle('danger', has);
  $('toggleSite').disabled = !host;
  $('siteCard').classList.toggle('on', has);
  $('cfg').disabled = !has;
  $('count').textContent = has
    ? `Cấu hình riêng cho trang này · tổng ${Object.keys(sites).length} trang`
    : `Chưa áp dụng · tổng ${Object.keys(sites).length} trang`;
}

function renderFonts() {
  const list = fonts.length ? fonts : FALLBACK_FONTS;
  const sel = $('font');
  sel.innerHTML = '<option value="">(Mặc định)</option>';
  for (const f of list) {
    const o = document.createElement('option');
    o.value = o.textContent = f;
    o.style.fontFamily = JSON.stringify(f);
    sel.appendChild(o);
  }
  sel.value = state.font;
  $('fontMsg').textContent = fonts.length
    ? `${fonts.length} font hệ thống`
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
  $('keepColors').checked = state.keepColors;
  $('theme').disabled = state.keepColors;
  renderFonts();
}

$('toggleSite').addEventListener('click', () => {
  if (!host) return;
  // Xóa rồi thêm lại: config cũ mất, quay về mặc định. Đơn giản hơn là giữ mồ côi trong storage.
  if (host in sites) { delete sites[host]; state = { ...SITE_DEFAULTS }; }
  else sites[host] = state;
  saveSites();
  render();
  reload();
});

$('reader').addEventListener('change', e => {
  put({ reader: e.target.checked });
  $('opts').hidden = !state.reader;
  saveSites();
  reload();
});

// Tắt "Xóa vết" cần reload để trang trả lại title/favicon thật.
$('stealth').addEventListener('change', e => {
  put({ stealth: e.target.checked });
  saveSites();
  reload();
});

// Font + cỡ chữ áp dụng sống qua storage.onChanged trong content.js, không reload tab.
$('font').addEventListener('change', e => {
  put({ font: e.target.value });
  preview({ font: state.font });
  saveSites();
});

$('scale').addEventListener('input', e => {
  const scale = Number(e.target.value);
  $('scaleVal').textContent = scale;
  put({ scale });
  preview({ scale });
  saveLater();
});

$('theme').addEventListener('change', e => {
  put({ theme: e.target.value });
  preview({ theme: state.theme });
  saveSites();
});

$('keepColors').addEventListener('change', e => {
  put({ keepColors: e.target.checked });
  $('theme').disabled = state.keepColors;
  preview({ keepColors: state.keepColors });
  saveSites();
});

// Local Font Access API: needs a user gesture, so it lives behind a button.
$('loadFonts').addEventListener('click', async () => {
  if (!window.queryLocalFonts) {
    $('fontMsg').textContent = 'Trình duyệt không hỗ trợ đọc font hệ thống.';
    return;
  }
  try {
    const found = await window.queryLocalFonts();
    fonts = [...new Set(found.map(f => f.family))].sort();
    chrome.storage.local.set({ fonts });
    renderFonts();
  } catch (err) {
    $('fontMsg').textContent = 'Không đọc được font: ' + err.message;
  }
});

(async () => {
  const stored = await chrome.storage.local.get({ sites: {}, fonts: [] });
  fonts = stored.fonts;
  // Bản cũ lưu sites là mảng hostname + config chung. Chuyển sang config riêng từng trang.
  if (Array.isArray(stored.sites)) {
    const old = await chrome.storage.local.get(SITE_DEFAULTS);
    sites = Object.fromEntries(stored.sites.map(h => [h, { ...old }]));
    chrome.storage.local.set({ sites });
  } else {
    sites = stored.sites;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  tabId = tab?.id ?? null;
  try { host = new URL(tab.url).hostname; } catch { host = ''; }

  state = sites[host] || { ...SITE_DEFAULTS };
  render();
})();
