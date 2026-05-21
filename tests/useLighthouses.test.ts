import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLighthouses } from "~/composables/useLighthouses";

describe("useLighthouses", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("fetches lighthouses from Overpass API", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					elements: [
						{ id: 1, lat: 35.0, lon: 135.0, tags: { "name:ja": "テスト灯台" } },
					],
				}),
			}),
		);

		const { lighthouses, fetchLighthouses } = useLighthouses();
		await fetchLighthouses();

		expect(lighthouses.value).toHaveLength(1);
		expect(lighthouses.value[0].name).toBe("テスト灯台");
	});

	it("falls back to name tag when name:ja is absent", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					elements: [
						{ id: 2, lat: 34.0, lon: 136.0, tags: { name: "Osaka Light" } },
					],
				}),
			}),
		);

		const { lighthouses, fetchLighthouses } = useLighthouses();
		await fetchLighthouses();

		expect(lighthouses.value[0].name).toBe("Osaka Light");
	});

	it("uses cached data when cache is fresh", async () => {
		localStorage.setItem(
			"lighthouses_jp_v3",
			JSON.stringify({
				data: [{ id: 3, lat: 33.0, lon: 130.0, name: "キャッシュ灯台" }],
				timestamp: Date.now(),
			}),
		);

		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		const { lighthouses, fetchLighthouses } = useLighthouses();
		await fetchLighthouses();

		expect(fetchMock).not.toHaveBeenCalled();
		expect(lighthouses.value[0].name).toBe("キャッシュ灯台");
	});

	it("excludes elements whose name is only the generic label", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					elements: [
						{
							id: 10,
							lat: 35.0,
							lon: 135.0,
							tags: { "name:ja": "野島埼灯台" },
						},
						{ id: 11, lat: 34.0, lon: 134.0, tags: { name: "灯台" } },
						{ id: 12, lat: 33.0, lon: 133.0 },
					],
				}),
			}),
		);

		const { lighthouses, fetchLighthouses } = useLighthouses();
		await fetchLighthouses();

		expect(lighthouses.value).toHaveLength(1);
		expect(lighthouses.value[0].name).toBe("野島埼灯台");
	});

	it("sets error state when API call fails", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockRejectedValue(new Error("Network error")),
		);

		const { error, fetchLighthouses } = useLighthouses();
		await fetchLighthouses();

		expect(error.value).toBe("灯台データの取得に失敗しました");
	});
});
