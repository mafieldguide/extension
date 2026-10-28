/**
 * Keeps only what the knowledge graph needs from one Math Academy task, and drops everything else.
 * Loaded as a plain script by the extension (and imported by the tests), so it only sets a global.
 *
 * Keeps the task type, its points and the points awarded, when it started and finished, the topic (id, name and
 * its prerequisites' ids and names) and the course (id and name). Everything else is left out.
 *
 * From a course's knowledge graph it keeps, per topic you have practised, only the topic's id, its half-life (how
 * long Math Academy expects you to remember it) and how many times it has been practised.
 */
(function () {
	function minimise(task) {
		if (!task || typeof task !== 'object') return null;
		var topic = task.topic;
		var course = task.test && task.test.course;
		return {
			type: typeof task.type === 'string' ? task.type : null,
			points: typeof task.points === 'number' ? task.points : null,
			pointsAwarded: typeof task.pointsAwarded === 'number' ? task.pointsAwarded : null,
			started: typeof task.started === 'string' ? task.started : null,
			completed: typeof task.completed === 'string' ? task.completed : null,
			topic:
				topic && typeof topic.id === 'number'
					? {
							id: topic.id,
							name: typeof topic.name === 'string' ? topic.name : null,
							prerequisites: (Array.isArray(topic.prerequisites) ? topic.prerequisites : [])
								.filter(function (p) {
									return p && typeof p.id === 'number';
								})
								.map(function (p) {
									return { id: p.id, name: typeof p.name === 'string' ? p.name : null };
								}),
						}
					: null,
			test:
				course && typeof course.id === 'number'
					? { course: { id: course.id, name: typeof course.name === 'string' ? course.name : null } }
					: null,
		};
	}
	/** One course's knowledge-graph response, reduced to the practised topics: [{ id, halfLife, repetition }]. */
	function minimiseTopics(response) {
		var topics = response && response.topics;
		if (!topics || typeof topics !== 'object') return [];
		var out = [];
		Object.keys(topics).forEach(function (key) {
			var t = topics[key];
			if (!t || typeof t.id !== 'number') return;
			if (typeof t.repetition !== 'number' || t.repetition <= 0) return;
			if (typeof t.halfLife !== 'number' || !isFinite(t.halfLife) || t.halfLife < 0) return;
			out.push({ id: t.id, halfLife: Math.round(t.halfLife), repetition: Math.round(t.repetition) });
		});
		return out;
	}
	/**
	 * One course's whole topic list from the same response, practised or not: [[id, name, [prerequisite ids]]]. Only
	 * the structure of the course is kept, nothing about how you are doing in it.
	 */
	function courseTopics(response) {
		var topics = response && response.topics;
		if (!topics || typeof topics !== 'object') return [];
		var out = [];
		Object.keys(topics).forEach(function (key) {
			var t = topics[key];
			if (!t || typeof t.id !== 'number') return;
			var prereqs = [];
			(Array.isArray(t.prerequisites) ? t.prerequisites : []).forEach(function (p) {
				var id = p && typeof p === 'object' ? p.id : p;
				if (typeof id === 'number' && prereqs.indexOf(id) < 0) prereqs.push(id);
			});
			out.push([t.id, typeof t.name === 'string' ? t.name : null, prereqs]);
		});
		return out;
	}
	minimise.topics = minimiseTopics;
	minimise.courseTopics = courseTopics;
	globalThis.__makgMinimise = minimise;
})();
