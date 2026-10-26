/**
 * The export itself, run inside the Math Academy tab (so the page's own sign-in is used): a cheap freshness check,
 * and the export (everything, or only what is new since the last one). Injected as a plain script after
 * minimise.js and api.js, so it only sets a global; the tests load it the same way.
 */
(function () {
	var sync = {};

	/** Injected into the Math Academy page: has anything been completed since the last export? One small request. */
	sync.check = async function (since) {
		var api = globalThis.__makgApi;
		var batch = await api.fetchBatch(api.urlFor(new Date()));
		if (!Array.isArray(batch) || !batch.length || !Object.keys(batch[0]).length)
			return { newest: null, newer: 0, more: false };
		var times = batch
			.map(function (t) {
				return t && t.completed;
			})
			.filter(Boolean)
			.sort();
		var newer = since
			? times.filter(function (c) {
					return c > since;
				}).length
			: times.length;
		return { newest: times[times.length - 1] || null, newer: newer, more: newer === times.length };
	};

	/**
	 * Injected into the Math Academy page. Fetches completed tasks newest first (all of them, or only back to the last
	 * export), merges them into the last export, remembers the result and downloads one JSON file. With a student id it
	 * also reads each course's knowledge graph (one request per course) for Math Academy's own memory numbers.
	 */
	sync.collect = async function (full, studentId) {
		var minimise = globalThis.__makgMinimise;
		var api = globalThis.__makgApi;
		var stored = (await chrome.storage.local.get('makgExport')).makgExport;
		var prior = !full && stored && Array.isArray(stored.tasks) ? stored : null;
		var since = prior ? prior.newest : null;

		// Progress goes to the popup only; nothing is drawn on the Math Academy page
		function progress(count, date) {
			try {
				chrome.runtime
					.sendMessage({ type: 'makg-progress', count: count, date: date, update: !!since })
					.catch(function () {});
			} catch (e) {}
		}
		function dayLabel(iso) {
			return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
		}
		progress(0, '');

		var seen = new Map();
		var url = api.urlFor(new Date());
		var lastUrl = null;
		{
			while (url && url !== lastUrl) {
				lastUrl = url;
				var batch = await api.fetchBatch(url);
				if (!Array.isArray(batch) || batch.length === 0 || Object.keys(batch[0]).length === 0) break;
				batch.forEach(function (t) {
					var m = minimise(t);
					if (m && m.completed) seen.set(api.keyOf(m), m);
				});
				var oldest = batch[batch.length - 1];
				if (!oldest || !oldest.completed) break;
				progress(seen.size, dayLabel(oldest.completed));
				// An update only needs to read back to the last export; a little overlap is merged away by key
				if (since && oldest.completed <= since) break;
				url = api.urlFor(new Date(oldest.completed));
				await api.sleep(500);
			}
		}

		var before = prior ? prior.tasks.length : 0;
		var courseIds = [];
		var merged = new Map();
		if (prior)
			prior.tasks.forEach(function (t) {
				merged.set(api.keyOf(t), t);
			});
		seen.forEach(function (t, k) {
			merged.set(k, t);
		});
		var tasks = Array.from(merged.values()).sort(function (a, b) {
			return a.completed < b.completed ? 1 : -1;
		});
		if (!tasks.length) return { count: 0, added: 0 };

		// Math Academy's own half-life and practice count per topic, from one request per course. If any of it fails
		// the export still works: the graph then estimates memory from the activity alone.
		var topics = [];
		var memory = 'skipped';
		if (typeof studentId === 'number' && isFinite(studentId)) {
			tasks.forEach(function (t) {
				var id = t.test && t.test.course && t.test.course.id;
				if (typeof id === 'number' && courseIds.indexOf(id) < 0) courseIds.push(id);
			});
			var byId = new Map();
			var failed = 0;
			for (var i = 0; i < courseIds.length; i++) {
				try {
					chrome.runtime
						.sendMessage({ type: 'makg-progress', phase: 'memory', done: i, total: courseIds.length })
						.catch(function () {});
				} catch (e) {}
				try {
					var response = await api.fetchBatch(api.courseUrl(courseIds[i], studentId));
					minimise.topics(response).forEach(function (t) {
						byId.set(t.id, t);
					});
				} catch (err) {
					if (err && err.message === 'signed-out') throw err;
					failed++;
				}
				await api.sleep(500);
			}
			topics = Array.from(byId.values());
			memory = !topics.length ? 'failed' : failed ? 'partial' : 'ok';
		}

		await chrome.storage.local.set({
			makgExport: {
				at: new Date().toISOString(),
				newest: tasks[0].completed,
				count: tasks.length,
				tasks: tasks,
			},
		});
		// A bare list when there is no memory data, so the file matches what older versions made
		sync.download(topics.length ? { tasks: tasks, topics: topics } : tasks);
		return {
			count: tasks.length,
			added: prior ? tasks.length - before : tasks.length,
			updated: !!prior,
			memory: memory,
			topics: topics.length,
		};
	};

	/** Saves the export (a list of tasks, or tasks plus topics) as one JSON file. Replaceable, so the tests can run without a page. */
	sync.download = function (data) {
		var blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
		var a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = 'ma-activity.json';
		document.body.append(a);
		a.click();
		a.remove();
		setTimeout(function () {
			URL.revokeObjectURL(a.href);
		}, 10000);
	};

	globalThis.__makgSync = sync;
})();
