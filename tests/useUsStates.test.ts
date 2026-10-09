import { afterEach, describe, expect, it, vi } from "vitest";
import { useUsStates } from "~/composables/useUsStates";

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
			properties: { code: "US-NY", name: "ニューヨーク州", nameEn: "New York" },
		},
	],
};

describe("useUsStates", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("fetches US states from data file", async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => mockGeojson,
		});
		vi.stubGlobal("fetch", fetchMock);

		const { geojson, loading, error, fetchUsStates } = useUsStates();
		await fetchUsStates();

		expect(fetchMock).toHaveBeenCalledWith("/data/us-states.geojson");
		expect(geojson.value?.features[0]?.properties.name).toBe("ニューヨーク州");
		expect(loading.value).toBe(false);
		expect(error.value).toBeNull();
	});

	it("sets error state when data file fetch fails", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({ ok: false, status: 404 }),
		);

		const { geojson, error, fetchUsStates } = useUsStates();
		await fetchUsStates();

		expect(geojson.value).toBeNull();
		expect(error.value).toBe(
			"アメリカ合衆国の州境界データの取得に失敗しました",
		);
	});

	it("sets error state when network fails", async () => {
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

		const { error, fetchUsStates } = useUsStates();
		await fetchUsStates();

		expect(error.value).toBe(
			"アメリカ合衆国の州境界データの取得に失敗しました",
		);
	});
});
