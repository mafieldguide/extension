// Stand-in for the extension APIs so the real popup can be screenshotted outside a browser.
var scenario = location.hash.slice(1) || 'first';
var now = Date.now();
var lastExport = {
	at: new Date(now - 3 * 86400000).toISOString(),
	newest: new Date(now - 3 * 86400000).toISOString(),
	count: 4218,
};
window.chrome = {
	storage: {
		local: {
			get: async function () {
				return scenario === 'first' ? {} : { makgExport: lastExport };
			},
		},
	},
	tabs: {
		query: async function () {
			return [{ id: 1, url: 'https://mathacademy.com/learn' }];
		},
	},
	scripting: {
		executeScript: async function () {
			return [
				{
					result: { newest: new Date(now).toISOString(), newer: scenario === 'stale' ? 23 : 0, more: false },
				},
			];
		},
	},
	runtime: {
		getManifest: function () {
			return { version: '1.0.0' };
		},
		onMessage: { addListener: function () {} },
		sendMessage: function () {
			return Promise.resolve();
		},
	},
};
