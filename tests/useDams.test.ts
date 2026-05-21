import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDams } from "~/composables/useDams";

describe("useDams", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("fetches dams from Overpass API (node)", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					elements: [
						{ id: 1, lat: 35.5, lon: 137.5, tags: { "name:ja": "テストダム" } },
					],
				}),
			}),
		);

		const { dams, fetchDams } = useDams();
		await fetchDams();

		expect(dams.value).toHaveLength(1);
		expect(dams.value[0].name).toBe("テストダム");
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
							center: { lat: 34.5, lon: 133.5 },
							tags: { "name:ja": "黒部ダム" },
						},
					],
				}),
			}),
		);

		const { dams, fetchDams } = useDams();
		await fetchDams();

		expect(dams.value[0].lat).toBe(34.5);
		expect(dams.value[0].lon).toBe(133.5);
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

		const { dams, fetchDams } = useDams();
		await fetchDams();

		expect(dams.value).toHaveLength(0);
	});

	it("uses cached data when cache is fresh", async () => {
		localStorage.setItem(
			"dams_jp_v4",
			JSON.stringify({
				data: [{ id: 4, lat: 36.0, lon: 137.0, name: "キャッシュダム" }],
				timestamp: Date.now(),
			}),
		);

		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		const { dams, fetchDams } = useDams();
		await fetchDams();

		expect(fetchMock).not.toHaveBeenCalled();
		expect(dams.value[0].name).toBe("キャッシュダム");
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
							lat: 36.566,
							lon: 137.66,
							tags: { "name:ja": "黒部ダム" },
						},
						{ id: 11, lat: 35.0, lon: 136.0, tags: { name: "ダム" } },
						{ id: 12, lat: 34.0, lon: 135.0 },
					],
				}),
			}),
		);

		const { dams, fetchDams } = useDams();
		await fetchDams();

		expect(dams.value).toHaveLength(1);
		expect(dams.value[0].name).toBe("黒部ダム");
	});

	it("sets error state when API call fails", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockRejectedValue(new Error("Network error")),
		);

		const { error, fetchDams } = useDams();
		await fetchDams();

		expect(error.value).toBe("ダムデータの取得に失敗しました");
	});
});
