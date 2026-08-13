// Cấp số thứ tự cho tab: N = max N của các tab đang mở + 1.
// Lưu ở storage.session (mất khi đóng trình duyệt, không ghi ra đĩa).
let queue = Promise.resolve();

async function assign(tabId) {
  const { tabNums = {} } = await chrome.storage.session.get('tabNums');
  if (tabNums[tabId]) return tabNums[tabId];

  const live = new Set((await chrome.tabs.query({})).map(t => String(t.id)));
  const kept = {};
  for (const [id, n] of Object.entries(tabNums)) if (live.has(id)) kept[id] = n;

  const n = Math.max(0, ...Object.values(kept)) + 1;
  kept[tabId] = n;
  await chrome.storage.session.set({ tabNums: kept });
  return n;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg !== 'ext:num' || !sender.tab) return;
  // Nối đuôi để 2 tab mở cùng lúc không nhận trùng số.
  queue = queue.then(() => assign(sender.tab.id)).then(sendResponse, () => sendResponse(1));
  return true;
});
