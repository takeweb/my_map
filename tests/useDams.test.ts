import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDams } from "~/composables/useDams";

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
				json: async () => [
					{ id: 1, lat: 36.566, lon: 137.66, name: "黒部ダム" },
				],
			}),
		);

		const { dams, fetchDams } = useDams();
		await fetchDams();

		expect(dams.value).toHaveLength(1);
		expect(dams.value[0].name).toBe("黒部ダム");
	});

	it("uses cached data when cache is fresh", async () => {
		localStorage.setItem(
			"dams_jp_v7",
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
