import { mountSuspended } from "@nuxt/test-utils/runtime";
import { describe, expect, it } from "vitest";
import MlbMapView from "~/components/MlbMapView.vue";

describe("MlbMapView", () => {
	it("renders all stadiums by default", async () => {
		const wrapper = await mountSuspended(MlbMapView);
		expect(wrapper.text()).toContain("MLB 球場（30）");
		expect(wrapper.findAll('input[name="stadium-filter"]')).toHaveLength(9);
	});

	it("updates the count when a division is selected", async () => {
		const wrapper = await mountSuspended(MlbMapView);
		await wrapper.find('input[value="NL-Central"]').setValue(true);
		expect(wrapper.text()).toContain("MLB 球場（5）");
	});
});
