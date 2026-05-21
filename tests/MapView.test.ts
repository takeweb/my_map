import { mountSuspended } from "@nuxt/test-utils/runtime";
import { describe, expect, it, vi } from "vitest";
import MapView from "~/components/MapView.vue";

vi.stubGlobal(
	"fetch",
	vi.fn().mockResolvedValue({
		ok: true,
		json: async () => [],
	}),
);

describe("MapView", () => {
	it("renders map wrapper", async () => {
		const wrapper = await mountSuspended(MapView);
		expect(wrapper.find("div").exists()).toBe(true);
	});
});
