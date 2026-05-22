import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLighthouses } from "~/composables/useLighthouses";

const mockGeojson = (name: string) => ({
	type: "FeatureCollection",
	features: [
		{
			type: "Feature",
			geometry: { type: "Point", coordinates: [135.0, 35.0] },
			properties: { id: 1, name },
		},
	],
});

describe("useLighthouses", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("fetches lighthouses from data file", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => mockGeojson("野島埼灯台"),
			}),
		);

		const { lighthouses, fetchLighthouses } = useLighthouses();
		await fetchLighthouses();

		expect(lighthouses.value?.features).toHaveLength(1);
		expect(lighthouses.value?.features[0].properties.name).toBe("野島埼灯台");
	});

	it("uses cached data when cache is fresh", async () => {
		localStorage.setItem(
			"lighthouses_jp_v9",
			JSON.stringify({
				data: mockGeojson("キャッシュ灯台"),
				timestamp: Date.now(),
			}),
		);

		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		const { lighthouses, fetchLighthouses } = useLighthouses();
		await fetchLighthouses();

		expect(fetchMock).not.toHaveBeenCalled();
		expect(lighthouses.value?.features[0].properties.name).toBe(
			"キャッシュ灯台",
		);
	});

	it("sets error state when data file fetch fails", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({ ok: false, status: 404 }),
		);

		const { error, fetchLighthouses } = useLighthouses();
		await fetchLighthouses();

		expect(error.value).toBe("灯台データの取得に失敗しました");
	});

	it("sets error state when network fails", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockRejectedValue(new Error("Network error")),
		);

		const { error, fetchLighthouses } = useLighthouses();
		await fetchLighthouses();

		expect(error.value).toBe("灯台データの取得に失敗しました");
	});
});
