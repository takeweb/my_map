import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDams } from "~/composables/useDams";

const mockGeojson = (name: string) => ({
	type: "FeatureCollection",
	features: [
		{
			type: "Feature",
			geometry: { type: "Point", coordinates: [137.66, 36.566] },
			properties: { id: 1, name },
		},
	],
});

describe("useDams", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("fetches dams from data file", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => mockGeojson("黒部ダム"),
			}),
		);

		const { dams, fetchDams } = useDams();
		await fetchDams();

		expect(dams.value?.features).toHaveLength(1);
		expect(dams.value?.features[0].properties.name).toBe("黒部ダム");
	});

	it("uses cached data when cache is fresh", async () => {
		localStorage.setItem(
			"dams_jp_v9",
			JSON.stringify({
				data: mockGeojson("キャッシュダム"),
				timestamp: Date.now(),
			}),
		);

		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		const { dams, fetchDams } = useDams();
		await fetchDams();

		expect(fetchMock).not.toHaveBeenCalled();
		expect(dams.value?.features[0].properties.name).toBe("キャッシュダム");
	});

	it("sets error state when data file fetch fails", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({ ok: false, status: 404 }),
		);

		const { error, fetchDams } = useDams();
		await fetchDams();

		expect(error.value).toBe("ダムデータの取得に失敗しました");
	});

	it("sets error state when network fails", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockRejectedValue(new Error("Network error")),
		);

		const { error, fetchDams } = useDams();
		await fetchDams();

		expect(error.value).toBe("ダムデータの取得に失敗しました");
	});
});
