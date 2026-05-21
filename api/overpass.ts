export const config = { runtime: "edge" };

export default async function handler(req: Request): Promise<Response> {
	if (req.method !== "POST") {
		return new Response("Method Not Allowed", { status: 405 });
	}
	const body = await req.text();
	const res = await fetch("https://overpass-api.de/api/interpreter", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body,
	});
	const text = await res.text();
	return new Response(text, {
		status: res.status,
		headers: {
			"Content-Type": res.headers.get("Content-Type") ?? "application/json",
		},
	});
}
