const DEFAULTS = { sites: [], reader: false, font: '', scale: 100, stealth: true, theme: 'system' };
const STYLE_ID = '__tvt1_style';

/* ---------- Tối ưu hóa đọc nội dung ---------- */

// Thứ bấm được: <img> bên trong không được display:none, nếu không nút/link icon-only
// co về 0px là bấm không trúng. Thay bằng ô trong suốt 1em.
const INTERACTIVE =
  'a,button,summary,label,[role="button"],[role="link"],[role="tab"],' +
  '[role="menuitem"],[role="checkbox"],[role="switch"]';
// svg nằm trong này: Facebook dựng cả logo lẫn avatar bằng inline <svg> (avatar là
// <image xlink:href> + mask), nên không thể coi svg là "icon vô hại" mà giữ lại.
const MEDIA = 'img,picture,video,audio,svg,object,embed,[role="img"]';
// iframe chức năng phải giữ hiển thị, không thì không verify captcha / không thanh toán được.
// ponytail: whitelist theo src, thêm tay khi gặp provider mới.
const IFRAME_KEEP =
  ':not([src*="captcha"]):not([src*="challenges.cloudflare.com"])' +
  ':not([src*="turnstile"]):not([src*="checkout"]):not([src*="/pay"])';
// Ô vuông bo góc, chỉ viền, xám alpha nên hiện được trên cả nền sáng lẫn tối.
// width/height 24 để element không có cỡ xác định vẫn ra cỡ icon hợp lý.
// Map thay vì nội suy thẳng s.theme vào CSS — chặn luôn khả năng chuỗi lạ trong storage
// đóng được rule. 'light dark' = element hỗ trợ cả hai, trình duyệt chọn theo OS.
const COLOR_SCHEME = { light: 'light', dark: 'dark', system: 'light dark' };
const PLACEHOLDER =
  'url("data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">' +
    '<rect x="2.5" y="2.5" width="19" height="19" rx="4" fill="none" ' +
    'stroke="rgba(128,128,128,.55)" stroke-width="1.5"/></svg>') + '")';

function setCss(text) {
  let el = document.getElementById(STYLE_ID);
  if (!text) { if (el) el.remove(); return; }
  if (!el) {
    el = document.createElement('style');
    el.id = STYLE_ID;
    (document.head || document.documentElement).appendChild(el);
  }
  el.textContent = text;
}

let readerOn = false;

function pauseAllMedia() {
  document.querySelectorAll('video,audio').forEach(m => { try { m.pause(); } catch { /* chưa sẵn sàng */ } });
}

// `play` không bubble nên phải bắt ở capture phase. Bắt luôn media thêm động, khỏi cần observer.
document.addEventListener('play', e => { if (readerOn) e.target.pause(); }, true);

function applyReader(s) {
  const rules = [
    // Media nội dung: ẩn hẳn. canvas không nằm đây vì thường là biểu đồ/bản đồ, ẩn là phá app.
    `:is(${MEDIA}):not(:is(${INTERACTIVE}) *){display:none!important}`,
    // Media trong nút/link (logo, avatar, icon): display:none ở đây sẽ làm nút icon-only
    // co về 0px và bấm không được, nên thay ruột bằng placeholder mờ, giữ nguyên cỡ gốc.
    // <img>: content:url() thay hẳn bitmap, object-fit giữ tỉ lệ placeholder trong ô cỡ gốc.
    `:is(${INTERACTIVE}) img{content:${PLACEHOLDER}!important;object-fit:contain!important}`,
    // <svg>: content:url() không đáng tin trên SVG, nên ẩn hình vẽ con rồi vẽ placeholder
    // bằng background. Specificity (0,2,0) nên thắng rule *{background-image:none}.
    `:is(${INTERACTIVE}) :is(svg,[role="img"]){background-image:${PLACEHOLDER}!important;` +
      'background-repeat:no-repeat!important;background-position:center!important;' +
      'background-size:contain!important}',
    `:is(${INTERACTIVE}) svg>*{visibility:hidden!important}`,
    // Còn lại (video/audio/object/embed trong link — rất hiếm): vô hình, giữ ô 1em để bấm.
    `:is(${INTERACTIVE}) :is(video,audio,object,embed){` +
      'width:1em!important;height:1em!important;' +
      'min-width:0!important;min-height:0!important;opacity:0!important}',
    // Ảnh nền: bỏ ảnh, giữ element. Thắng cả inline style vì author !important > inline.
    '*,*::before,*::after{background-image:none!important}',
    // Nền màu + chữ màu (xanh/đỏ/tím/vàng) về mặc định. Canvas/CanvasText là system color
    // của trình duyệt nên tự theo sáng/tối, không cần tự chọn cặp màu.
    // ponytail: link mất màu luôn — thêm `a{color:LinkText!important}` nếu cần phân biệt.
    '*,*::before,*::after{background-color:transparent!important;color:CanvasText!important}',
    'html{background-color:Canvas!important}',
    // Quyết định Canvas/CanvasText ngả sáng hay tối. Kéo theo cả form control và scrollbar,
    // không cần rule riêng. !important vì site hay khai :root{color-scheme:light}
    // (specificity cao hơn html).
    // ponytail: chỉ chạy cùng reader mode. Muốn tối khi reader tắt thì cần
    // html{filter:invert(1) hue-rotate(180deg)} + re-invert media — nhiều code hơn hẳn.
    `html{color-scheme:${COLOR_SCHEME[s.theme] || 'light dark'}!important}`,
    `iframe${IFRAME_KEEP}{display:none!important}`,
    // ponytail: zoom scales spacing along with text. Fine here because reader mode
    // leaves text only. Swap to a per-element font-size walk if spacing must stay fixed.
    `html{zoom:${Number(s.scale || 100) / 100}}`
  ];
  // ponytail: đè cả icon font (FontAwesome/Material) thành tofu. Miễn trừ [class*=icon] nếu cần.
  if (s.font) rules.push(`*{font-family:${JSON.stringify(s.font)}!important}`);
  setCss(rules.join('\n'));

  readerOn = true;
  pauseAllMedia();
}

/* ---------- Xóa vết ---------- */

let stealthOn = false;
let stealthTitle = null;
let stealthIcon = null;
let stealthObs = null;

// Góc vàng 137.508° cho hue: tab nào cũng ra màu khác hẳn tab bên cạnh, và ổn định theo N.
function iconFor(n) {
  const hue = Math.round((n * 137.508) % 360);
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">' +
    `<rect width="16" height="16" rx="3" fill="hsl(${hue},65%,50%)"/></svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

function stealthTick() {
  if (!stealthOn || stealthTitle == null) return;
  if (document.title !== stealthTitle) document.title = stealthTitle;

  const head = document.head;
  if (!head) return;
  head.querySelectorAll('link[rel~="icon"],link[rel~="apple-touch-icon"],link[rel~="mask-icon"]')
    .forEach(l => { if (l.dataset.tvt1 !== '1') l.remove(); });
  if (!head.querySelector('link[data-tvt1="1"]')) {
    const l = document.createElement('link');
    l.rel = 'icon';
    l.href = stealthIcon;
    l.dataset.tvt1 = '1';
    head.appendChild(l);
  }
}

// document_start chạy trước khi <head> tồn tại, nên chờ nó xuất hiện rồi mới bám vào.
function whenHead(fn) {
  if (document.head) { fn(); return; }
  const mo = new MutationObserver(() => {
    if (document.head) { mo.disconnect(); fn(); }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
}

async function startStealth() {
  stealthOn = true;
  if (stealthTitle == null) {
    let n;
    try { n = await chrome.runtime.sendMessage('ext:num'); } catch { /* SW chưa sẵn sàng */ }
    n = n || 1;
    stealthTitle = `my-browser-extension tab ${n}`;
    stealthIcon = iconFor(n);
  }
  stealthTick();
  if (stealthObs) return;
  whenHead(() => {
    if (!stealthOn || stealthObs) return;
    // Trang tự đổi title/favicon sau đó (SPA như Facebook đổi liên tục) thì ghi đè lại.
    stealthObs = new MutationObserver(stealthTick);
    stealthObs.observe(document.head, { childList: true, subtree: true, characterData: true });
    stealthTick();
  });
}

function stopStealth() {
  stealthOn = false;
  if (stealthObs) { stealthObs.disconnect(); stealthObs = null; }
}

/* ---------- Điều phối ---------- */

let cur = { ...DEFAULTS };

function apply(s) {
  cur = s;
  const on = !!location.hostname && s.sites.includes(location.hostname);

  if (on && s.reader) applyReader(s); else { readerOn = false; setCss(''); }

  // Title/favicon là của tab, chỉ frame trên cùng mới đụng tới.
  if (on && s.stealth && window.top === window) startStealth(); else stopStealth();
}

const refresh = () => chrome.storage.local.get(DEFAULTS, apply);

refresh();
chrome.storage.onChanged.addListener(refresh);
document.addEventListener('DOMContentLoaded', refresh);

// Popup đẩy thẳng giá trị sang đây khi đang kéo slider — không chờ storage round-trip.
chrome.runtime.onMessage.addListener(msg => {
  if (msg?.type === 'tvt1:preview') apply({ ...cur, ...msg.patch });
});
