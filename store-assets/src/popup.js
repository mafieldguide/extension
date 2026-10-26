/**
 * Runs the export in the open Math Academy tab (so the page's own sign-in is used and nothing needs a password),
 * keeps only the fields the graph needs (see minimise.js) and saves them as one JSON file.
 *
 * It remembers the last export in this browser, so it can say whether that file is current and, when it is not,
 * fetch only the new activity instead of the whole history again.
 */
var LEARN_URL = 'https://mathacademy.com/learn';
var STORE_KEY = 'makgExport';

var go = document.getElementById('go');
var msg = document.getElementById('msg');
var state = document.getElementById('state');
var bar = document.getElementById('bar');
var site = document.getElementById('site');
var resync = document.getElementById('resync');

function say(text, kind) {
	msg.textContent = text;
	msg.className = 'msg' + (kind ? ' ' + kind : '');
}
function setState(text, kind) {
	state.hidden = !text;
	state.textContent = text || '';
	state.className = 'state' + (kind ? ' ' + kind : '');
}
function day(iso) {
	return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
function ago(iso) {
	var mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
	if (mins < 2) return 'just now';
	if (mins < 60) return mins + ' minutes ago';
	var hrs = Math.round(mins / 60);
	if (hrs < 36) return hrs + (hrs === 1 ? ' hour ago' : ' hours ago');
	var days = Math.round(hrs / 24);
	return days + ' days ago';
}
function plural(n, word) {
	return n + ' ' + word + (n === 1 ? '' : 's');
}

var tab = null;
var last = null; // the remembered export, if any

async function readLast() {
	var got = await chrome.storage.local.get(STORE_KEY);
	last = got[STORE_KEY] || null;
}
function describeLast() {
	return plural(last.count, 'task') + ', exported ' + ago(last.at) + ', up to ' + day(last.newest);
}

/** Says whether the last export is current. Only possible with a Math Academy tab open, where one small request can look. */
try {
	document.getElementById('ver').textContent = 'v' + chrome.runtime.getManifest().version;
} catch (e) {}

async function refreshState() {
	await readLast();
	var onMA = !!(tab && tab.url && /^https:\/\/(www\.)?mathacademy\.com\//.test(tab.url));
	go.textContent = !onMA ? 'Open Math Academy' : last ? 'Update my export' : 'Export my activity';
	resync.hidden = !(onMA && last);
	if (!last) {
		setState(onMA ? '' : 'You have not exported yet.', '');
		return;
	}
	if (!onMA) {
		setState('Last export: ' + describeLast() + '. Open Math Academy to check for new activity.', 'info');
		return;
	}
	setState('Last export: ' + describeLast() + '. Checking for new activity…', 'info');
	try {
		await chrome.scripting.executeScript({
			target: { tabId: tab.id },
			files: ['minimise.js', 'api.js', 'sync.js'],
		});
		var out = await chrome.scripting.executeScript({
			target: { tabId: tab.id },
			func: function (since) {
				return globalThis.__makgSync.check(since);
			},
			args: [last.newest],
		});
		var r = out && out[0] && out[0].result;
		if (!r || !r.newest) return setState('Last export: ' + describeLast() + '.', 'info');
		try {
			chrome.runtime.sendMessage({ type: 'makg-badge', newer: r.newer, more: r.more }).catch(function () {});
		} catch (e) {}
		if (r.newer === 0) {
			setState('Up to date. Your export already has your latest activity (' + describeLast() + ').', 'ok');
			go.textContent = 'Export again anyway';
		} else {
			var n = r.more ? r.newer + '+' : String(r.newer);
			setState(
				'Out of date: ' +
					n +
					' new ' +
					(r.newer === 1 && !r.more ? 'task' : 'tasks') +
					' since your last export (' +
					describeLast() +
					'). Update takes a few seconds.',
				'stale',
			);
		}
	} catch (err) {
		setState(
			err && err.message === 'signed-out'
				? 'Math Academy says you are signed out. Sign in, then reopen this.'
				: 'Last export: ' + describeLast() + '. Could not check for new activity.',
			'info',
		);
	}
}

chrome.runtime.onMessage.addListener(function (m) {
	if (m && m.type === 'makg-progress' && m.phase === 'memory') {
		say(
			'Reading how well Math Academy says you remember each topic: course ' +
				Math.min(m.done + 1, m.total) +
				' of ' +
				m.total +
				'. Stay on this Math Academy page until the download finishes.',
		);
	} else if (m && m.type === 'makg-progress' && m.date) {
		say(
			(m.update ? 'Getting new activity: now at ' : 'Going back in time: now at ') +
				m.date +
				'. ' +
				m.count +
				(m.update ? ' new' : '') +
				' tasks so far. Stay on this Math Academy page until the download finishes.',
		);
	}
});

async function run(full) {
	go.disabled = true;
	resync.hidden = true;
	var label = go.textContent;
	go.textContent = 'Exporting…';
	bar.hidden = false;
	site.classList.remove('next');
	say(
		'Getting ready. Stay on this Math Academy page until the download finishes, or it will be interrupted.',
	);
	try {
		if (!tab || !/^https:\/\/(www\.)?mathacademy\.com\//.test(tab.url || '')) throw new Error('wrong-tab');
		await chrome.scripting.executeScript({
			target: { tabId: tab.id },
			files: ['minimise.js', 'api.js', 'sync.js'],
		});
		// The page's own student number, read from the page itself (extension scripts cannot see page variables)
		var student = null;
		try {
			var who = await chrome.scripting.executeScript({
				target: { tabId: tab.id },
				world: 'MAIN',
				func: function () {
					return typeof window.studentId === 'number' ? window.studentId : Number(window.studentId) || null;
				},
			});
			student = who && who[0] && who[0].result;
		} catch (e) {}
		var out = await chrome.scripting.executeScript({
			target: { tabId: tab.id },
			func: function (full, studentId) {
				return globalThis.__makgSync.collect(full, studentId);
			},
			args: [!!full, student || null],
		});
		var result = out && out[0] && out[0].result;
		if (!result || !result.count) {
			say('No completed tasks came back. Make sure you are signed in, then try again.', 'error');
		} else {
			say(
				(result.updated
					? result.added
						? 'Added ' + plural(result.added, 'new task') + '. '
						: 'Nothing new, so the file matches what you had. '
					: '') +
					'Saved ' +
					plural(result.count, 'task') +
					(result.topics ? ' and ' + plural(result.topics, 'topic memory level') : '') +
					' to ma-activity.json in your Downloads.' +
					(result.memory === 'skipped'
						? ' Could not read your student number from the page, so memory levels were not collected and the graph will estimate them.'
						: result.memory === 'failed'
							? ' Math Academy would not share your memory levels this time, so the graph will estimate them.'
							: result.memory === 'partial'
								? ' Some courses would not share their memory levels, so the graph will estimate those.'
								: '') +
					' Now open the graph page and drop it in.',
				'ok',
			);
			site.classList.add('next');
		}
	} catch (err) {
		var text = err && err.message;
		say(
			text === 'wrong-tab'
				? 'Open your Math Academy page (mathacademy.com/learn), signed in, then press the button again.'
				: text === 'signed-out'
					? 'Math Academy says you are signed out. Sign in, then try again.'
					: 'Something went wrong (' + text + '). Refresh the Math Academy tab and try again.',
			'error',
		);
	}
	bar.hidden = true;
	go.disabled = false;
	go.textContent = label;
	await refreshState();
}

go.addEventListener('click', function () {
	if (go.textContent === 'Open Math Academy') {
		chrome.tabs.create({ url: LEARN_URL });
		window.close();
		return;
	}
	run(false);
});
resync.addEventListener('click', function (e) {
	e.preventDefault();
	run(true);
});

(async function init() {
	var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
	tab = tabs[0] || null;
	await refreshState();
})();
