import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCastles } from "~/composables/useCastles";

describe("useCastles", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("fetches castles from Overpass API (node)", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					elements: [
						{
							id: 1,
							lat: 34.6873,
							lon: 135.526,
							tags: { "name:ja": "大阪城" },
						},
					],
				}),
			}),
		);

		const { castles, fetchCastles } = useCastles();
		await fetchCastles();

		expect(castles.value).toHaveLength(1);
		expect(castles.value[0].name).toBe("大阪城");
	});

	it("resolves lat/lon from center for way/relation elements", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					elements: [
						{
							id: 2,
							center: { lat: 35.6852, lon: 139.7528 },
							tags: { "name:ja": "江戸城" },
						},
					],
				}),
			}),
		);

		const { castles, fetchCastles } = useCastles();
		await fetchCastles();

		expect(castles.value[0].lat).toBe(35.6852);
		expect(castles.value[0].lon).toBe(139.7528);
	});

	it("skips elements with no coordinate", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					elements: [{ id: 3, tags: { name: "no-coord" } }],
				}),
			}),
		);

		const { castles, fetchCastles } = useCastles();
		await fetchCastles();

		expect(castles.value).toHaveLength(0);
	});

	it("uses cached data when cache is fresh", async () => {
		localStorage.setItem(
			"castles_jp_v4",
			JSON.stringify({
				data: [{ id: 4, lat: 34.0, lon: 131.0, name: "キャッシュ城" }],
				timestamp: Date.now(),
			}),
		);

		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		const { castles, fetchCastles } = useCastles();
		await fetchCastles();

		expect(fetchMock).not.toHaveBeenCalled();
		expect(castles.value[0].name).toBe("キャッシュ城");
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
							lat: 34.6873,
							lon: 135.526,
							tags: { "name:ja": "大阪城" },
						},
						{ id: 11, lat: 34.0, lon: 134.0, tags: { name: "城" } },
						{ id: 12, lat: 33.0, lon: 133.0 },
					],
				}),
			}),
		);

		const { castles, fetchCastles } = useCastles();
		await fetchCastles();

		expect(castles.value).toHaveLength(1);
		expect(castles.value[0].name).toBe("大阪城");
	});

	it("sets error state when API call fails", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockRejectedValue(new Error("Network error")),
		);

		const { error, fetchCastles } = useCastles();
		await fetchCastles();

		expect(error.value).toBe("城データの取得に失敗しました");
	});
});
