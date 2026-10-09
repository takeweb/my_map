import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// アメリカ合衆国の州境界（50州 + コロンビア特別区）を Natural Earth から取得する
// Natural Earth はパブリックドメイン。1:50m 縮尺で、州名の日本語表記（name_ja）を含む
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE =
	"https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_50m_admin_1_states_provinces.geojson";

// 座標を小数点以下4桁（約10m）に丸めてファイルサイズを抑える
function roundCoords(coords) {
	return typeof coords[0] === "number"
		? coords.map((c) => Math.round(c * 1e4) / 1e4)
		: coords.map(roundCoords);
}

process.stdout.write("Fetching us-states... ");
const res = await fetch(SOURCE);
if (!res.ok) throw new Error(`HTTP ${res.status} for us-states`);
const source = await res.json();

const features = source.features
	.filter((f) => f.properties.iso_a2 === "US")
	.map((f) => ({
		type: "Feature",
		geometry: {
			type: f.geometry.type,
			coordinates: roundCoords(f.geometry.coordinates),
		},
		properties: {
			code: f.properties.iso_3166_2,
			name: f.properties.name_ja,
			nameEn: f.properties.name,
		},
	}))
	.sort((a, b) => a.properties.code.localeCompare(b.properties.code));

writeFileSync(
	join(ROOT, "public", "data", "us-states.geojson"),
	JSON.stringify({ type: "FeatureCollection", features }),
);
console.log(`${features.length} items`);
