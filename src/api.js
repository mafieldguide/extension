/**
 * The bits that talk to Math Academy's own task-history endpoint, shared by the export and the freshness check.
 * Injected into the Math Academy tab as a plain script (so it only sets a global), after minimise.js.
 */
(function () {
	function sleep(ms) {
		return new Promise(function (r) {
			setTimeout(r, ms);
		});
	}
	// The exact date format the site's own API expects, in the visitor's own time zone
	function formatApiDate(date) {
		var day = date.toLocaleDateString('en-US', { weekday: 'short' });
		var month = date.toLocaleDateString('en-US', { month: 'short' });
		var dd = String(date.getDate()).padStart(2, '0');
		var hh = String(date.getHours()).padStart(2, '0');
		var mm = String(date.getMinutes()).padStart(2, '0');
		var off = -date.getTimezoneOffset();
		var sign = off >= 0 ? '+' : '-';
		var abs = Math.abs(off);
		var tz = '';
		try {
			var part = new Intl.DateTimeFormat('en-US', { timeZoneName: 'long' })
				.formatToParts(date)
				.find(function (p) {
					return p.type === 'timeZoneName';
				});
			if (part) tz = ' (' + part.value + ')';
		} catch (e) {}
		return (
			day +
			' ' +
			month +
			' ' +
			dd +
			' ' +
			date.getFullYear() +
			' ' +
			hh +
			':' +
			mm +
			':00 GMT' +
			sign +
			String(Math.floor(abs / 60)).padStart(2, '0') +
			String(abs % 60).padStart(2, '0') +
			tz
		);
	}
	var base = location.origin + '/api/previous-tasks/';
	function urlFor(date) {
		return base + encodeURIComponent(formatApiDate(date));
	}
	async function fetchBatch(url) {
		var last;
		for (var attempt = 0; attempt < 4; attempt++) {
			try {
				var res = await fetch(url, { credentials: 'same-origin' });
				if (res.status === 401 || res.status === 403) throw new Error('signed-out');
				if (!res.ok) throw new Error('HTTP ' + res.status);
				return await res.json();
			} catch (err) {
				last = err;
				if (err && err.message === 'signed-out') break;
				await sleep(1000 * Math.pow(2, attempt));
			}
		}
		throw last;
	}
	/** One course's knowledge graph: what Math Academy itself knows about your memory of each topic. */
	function courseUrl(courseId, studentId) {
		return (
			location.origin +
			'/api/courses/' +
			encodeURIComponent(courseId) +
			'/students/' +
			encodeURIComponent(studentId) +
			'/knowledge-graph'
		);
	}
	/** A task with no id of its own once minimised: this tells repeats apart when merging an update into an older export. */
	function keyOf(t) {
		return [t.completed, t.type, t.topic ? t.topic.id : '', t.pointsAwarded].join('|');
	}
	globalThis.__makgApi = {
		sleep: sleep,
		urlFor: urlFor,
		courseUrl: courseUrl,
		fetchBatch: fetchBatch,
		keyOf: keyOf,
	};
})();
