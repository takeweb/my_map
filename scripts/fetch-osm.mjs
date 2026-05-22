import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENDPOINT = "https://overpass-api.de/api/interpreter";

const FEATURES = [
	{
		file: "lighthouses",
		defaultName: "灯台",
		query: `[out:json][timeout:120];
area["ISO3166-1"="JP"]["admin_level"="2"]->.japan;
node["man_made"="lighthouse"](area.japan);
out body;`,
	},
	{
		file: "castles",
		defaultName: "城",
		query: `[out:json][timeout:120];
area["ISO3166-1"="JP"]["admin_level"="2"]->.japan;
(
  node["historic"="castle"](area.japan);
  way["historic"="castle"](area.japan);
  relation["historic"="castle"](area.japan);
  node["historic"="ruins"]["ruins"="castle"](area.japan);
  way["historic"="ruins"]["ruins"="castle"](area.japan);
  relation["historic"="ruins"]["ruins"="castle"](area.japan);
);
out center;`,
	},
	{
		file: "dams",
		defaultName: "ダム",
		query: `[out:json][timeout:120];
area["ISO3166-1"="JP"]["admin_level"="2"]->.japan;
(
  node["waterway"="dam"](area.japan);
  way["waterway"="dam"](area.japan);
  relation["waterway"="dam"](area.japan);
);
out center;`,
	},
];

mkdirSync(join(ROOT, "public", "data"), { recursive: true });

async function fetchWithRetry(query, file, retries = 3) {
	for (let i = 0; i < retries; i++) {
		if (i > 0) {
			const wait = 30 * i;
			process.stdout.write(`retry ${i}/${retries - 1} (wait ${wait}s)... `);
			await new Promise((r) => setTimeout(r, wait * 1000));
		}
		const res = await fetch(ENDPOINT, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				"User-Agent": "my-map-build/1.0",
			},
			body: `data=${encodeURIComponent(query)}`,
		});
		if (res.ok) return res;
		if (res.status !== 504 || i === retries - 1)
			throw new Error(`HTTP ${res.status} for ${file}`);
	}
}

for (const { file, defaultName, query } of FEATURES) {
	process.stdout.write(`Fetching ${file}... `);

	const res = await fetchWithRetry(query, file);

	if (!res.ok) throw new Error(`HTTP ${res.status} for ${file}`);

	const { elements } = await res.json();
	const seen = new Set();
	const features = elements
		.map((el) => {
			const lat = el.lat ?? el.center?.lat;
			const lon = el.lon ?? el.center?.lon;
			if (lat == null || lon == null) return null;
			const name = el.tags?.["name:ja"] ?? el.tags?.name ?? defaultName;
			if (name === defaultName) return null;
			const key = `${name}:${Math.round(lat * 100)}:${Math.round(lon * 100)}`;
			if (seen.has(key)) return null;
			seen.add(key);
			return {
				type: "Feature",
				geometry: { type: "Point", coordinates: [lon, lat] },
				properties: { id: el.id, name },
			};
		})
		.filter(Boolean);

	const geojson = { type: "FeatureCollection", features };
	writeFileSync(
		join(ROOT, "public", "data", `${file}.geojson`),
		JSON.stringify(geojson),
	);
	console.log(`${features.length} items`);
}
