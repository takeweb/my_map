import { fromLonLat, transform } from "ol/proj";
import { describe, expect, it } from "vitest";
import {
	buildGridLines,
	chooseGridInterval,
	epsgCode,
	formatGridLabel,
	getZone,
	PLANE_RECTANGULAR_ZONES,
	registerPlaneRectangularProjections,
} from "~/utils/planeRectangular";

describe("planeRectangular", () => {
	it("19系すべてを定義している", () => {
		expect(PLANE_RECTANGULAR_ZONES).toHaveLength(19);
		expect(PLANE_RECTANGULAR_ZONES.map((z) => z.zone)).toEqual(
			Array.from({ length: 19 }, (_, i) => i + 1),
		);
	});

	it("測地系と系から EPSG コードを返す", () => {
		expect(epsgCode("JGD2000", 1)).toBe("EPSG:2443");
		expect(epsgCode("JGD2000", 19)).toBe("EPSG:2461");
		expect(epsgCode("JGD2011", 1)).toBe("EPSG:6669");
		expect(epsgCode("JGD2011", 9)).toBe("EPSG:6677");
		expect(epsgCode("JGD2011", 19)).toBe("EPSG:6687");
		expect(() => epsgCode("JGD2011", 20)).toThrow();
	});

	it("系の原点は (0, 0) に変換される", () => {
		registerPlaneRectangularProjections();
		for (const datum of ["JGD2000", "JGD2011"] as const) {
			const { lat0, lon0 } = getZone(9);
			const [e, n] = transform(
				fromLonLat([lon0, lat0]),
				"EPSG:3857",
				epsgCode(datum, 9),
			) as [number, number];
			expect(e).toBeCloseTo(0, 3);
			expect(n).toBeCloseTo(0, 3);
		}
	});

	it("東京駅付近を IX 系の座標に変換できる", () => {
		registerPlaneRectangularProjections();
		// 東京駅（35.681236, 139.767125）は IX 系で X ≒ -35,370m, Y ≒ -6,000m 付近
		const [e, n] = transform(
			[139.767125, 35.681236],
			"EPSG:4326",
			epsgCode("JGD2011", 9),
		) as [number, number];
		expect(n).toBeGreaterThan(-36000);
		expect(n).toBeLessThan(-35000);
		expect(e).toBeGreaterThan(-7000);
		expect(e).toBeLessThan(-5000);
	});

	it("表示範囲に応じてグリッド間隔を選ぶ", () => {
		expect(chooseGridInterval(1000)).toBe(100);
		expect(chooseGridInterval(50000)).toBe(5000);
		expect(chooseGridInterval(1_000_000)).toBe(100000);
		expect(chooseGridInterval(100_000_000)).toBe(200000);
	});

	it("範囲内の X・Y 一定のグリッド線を作る", () => {
		const lines = buildGridLines([-1500, -500, 1500, 2500], 1000, 4);
		const xs = lines.filter((l) => l.axis === "x").map((l) => l.value);
		const ys = lines.filter((l) => l.axis === "y").map((l) => l.value);
		expect(xs).toEqual([0, 1000, 2000]);
		expect(ys).toEqual([-1000, 0, 1000]);
		for (const line of lines) {
			expect(line.coords).toHaveLength(5);
		}
		const yLine = lines.find((l) => l.axis === "y" && l.value === 1000);
		expect(yLine?.coords[0]).toEqual([1000, -500]);
		expect(yLine?.coords[4]).toEqual([1000, 2500]);
	});

	it("ラベルは間隔に応じて km か m で表示する", () => {
		expect(
			formatGridLabel({ axis: "x", value: -20000, coords: [] }, 10000),
		).toBe("X=-20km");
		expect(formatGridLabel({ axis: "y", value: 500, coords: [] }, 100)).toBe(
			"Y=500m",
		);
	});
});
