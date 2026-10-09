import { afterEach, describe, expect, it, vi } from "vitest";
import { useCanadaProvinces } from "~/composables/useCanadaProvinces";

const mockGeojson = {
	type: "FeatureCollection",
	features: [
		{
			type: "Feature",
			geometry: {
				type: "Polygon",
				coordinates: [
					[
						[-79.8, 42.0],
						[-71.9, 41.0],
						[-73.3, 45.0],
						[-79.8, 42.0],
					],
				],
			},
			properties: { code: "CA-ON", name: "オンタリオ州", nameEn: "Ontario" },
		},
	],
};

describe("useCanadaProvinces", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("fetches Canadian provinces from data file", async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => mockGeojson,
		});
		vi.stubGlobal("fetch", fetchMock);

		const { geojson, loading, error, fetchCanadaProvinces } =
			useCanadaProvinces();
		await fetchCanadaProvinces();

		expect(fetchMock).toHaveBeenCalledWith("/data/canada-provinces.geojson");
		expect(geojson.value?.features[0]?.properties.name).toBe("オンタリオ州");
		expect(loading.value).toBe(false);
		expect(error.value).toBeNull();
	});

	it("sets error state when data file fetch fails", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({ ok: false, status: 404 }),
		);

		const { geojson, error, fetchCanadaProvinces } = useCanadaProvinces();
		await fetchCanadaProvinces();

		expect(geojson.value).toBeNull();
		expect(error.value).toBe("カナダの州境界データの取得に失敗しました");
	});

	it("sets error state when network fails", async () => {
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

		const { error, fetchCanadaProvinces } = useCanadaProvinces();
		await fetchCanadaProvinces();

		expect(error.value).toBe("カナダの州境界データの取得に失敗しました");
	});
});
