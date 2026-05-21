import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLighthouses } from "~/composables/useLighthouses";

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
				json: async () => [
					{ id: 1, lat: 35.0, lon: 135.0, name: "野島埼灯台" },
				],
			}),
		);

		const { lighthouses, fetchLighthouses } = useLighthouses();
		await fetchLighthouses();

		expect(lighthouses.value).toHaveLength(1);
		expect(lighthouses.value[0].name).toBe("野島埼灯台");
	});

	it("uses cached data when cache is fresh", async () => {
		localStorage.setItem(
			"lighthouses_jp_v5",
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
