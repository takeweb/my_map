import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCastles } from "~/composables/useCastles";

const mockGeojson = (name: string) => ({
	type: "FeatureCollection",
	features: [
		{
			type: "Feature",
			geometry: { type: "Point", coordinates: [135.526, 34.6873] },
			properties: { id: 1, name },
		},
	],
});

describe("useCastles", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("fetches castles from data file", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => mockGeojson("大阪城"),
			}),
		);

		const { castles, fetchCastles } = useCastles();
		await fetchCastles();

		expect(castles.value?.features).toHaveLength(1);
		expect(castles.value?.features[0].properties.name).toBe("大阪城");
	});

	it("uses cached data when cache is fresh", async () => {
		localStorage.setItem(
			"castles_jp_v8",
			JSON.stringify({
				data: mockGeojson("キャッシュ城"),
				timestamp: Date.now(),
			}),
		);

		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		const { castles, fetchCastles } = useCastles();
		await fetchCastles();

		expect(fetchMock).not.toHaveBeenCalled();
		expect(castles.value?.features[0].properties.name).toBe("キャッシュ城");
	});

	it("sets error state when data file fetch fails", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({ ok: false, status: 404 }),
		);

		const { error, fetchCastles } = useCastles();
		await fetchCastles();

		expect(error.value).toBe("城データの取得に失敗しました");
	});

	it("sets error state when network fails", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockRejectedValue(new Error("Network error")),
		);

		const { error, fetchCastles } = useCastles();
		await fetchCastles();

		expect(error.value).toBe("城データの取得に失敗しました");
	});
});
