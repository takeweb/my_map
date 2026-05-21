import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCastles } from "~/composables/useCastles";

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
				json: async () => [
					{ id: 1, lat: 34.6873, lon: 135.526, name: "大阪城" },
				],
			}),
		);

		const { castles, fetchCastles } = useCastles();
		await fetchCastles();

		expect(castles.value).toHaveLength(1);
		expect(castles.value[0].name).toBe("大阪城");
	});

	it("uses cached data when cache is fresh", async () => {
		localStorage.setItem(
			"castles_jp_v7",
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
