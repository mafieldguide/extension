import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

/*
 * The exporter's sync, end to end against a pretend Math Academy: an old export that missed the newest activity is
 * noticed as out of date after a "reload", then updated by fetching only what is new.
 */

type Task = {
	id: number;
	type: string;
	completed: string;
	points: number;
	pointsAwarded: number;
	topic: { id: number; name: string; prerequisites: [] };
	test: { course: { id: number; name: string } };
};

// Twenty tasks, one a day, newest first, the way Math Academy returns them
const ALL: Task[] = Array.from({ length: 20 }, (_, i) => {
	const day = 20 - i;
	return {
		id: 1000 + day,
		type: 'Lesson',
		completed: `2026-03-${String(day).padStart(2, '0')}T10:00:00.000Z`,
		points: 10,
		pointsAwarded: 10,
		topic: { id: day, name: `Topic ${day}`, prerequisites: [] },
		test: { course: { id: day % 2 ? 7 : 8, name: `Course ${day % 2 ? 7 : 8}` } },
	};
});
const PAGE = 4;

let hidden = 0; // how many of the newest tasks Math Academy has not "produced" yet
let requests = 0;
let store: Record<string, unknown> = {};
let downloads: { completed: string }[][] = [];

const g = globalThis as Record<string, any>;
g.location = { origin: 'https://mathacademy.com' };
g.chrome = {
	runtime: { sendMessage: () => Promise.resolve() },
	storage: {
		local: {
			get: async (k: string) => ({ [k]: store[k] }),
			set: async (o: Record<string, unknown>) => void Object.assign(store, o),
		},
	},
};
// Like the real endpoint: tasks completed up to the date in the address, newest first, a page at a time
const asked: string[] = [];
g.fetch = async (url: string) => {
	if (url.includes('/knowledge-graph')) {
		asked.push(url);
		const unseen = { id: 99, name: 'Never practised', repetition: 0, halfLife: 0 };
		const topics = Object.fromEntries(
			[
				{ id: 1, name: 'Secret name', repetition: 3, halfLife: 1234.567, frontier: 1, prerequisites: [5] },
				{ id: 2, name: 'Forever', repetition: 30, halfLife: 999999999.0000005 },
				unseen,
			].map((t) => [t.id, t]),
		);
		return { ok: true, status: 200, json: async () => ({ result: true, topics }) };
	}
	requests++;
	const when = Date.parse(decodeURIComponent(url.split('/api/previous-tasks/')[1]).replace(/ \(.*\)$/, ''));
	const visible = ALL.slice(hidden).filter((t) => Date.parse(t.completed) <= when);
	return { ok: true, status: 200, json: async () => visible.slice(0, PAGE) };
};

// Plain browser scripts that only set globals, loaded the way the extension injects them
const load = async (name: string) => import(`../src/${name}.js`);
await load('minimise');
await load('api');
await load('sync');
g.__makgApi.sleep = () => Promise.resolve();
g.__makgSync.download = (tasks: unknown) => void downloads.push(tasks as { completed: string }[]);
const sync = g.__makgSync as {
	check: (since: string | null) => Promise<{ newest: string | null; newer: number; more: boolean }>;
	collect: (
		full: boolean,
		studentId?: number | null,
	) => Promise<{ count: number; added: number; updated?: boolean; memory?: string; topics?: number }>;
};
const saved = () => store.makgExport as { newest: string; count: number; tasks: { completed: string }[] };

beforeEach(() => {
	asked.length = 0;
	hidden = 0;
	requests = 0;
	store = {};
	downloads = [];
});

test('first export reads the whole history and remembers it', async () => {
	const r = await sync.collect(false);
	assert.deepEqual([r.count, r.added, r.updated], [20, 20, false]);
	assert.equal(saved().count, 20);
	assert.equal(saved().newest, ALL[0].completed);
	assert.equal(downloads.length, 1);
	assert.ok(requests >= 5, 'a first export pages all the way back');
});

test('an export that missed the latest activity is reported stale on reload, then updated cheaply', async () => {
	// 1. Initial sync while the newest three tasks do not exist yet
	hidden = 3;
	const first = await sync.collect(false);
	assert.equal(first.count, 17);
	assert.equal(saved().newest, ALL[3].completed);

	// 2. "Reload the page" once the new activity has happened: the check says there is more to sync
	hidden = 0;
	requests = 0;
	const check = await sync.check(saved().newest);
	assert.equal(check.newer, 3);
	assert.equal(check.newest, ALL[0].completed);
	assert.equal(check.more, false);
	assert.equal(requests, 1, 'the check is one small request');

	// 3. Update: only the new tasks are fetched, merged into the old export, and one complete file is downloaded
	requests = 0;
	downloads = [];
	const update = await sync.collect(false);
	assert.deepEqual([update.count, update.added, update.updated], [20, 3, true]);
	assert.ok(requests <= 2, `an update stops once it reaches the last export (${requests} requests)`);
	assert.equal(downloads.length, 1);
	assert.equal(downloads[0].length, 20);
	assert.equal(new Set(downloads[0].map((t) => t.completed)).size, 20, 'no task twice');
	assert.equal(downloads[0][0].completed, ALL[0].completed, 'newest first');

	// 4. Now it is up to date
	const again = await sync.check(saved().newest);
	assert.equal(again.newer, 0);
});

test('the check says "more" when a whole page is newer than the last export', async () => {
	hidden = 12;
	await sync.collect(false); // 8 tasks
	hidden = 0;
	const check = await sync.check(saved().newest);
	assert.equal(check.newer, PAGE);
	assert.equal(check.more, true);
	// and an update that spans several pages still ends with everything, once
	const update = await sync.collect(false);
	assert.deepEqual([update.count, update.added], [20, 12]);
});

test('starting over fetches everything again and still ends with each task once', async () => {
	hidden = 3;
	await sync.collect(false);
	hidden = 0;
	requests = 0;
	const full = await sync.collect(true);
	assert.deepEqual([full.count, full.updated], [20, false]);
	assert.ok(requests >= 5);
});

// The toolbar badge: set by the background script when a Math Academy page loads and the export is out of date
const badge = { text: '', title: '' };
type Listener = (...a: any[]) => unknown;
const listeners: Record<string, Listener> = {};
Object.assign(g.chrome, {
	action: {
		setBadgeText: ({ text }: { text: string }) => void (badge.text = text),
		setBadgeBackgroundColor: () => {},
		setTitle: ({ title }: { title: string }) => void (badge.title = title),
	},
	scripting: {
		// The scripts are already loaded here; running a function in the "page" is just calling it
		executeScript: async (o: { files?: string[]; func?: (...a: unknown[]) => unknown; args?: unknown[] }) =>
			o.func ? [{ result: await o.func(...(o.args ?? [])) }] : [],
	},
	tabs: { onUpdated: { addListener: (f: Listener) => (listeners.tab = f) } },
});
g.chrome.storage.onChanged = { addListener: (f: Listener) => (listeners.storage = f) };
g.chrome.runtime.onMessage = { addListener: (f: Listener) => (listeners.message = f) };
await load('background');

test('the toolbar badge appears when there is new activity to sync, and clears after the update', async () => {
	hidden = 3;
	await sync.collect(false); // an export that missed the latest three
	hidden = 0;
	badge.text = '';

	// A page that is not Math Academy never triggers a look
	await listeners.tab(1, { status: 'complete' }, { url: 'https://example.com/' });
	assert.equal(badge.text, '');

	await listeners.tab(1, { status: 'complete' }, { url: 'https://mathacademy.com/learn' });
	assert.equal(badge.text, '3');
	assert.match(badge.title, /3 new tasks to sync/);

	// Exporting saves a new copy, which clears it
	await sync.collect(false);
	listeners.storage({ makgExport: {} }, 'local');
	assert.equal(badge.text, '');
});

test('the popup can set the same badge, including "more than"', () => {
	listeners.message({ type: 'makg-badge', newer: 4, more: true });
	assert.equal(badge.text, '4+');
	assert.match(badge.title, /more than 4/);
	listeners.message({ type: 'makg-badge', newer: 0 });
	assert.equal(badge.text, '');
});

test('without a student number nothing is asked about memory and the file is a plain list', async () => {
	const r = await sync.collect(false);
	assert.equal(asked.length, 0);
	assert.equal(r.memory, 'skipped');
	assert.ok(Array.isArray(downloads[0]));
});

test('with a student number each course is asked once and only the memory numbers are kept', async () => {
	const r = await sync.collect(false, 4321);
	assert.deepEqual(asked.length, 2, 'one request per course');
	assert.ok(asked.every((u) => u.includes('/students/4321/knowledge-graph')));
	assert.deepEqual([r.memory, r.topics], ['ok', 2]);
	const file = downloads[0] as unknown as { tasks: unknown[]; topics: Record<string, unknown>[] };
	assert.equal(file.tasks.length, 20);
	assert.deepEqual(
		file.topics.sort((a, b) => (a.id as number) - (b.id as number)),
		[
			{ id: 1, halfLife: 1235, repetition: 3 },
			{ id: 2, halfLife: 999999999, repetition: 30 },
		],
	);
	assert.ok(!JSON.stringify(file.topics).includes('Secret'), 'no topic names or other fields');
});
