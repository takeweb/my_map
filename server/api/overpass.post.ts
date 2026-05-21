export default defineEventHandler(async (event) => {
	const body = await readRawBody(event);
	if (!body) {
		throw createError({ statusCode: 400, message: "Query body is required" });
	}

	const res = await fetch("https://overpass-api.de/api/interpreter", {
		method: "POST",
		body,
	});

	if (!res.ok) {
		throw createError({
			statusCode: res.status,
			message: `Overpass API error: ${res.status}`,
		});
	}

	return res.json();
});
