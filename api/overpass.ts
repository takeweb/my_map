export const config = { maxDuration: 60 };

// biome-ignore lint/suspicious/noExplicitAny: Vercel Node.js handler signature
export default async function handler(req: any, res: any) {
	if (req.method !== "POST") {
		res.status(405).send("Method Not Allowed");
		return;
	}

	const chunks: Buffer[] = [];
	for await (const chunk of req) {
		chunks.push(Buffer.from(chunk));
	}
	const body = Buffer.concat(chunks).toString();

	const upstream = await fetch("https://overpass-api.de/api/interpreter", {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			"User-Agent": "my-map-proxy/1.0",
		},
		body,
	});

	const text = await upstream.text();
	res
		.status(upstream.status)
		.setHeader(
			"Content-Type",
			upstream.headers.get("Content-Type") ?? "application/json",
		)
		.send(text);
}
