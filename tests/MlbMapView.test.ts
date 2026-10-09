import { mountSuspended } from "@nuxt/test-utils/runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MlbMapView from "~/components/MlbMapView.vue";

describe("MlbMapView", () => {
	beforeEach(() => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				text: async () => '<svg xmlns="http://www.w3.org/2000/svg"/>',
			}),
		);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("renders all stadiums by default", async () => {
		const wrapper = await mountSuspended(MlbMapView);
		expect(wrapper.text()).toContain("MLB 球場（30）");
		expect(wrapper.findAll('input[name="stadium-filter"]')).toHaveLength(9);
	});

	it("loads team logos for the map pins", async () => {
		await mountSuspended(MlbMapView);
		expect(fetch).toHaveBeenCalledTimes(30);
		expect(fetch).toHaveBeenCalledWith(
			"https://www.mlbstatic.com/team-logos/119.svg",
		);
	});

	it("updates the count when a division is selected", async () => {
		const wrapper = await mountSuspended(MlbMapView);
		await wrapper.find('input[value="NL-Central"]').setValue(true);
		expect(wrapper.text()).toContain("MLB 球場（5）");
	});
});
