setTimeout(function () {
	if (scenario === 'saved') {
		say(
			'Saved 4,241 tasks and 312 topic memory levels to ma-activity.json in your Downloads. Now open the graph page and drop it in.',
			'ok',
		);
		site.classList.add('next');
	}
	if (scenario === 'details') document.querySelector('details').open = true;
}, 150);
