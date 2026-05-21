export default defineEventHandler(async (event) => {
	const { query } = await readBody<{ query: string }>(event);

	if (!query) {
		throw createError({ statusCode: 400, message: "query is required" });
	}

	const res = await fetch("https://overpass-api.de/api/interpreter", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({ data: query }),
	});

	if (!res.ok) {
		throw createError({
			statusCode: res.status,
			message: `Overpass API error: ${res.status}`,
		});
	}

	return res.json();
});
