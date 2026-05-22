import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import osmtogeojson from "osmtogeojson";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENDPOINT = "https://overpass-api.de/api/interpreter";

const FEATURES = [
	{
		file: "prefectures",
		kind: "polygon",
		query: `[out:json][timeout:180];
relation["admin_level"="4"]["boundary"="administrative"]["ISO3166-2"~"^JP-"];
out geom;`,
	},
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

// Ray casting: point [lon, lat] in polygon ring (array of [lon, lat])
function pointInRing([px, py], ring) {
	let inside = false;
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
		const [xi, yi] = ring[i];
		const [xj, yj] = ring[j];
		if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi)
			inside = !inside;
	}
	return inside;
}

function pointInGeometry(point, geometry) {
	if (geometry.type === "Polygon")
		return pointInRing(point, geometry.coordinates[0]);
	if (geometry.type === "MultiPolygon")
		return geometry.coordinates.some((poly) => pointInRing(point, poly[0]));
	return false;
}

function findPrefectureCode(lon, lat, prefFeatures) {
	const pt = [lon, lat];
	const pref = prefFeatures.find((f) => pointInGeometry(pt, f.geometry));
	return pref?.properties.code ?? null;
}

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

let prefectureFeatures = [];

for (const { file, kind = "point", defaultName, query } of FEATURES) {
	process.stdout.write(`Fetching ${file}... `);

	const res = await fetchWithRetry(query, file);

	if (!res.ok) throw new Error(`HTTP ${res.status} for ${file}`);

	const osmData = await res.json();
	let geojson;

	if (kind === "polygon") {
		geojson = osmtogeojson(osmData);
		geojson.features = geojson.features
			.filter((f) => f.geometry && f.properties?.["ISO3166-2"])
			.map((f) => ({
				...f,
				properties: {
					id: f.id,
					name: f.properties["name:ja"] ?? f.properties.name ?? "",
					code: f.properties["ISO3166-2"],
				},
			}));
		prefectureFeatures = geojson.features;
	} else {
		const seen = new Set();
		const features = osmData.elements
			.map((el) => {
				const lat = el.lat ?? el.center?.lat;
				const lon = el.lon ?? el.center?.lon;
				if (lat == null || lon == null) return null;
				const name = el.tags?.["name:ja"] ?? el.tags?.name ?? defaultName;
				if (name === defaultName) return null;
				const key = `${name}:${Math.round(lat * 100)}:${Math.round(lon * 100)}`;
				if (seen.has(key)) return null;
				seen.add(key);
				const prefecture_code = findPrefectureCode(
					lon,
					lat,
					prefectureFeatures,
				);
				return {
					type: "Feature",
					geometry: { type: "Point", coordinates: [lon, lat] },
					properties: { id: el.id, name, prefecture_code },
				};
			})
			.filter(Boolean);
		geojson = { type: "FeatureCollection", features };
	}

	writeFileSync(
		join(ROOT, "public", "data", `${file}.geojson`),
		JSON.stringify(geojson),
	);
	console.log(`${geojson.features.length} items`);
}
