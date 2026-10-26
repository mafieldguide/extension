/**
 * Shows a badge on the toolbar icon when Math Academy has activity newer than your last export, so you know there
 * is something to sync without opening the popup. It looks once when a Math Academy page finishes loading (at most
 * every few minutes), using one small request, and clears the badge as soon as you export.
 */
var STORE_KEY = 'makgExport';
var MA = /^https:\/\/(www\.)?mathacademy\.com\//;
var MIN_GAP_MS = 3 * 60 * 1000;
var lastLooked = 0;

function setBadge(newer, more) {
	var text = newer > 0 ? (more ? newer + '+' : String(newer)) : '';
	chrome.action.setBadgeText({ text: text });
	chrome.action.setBadgeBackgroundColor({ color: '#f2690d' });
	chrome.action.setTitle({
		title:
			newer > 0
				? 'Knowledge Graph Export: ' +
					(more ? 'more than ' + newer : newer) +
					' new ' +
					(newer === 1 && !more ? 'task' : 'tasks') +
					' to sync'
				: 'Export my Math Academy activity',
	});
}

async function look(tabId, url) {
	if (!MA.test(url || '')) return;
	var now = Date.now();
	if (now - lastLooked < MIN_GAP_MS) return;
	var got = await chrome.storage.local.get(STORE_KEY);
	var last = got[STORE_KEY];
	if (!last || !last.newest) return; // nothing exported yet, so nothing can be out of date
	lastLooked = now;
	try {
		await chrome.scripting.executeScript({
			target: { tabId: tabId },
			files: ['minimise.js', 'api.js', 'sync.js'],
		});
		var out = await chrome.scripting.executeScript({
			target: { tabId: tabId },
			func: function (since) {
				return globalThis.__makgSync.check(since);
			},
			args: [last.newest],
		});
		var r = out && out[0] && out[0].result;
		if (r && r.newest) setBadge(r.newer, r.more);
	} catch (e) {
		// signed out, offline or the page changed under us: leave the badge as it is
	}
}

chrome.tabs.onUpdated.addListener(function (tabId, info, tab) {
	if (info.status === 'complete') return look(tabId, tab.url);
});

// An export (from the popup) has just saved a new copy: nothing is waiting any more
chrome.storage.onChanged.addListener(function (changes, area) {
	if (area === 'local' && changes[STORE_KEY]) setBadge(0, false);
});

// The popup found something while it was open: show the same indicator
chrome.runtime.onMessage.addListener(function (m) {
	if (m && m.type === 'makg-badge') setBadge(m.newer || 0, !!m.more);
});
