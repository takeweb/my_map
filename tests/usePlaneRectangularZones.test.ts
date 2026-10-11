import { afterEach, describe, expect, it, vi } from "vitest";
import { usePlaneRectangularZones } from "~/composables/usePlaneRectangularZones";

const mockGeojson = {
	type: "FeatureCollection",
	features: [
		{
			type: "Feature",
			geometry: {
				type: "MultiPolygon",
				coordinates: [
					[
						[
							[139.5, 35.5],
							[140.0, 35.5],
							[140.0, 36.0],
							[139.5, 35.5],
						],
					],
				],
			},
			properties: { zone: 9, name: "東京都" },
		},
	],
};

describe("usePlaneRectangularZones", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("適用区域のデータを取得する", async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => mockGeojson,
		});
		vi.stubGlobal("fetch", fetchMock);

		const { geojson, loading, error, fetchPlaneRectangularZones } =
			usePlaneRectangularZones();
		await fetchPlaneRectangularZones();

		expect(fetchMock).toHaveBeenCalledWith(
			"/data/plane-rectangular-zones.geojson",
		);
		expect(geojson.value?.features[0]?.properties.zone).toBe(9);
		expect(loading.value).toBe(false);
		expect(error.value).toBeNull();
	});

	it("取得済みなら再取得しない", async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => mockGeojson,
		});
		vi.stubGlobal("fetch", fetchMock);

		const { fetchPlaneRectangularZones } = usePlaneRectangularZones();
		await fetchPlaneRectangularZones();
		await fetchPlaneRectangularZones();

		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("取得に失敗したらエラーを設定する", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({ ok: false, status: 404 }),
		);

		const { geojson, error, fetchPlaneRectangularZones } =
			usePlaneRectangularZones();
		await fetchPlaneRectangularZones();

		expect(geojson.value).toBeNull();
		expect(error.value).toBe("平面直角座標系の区域データの取得に失敗しました");
	});
});
