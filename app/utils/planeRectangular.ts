import { register } from "ol/proj/proj4";
import proj4 from "proj4";

export type Datum = "JGD2000" | "JGD2011";

export interface PlaneRectangularZone {
	/** 系番号（1〜19） */
	zone: number;
	/** ローマ数字表記 */
	roman: string;
	/** 原点の緯度（度） */
	lat0: number;
	/** 原点の経度（度） */
	lon0: number;
	/** 主な適用区域 */
	area: string;
}

// 平成14年国土交通省告示第9号（平面直角座標系の原点と適用区域）
export const PLANE_RECTANGULAR_ZONES: PlaneRectangularZone[] = [
	{
		zone: 1,
		roman: "I",
		lat0: 33,
		lon0: 129 + 30 / 60,
		area: "長崎・鹿児島の一部",
	},
	{
		zone: 2,
		roman: "II",
		lat0: 33,
		lon0: 131,
		area: "福岡・佐賀・熊本・大分・宮崎・鹿児島",
	},
	{
		zone: 3,
		roman: "III",
		lat0: 36,
		lon0: 132 + 10 / 60,
		area: "山口・島根・広島",
	},
	{
		zone: 4,
		roman: "IV",
		lat0: 33,
		lon0: 133 + 30 / 60,
		area: "香川・愛媛・徳島・高知",
	},
	{
		zone: 5,
		roman: "V",
		lat0: 36,
		lon0: 134 + 20 / 60,
		area: "兵庫・鳥取・岡山",
	},
	{
		zone: 6,
		roman: "VI",
		lat0: 36,
		lon0: 136,
		area: "京都・大阪・福井・滋賀・三重・奈良・和歌山",
	},
	{
		zone: 7,
		roman: "VII",
		lat0: 36,
		lon0: 137 + 10 / 60,
		area: "石川・富山・岐阜・愛知",
	},
	{
		zone: 8,
		roman: "VIII",
		lat0: 36,
		lon0: 138 + 30 / 60,
		area: "新潟・長野・山梨・静岡",
	},
	{
		zone: 9,
		roman: "IX",
		lat0: 36,
		lon0: 139 + 50 / 60,
		area: "東京・福島・栃木・茨城・埼玉・千葉・群馬・神奈川",
	},
	{
		zone: 10,
		roman: "X",
		lat0: 40,
		lon0: 140 + 50 / 60,
		area: "青森・秋田・山形・岩手・宮城",
	},
	{
		zone: 11,
		roman: "XI",
		lat0: 44,
		lon0: 140 + 15 / 60,
		area: "北海道（小樽・函館など）",
	},
	{
		zone: 12,
		roman: "XII",
		lat0: 44,
		lon0: 142 + 15 / 60,
		area: "北海道（札幌・旭川など）",
	},
	{
		zone: 13,
		roman: "XIII",
		lat0: 44,
		lon0: 144 + 15 / 60,
		area: "北海道（北見・帯広・釧路など）",
	},
	{
		zone: 14,
		roman: "XIV",
		lat0: 26,
		lon0: 142,
		area: "東京（小笠原諸島の一部）",
	},
	{
		zone: 15,
		roman: "XV",
		lat0: 26,
		lon0: 127 + 30 / 60,
		area: "沖縄（沖縄本島など）",
	},
	{
		zone: 16,
		roman: "XVI",
		lat0: 26,
		lon0: 124,
		area: "沖縄（宮古・石垣など）",
	},
	{ zone: 17, roman: "XVII", lat0: 26, lon0: 131, area: "沖縄（大東諸島）" },
	{ zone: 18, roman: "XVIII", lat0: 20, lon0: 136, area: "東京（沖ノ鳥島）" },
	{ zone: 19, roman: "XIX", lat0: 26, lon0: 154, area: "東京（南鳥島など）" },
];

const EPSG_BASE: Record<Datum, number> = {
	JGD2000: 2443, // EPSG:2443〜2461
	JGD2011: 6669, // EPSG:6669〜6687
};

export function getZone(zone: number): PlaneRectangularZone {
	const z = PLANE_RECTANGULAR_ZONES[zone - 1];
	if (!z) throw new Error(`平面直角座標系の系番号が不正です: ${zone}`);
	return z;
}

export function epsgCode(datum: Datum, zone: number): string {
	getZone(zone);
	return `EPSG:${EPSG_BASE[datum] + zone - 1}`;
}

// JGD2000・JGD2011 はどちらも GRS80 楕円体で、proj4 の定義上は同じ式になる。
// 両者の差（地殻変動による緯度経度の改定）は座標変換パラメータでは表せない。
export function proj4Def(zone: number): string {
	const { lat0, lon0 } = getZone(zone);
	return `+proj=tmerc +lat_0=${lat0} +lon_0=${lon0} +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs`;
}

let registered = false;

/** 全系（JGD2000・JGD2011）の投影法を OpenLayers に登録する */
export function registerPlaneRectangularProjections() {
	if (registered) return;
	for (const { zone } of PLANE_RECTANGULAR_ZONES) {
		const def = proj4Def(zone);
		proj4.defs(epsgCode("JGD2000", zone), def);
		proj4.defs(epsgCode("JGD2011", zone), def);
	}
	register(proj4);
	registered = true;
}

const GRID_INTERVALS = [
	100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000,
];

/** 表示範囲の幅（m）から、線が多すぎない間隔を選ぶ */
export function chooseGridInterval(span: number, maxLines = 12): number {
	for (const interval of GRID_INTERVALS) {
		if (span / interval <= maxLines) return interval;
	}
	return GRID_INTERVALS[GRID_INTERVALS.length - 1] as number;
}

export interface GridLine {
	/** "x" は X（北方向）が一定の東西線、"y" は Y（東方向）が一定の南北線 */
	axis: "x" | "y";
	value: number;
	/** 平面直角座標系の [東距(Y), 北距(X)] の点列 */
	coords: [number, number][];
}

/**
 * 範囲 [minE, minN, maxE, maxN]（平面直角座標系、m）のグリッド線を作る。
 * 投影変換で曲がるため、各線は segments 分割した点列にする。
 */
export function buildGridLines(
	extent: [number, number, number, number],
	interval: number,
	segments = 32,
): GridLine[] {
	const [minE, minN, maxE, maxN] = extent;
	const lines: GridLine[] = [];
	const steps = (min: number, max: number) => {
		const values: number[] = [];
		for (
			let v = Math.ceil(min / interval) * interval;
			v <= max;
			v += interval
		) {
			values.push(v + 0); // -0 を 0 にする
		}
		return values;
	};
	const along = (min: number, max: number) =>
		Array.from(
			{ length: segments + 1 },
			(_, i) => min + ((max - min) * i) / segments,
		);

	for (const n of steps(minN, maxN)) {
		lines.push({
			axis: "x",
			value: n,
			coords: along(minE, maxE).map((e) => [e, n]),
		});
	}
	for (const e of steps(minE, maxE)) {
		lines.push({
			axis: "y",
			value: e,
			coords: along(minN, maxN).map((n) => [e, n]),
		});
	}
	return lines;
}

export function formatGridLabel(line: GridLine, interval: number): string {
	const name = line.axis === "x" ? "X" : "Y";
	return interval >= 1000
		? `${name}=${(line.value / 1000).toLocaleString("ja-JP")}km`
		: `${name}=${line.value.toLocaleString("ja-JP")}m`;
}

export function formatCoordinate(value: number): string {
	return value.toLocaleString("ja-JP", {
		minimumFractionDigits: 3,
		maximumFractionDigits: 3,
	});
}
