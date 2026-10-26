import assert from 'node:assert/strict';
import { test } from 'node:test';

// A plain browser script that only sets a global; imported by variable so the type checker leaves it alone
const scriptPath = '../src/minimise.js';
await import(scriptPath);
const minimise = (globalThis as unknown as { __makgMinimise: (t: unknown) => Record<string, unknown> | null })
	.__makgMinimise;

// A task shaped like the site's own response, with plenty of fields the graph does not need
const task = (id: number, topic: number, prereq: number | null, at: string, type = 'Lesson') => ({
	id,
	type,
	topicCourseId: 7,
	locked: null,
	importance: 2,
	reason: 'because',
	progress: 1,
	points: 20,
	pointsAwarded: 18,
	mp: 3,
	mpAwarded: 3,
	mpDecayRate: 0.1,
	topic: {
		id: topic,
		name: `Topic ${topic}`,
		course: { id: 7, name: 'Course' },
		prerequisites:
			prereq == null ? [] : [{ id: prereq, name: `Topic ${prereq}`, urlSlug: `topic-${prereq}` }],
	},
	started: '2026-01-01T10:00:00.000Z',
	completed: at,
	timeCompletedStr: '7:21 PM',
	dateCompletedStr: 'Thu, Jan 1st, 2026',
	test: { id: 99, name: 'Quiz', timeLimit: 600, questionCount: 8, course: { id: 7, name: 'Course' } },
	progressStr: '100%',
	multistep: { id: 5 },
});

const raw = [
	task(1, 10, null, '2026-01-02T10:00:00.000Z'),
	task(2, 11, 10, '2026-01-03T10:00:00.000Z'),
	task(3, 10, null, '2026-01-04T10:00:00.000Z', 'Review'),
];

test('it keeps only the fields the graph reads', () => {
	const slim = minimise(raw[1]) as unknown as Record<string, unknown>;
	assert.deepEqual(Object.keys(slim).sort(), [
		'completed',
		'points',
		'pointsAwarded',
		'started',
		'test',
		'topic',
		'type',
	]);
	assert.deepEqual(slim.topic, { id: 11, name: 'Topic 11', prerequisites: [{ id: 10, name: 'Topic 10' }] });
	assert.deepEqual(slim.test, { course: { id: 7, name: 'Course' } });
});

test('odd input never throws and never carries unknown fields through', () => {
	assert.equal(minimise(null), null);
	const out = minimise({ type: 'Lesson', email: 'a@b.c', topic: { id: 'x' } }) as unknown as Record<
		string,
		unknown
	>;
	assert.equal(out.topic, null);
	assert.equal('email' in out, false);
});
