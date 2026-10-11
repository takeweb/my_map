import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import osmtogeojson from "osmtogeojson";

// 平面直角座標系（I〜XIX系）の適用区域を GeoJSON にする（平成14年国土交通省告示第9号）
// - 都道府県単位の系は public/data/prefectures.geojson をそのまま使う
// - 東京都・沖縄県・鹿児島県は告示の経緯度の境界線で都道府県ポリゴンを切り分ける
// - 北海道は振興局・市町村単位なので、OSM（Overpass）から境界を取得する
// 適用区域は変化しないため pnpm generate には含めない
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENDPOINT = "https://overpass-api.de/api/interpreter";
const OUTPUT = join(ROOT, "public", "data", "plane-rectangular-zones.geojson");

const INF = 1000;
const dm = (deg, min) => deg + min / 60;

// 都道府県コード → 系（全域が1つの系に入るもの）
const WHOLE_PREFECTURES = {
	1: ["JP-42"],
	2: ["JP-40", "JP-41", "JP-43", "JP-44", "JP-45"],
	3: ["JP-35", "JP-32", "JP-34"],
	4: ["JP-37", "JP-38", "JP-36", "JP-39"],
	5: ["JP-28", "JP-31", "JP-33"],
	6: ["JP-26", "JP-27", "JP-18", "JP-25", "JP-24", "JP-29", "JP-30"],
	7: ["JP-17", "JP-16", "JP-21", "JP-23"],
	8: ["JP-15", "JP-20", "JP-19", "JP-22"],
	9: ["JP-07", "JP-09", "JP-08", "JP-11", "JP-12", "JP-10", "JP-14"],
	10: ["JP-02", "JP-05", "JP-06", "JP-03", "JP-04"],
};

// 経緯度の矩形 [西, 南, 東, 北] で切り分ける都道府県
// 鹿児島県の I 系: 北緯32度〜27度、東経128度18分〜130度（奄美群島は東経130度13分まで）の島
const KAGOSHIMA_I = [
	[dm(128, 18), 27, 130, 32],
	[130, 27, dm(130, 13), 29],
];
const SPLIT_PREFECTURES = [
	{ code: "JP-46", zone: 1, rects: KAGOSHIMA_I },
	{
		code: "JP-46",
		zone: 2,
		// I 系の矩形の外側を矩形の組み合わせで表す
		rects: [
			[-INF, -INF, INF, 27],
			[-INF, 32, INF, INF],
			[-INF, 27, dm(128, 18), 32],
			[dm(130, 13), 27, INF, 32],
			[130, 29, dm(130, 13), 32],
		],
	},
	{ code: "JP-13", zone: 9, rects: [[-INF, 28, INF, INF]] },
	{ code: "JP-13", zone: 14, rects: [[dm(140, 30), -INF, 143, 28]] },
	{ code: "JP-13", zone: 18, rects: [[-INF, -INF, dm(140, 30), 28]] },
	{ code: "JP-13", zone: 19, rects: [[143, -INF, INF, 28]] },
	{ code: "JP-47", zone: 15, rects: [[126, -INF, 130, INF]] },
	{ code: "JP-47", zone: 16, rects: [[-INF, -INF, 126, INF]] },
	{ code: "JP-47", zone: 17, rects: [[130, -INF, INF, INF]] },
];

// 北海道: 振興局（admin_level=5）単位で丸ごと入るもの
const HOKKAIDO_SUBPREFECTURES = {
	11: ["後志総合振興局", "渡島総合振興局", "檜山振興局"],
	12: [
		"石狩振興局",
		"空知総合振興局",
		"上川総合振興局",
		"留萌振興局",
		"宗谷総合振興局",
		"日高振興局",
	],
	13: ["十勝総合振興局", "釧路総合振興局", "根室振興局"],
};
// 胆振・オホーツクは市町村（admin_level=7）単位で系が分かれる
const HOKKAIDO_MUNICIPALITIES = {
	11: ["伊達市", "豊浦町", "壮瞥町", "洞爺湖町"],
	12: [
		"室蘭市",
		"苫小牧市",
		"登別市",
		"白老町",
		"厚真町",
		"安平町",
		"むかわ町",
		"紋別市",
		"佐呂間町",
		"遠軽町",
		"湧別町",
		"滝上町",
		"興部町",
		"西興部村",
		"雄武町",
	],
	13: [
		"北見市",
		"網走市",
		"美幌町",
		"津別町",
		"斜里町",
		"清里町",
		"小清水町",
		"訓子府町",
		"置戸町",
		"大空町",
	],
};

const municipalityNames = Object.values(HOKKAIDO_MUNICIPALITIES).flat();
const HOKKAIDO_QUERY = `
[out:json][timeout:240];
area["ISO3166-2"="JP-01"]["admin_level"="4"]->.hk;
(
  relation["boundary"="administrative"]["admin_level"="5"](area.hk);
  relation["boundary"="administrative"]["admin_level"="7"]["name"~"^(${municipalityNames.join("|")})$"](area.hk);
);
out geom;
`;

async function fetchWithRetry(query, retries = 3) {
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
		if (![429, 504].includes(res.status) || i === retries - 1)
			throw new Error(`HTTP ${res.status} for Hokkaido boundaries`);
	}
}

// 表示用なので Douglas-Peucker で約100mの精度に間引く
const SIMPLIFY_TOLERANCE = 0.001;

function simplifyRing(ring) {
	if (ring.length <= 4) return ring;
	const keep = new Uint8Array(ring.length);
	keep[0] = 1;
	keep[ring.length - 1] = 1;
	const stack = [[0, ring.length - 1]];
	while (stack.length > 0) {
		const [s, e] = stack.pop();
		const [x1, y1] = ring[s];
		const [x2, y2] = ring[e];
		const dx = x2 - x1;
		const dy = y2 - y1;
		const len = Math.hypot(dx, dy);
		let maxDist = 0;
		let index = -1;
		for (let i = s + 1; i < e; i++) {
			const [x, y] = ring[i];
			const dist =
				len === 0
					? Math.hypot(x - x1, y - y1)
					: Math.abs(dy * x - dx * y + x2 * y1 - y2 * x1) / len;
			if (dist > maxDist) {
				maxDist = dist;
				index = i;
			}
		}
		if (index !== -1 && maxDist > SIMPLIFY_TOLERANCE) {
			keep[index] = 1;
			stack.push([s, index], [index, e]);
		}
	}
	return ring.filter((_, i) => keep[i]);
}

// Sutherland-Hodgman で輪を矩形に切り取る
function clipRing(ring, [minX, minY, maxX, maxY]) {
	const edges = [
		[(p) => p[0] >= minX, (a, b) => intersectX(a, b, minX)],
		[(p) => p[0] <= maxX, (a, b) => intersectX(a, b, maxX)],
		[(p) => p[1] >= minY, (a, b) => intersectY(a, b, minY)],
		[(p) => p[1] <= maxY, (a, b) => intersectY(a, b, maxY)],
	];
	let output = ring.slice(0, -1);
	for (const [inside, intersect] of edges) {
		const input = output;
		output = [];
		for (let i = 0; i < input.length; i++) {
			const cur = input[i];
			const prev = input[(i + input.length - 1) % input.length];
			if (inside(cur)) {
				if (!inside(prev)) output.push(intersect(prev, cur));
				output.push(cur);
			} else if (inside(prev)) {
				output.push(intersect(prev, cur));
			}
		}
		if (output.length === 0) return null;
	}
	return output.length >= 3 ? [...output, output[0]] : null;
}

function intersectX([x1, y1], [x2, y2], x) {
	return [x, y1 + ((y2 - y1) * (x - x1)) / (x2 - x1)];
}

function intersectY([x1, y1], [x2, y2], y) {
	return [x1 + ((x2 - x1) * (y - y1)) / (y2 - y1), y];
}

function toPolygons(geometry) {
	if (geometry.type === "Polygon") return [geometry.coordinates];
	if (geometry.type === "MultiPolygon") return geometry.coordinates;
	return [];
}

function clipPolygons(polygons, rect) {
	const result = [];
	for (const polygon of polygons) {
		const [outer, ...holes] = polygon;
		const clipped = clipRing(outer, rect);
		if (!clipped) continue;
		result.push([
			clipped,
			...holes.map((h) => clipRing(h, rect)).filter((h) => h !== null),
		]);
	}
	return result;
}

function finalize(polygons) {
	const round = ([x, y]) => [
		Math.round(x * 1e4) / 1e4,
		Math.round(y * 1e4) / 1e4,
	];
	return polygons.map((polygon) =>
		polygon.map((ring) => {
			// 小さな島は間引くと消えるので元の形を残す
			const simplified = simplifyRing(ring);
			return (simplified.length >= 4 ? simplified : ring).map(round);
		}),
	);
}

function feature(zone, name, polygons) {
	const coordinates = finalize(polygons);
	if (coordinates.length === 0) return null;
	return {
		type: "Feature",
		geometry: { type: "MultiPolygon", coordinates },
		properties: { zone, name },
	};
}

const prefectures = JSON.parse(
	readFileSync(join(ROOT, "public", "data", "prefectures.geojson"), "utf-8"),
).features;
const prefByCode = new Map(prefectures.map((f) => [f.properties.code, f]));
const getPref = (code) => {
	const pref = prefByCode.get(code);
	if (!pref) throw new Error(`prefectures.geojson に ${code} がありません`);
	return pref;
};

const features = [];

for (const [zone, codes] of Object.entries(WHOLE_PREFECTURES)) {
	for (const code of codes) {
		const pref = getPref(code);
		features.push(
			feature(Number(zone), pref.properties.name, toPolygons(pref.geometry)),
		);
	}
}

for (const { code, zone, rects } of SPLIT_PREFECTURES) {
	const pref = getPref(code);
	const polygons = rects.flatMap((rect) =>
		clipPolygons(toPolygons(pref.geometry), rect),
	);
	features.push(feature(zone, pref.properties.name, polygons));
}

process.stdout.write("Fetching Hokkaido boundaries... ");
const res = await fetchWithRetry(HOKKAIDO_QUERY);
const hokkaido = osmtogeojson(await res.json()).features.filter(
	(f) => f.geometry && f.id?.startsWith("relation/"),
);
console.log("done");

const findHokkaido = (level, name) => {
	const found = hokkaido.find(
		(f) =>
			f.properties.admin_level === level &&
			(f.properties["name:ja"] ?? f.properties.name) === name,
	);
	if (!found) throw new Error(`北海道の境界が見つかりません: ${name}`);
	return found;
};

for (const [groups, level] of [
	[HOKKAIDO_SUBPREFECTURES, "5"],
	[HOKKAIDO_MUNICIPALITIES, "7"],
]) {
	for (const [zone, names] of Object.entries(groups)) {
		for (const name of names) {
			const f = findHokkaido(level, name);
			features.push(feature(Number(zone), name, toPolygons(f.geometry)));
		}
	}
}

const output = features.filter((f) => f !== null);
for (let zone = 1; zone <= 19; zone++) {
	const count = output.filter((f) => f.properties.zone === zone).length;
	if (count === 0) throw new Error(`${zone}系の区域がありません`);
}
writeFileSync(
	OUTPUT,
	JSON.stringify({ type: "FeatureCollection", features: output }),
);
console.log(`plane-rectangular-zones: ${output.length} items`);
