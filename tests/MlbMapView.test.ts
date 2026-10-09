import { mountSuspended } from "@nuxt/test-utils/runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MlbMapView from "~/components/MlbMapView.vue";

const mockUsStates = {
	type: "FeatureCollection",
	features: [
		{
			type: "Feature",
			geometry: {
				type: "Polygon",
				coordinates: [
					[
						[-124, 42],
						[-120, 42],
						[-114, 35],
						[-124, 42],
					],
				],
			},
			properties: {
				code: "US-CA",
				name: "カリフォルニア州",
				nameEn: "California",
			},
		},
	],
};

describe("MlbMapView", () => {
	beforeEach(() => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockImplementation(async (url: string) =>
				url === "/data/us-states.geojson"
					? { ok: true, json: async () => mockUsStates }
					: {
							ok: true,
							text: async () => '<svg xmlns="http://www.w3.org/2000/svg"/>',
						},
			),
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
		// ロゴ 30 件 + 州境界データ 1 件
		expect(fetch).toHaveBeenCalledTimes(31);
		expect(fetch).toHaveBeenCalledWith(
			"https://www.mlbstatic.com/team-logos/119.svg",
		);
	});

	it("loads the US state polygons layer", async () => {
		const wrapper = await mountSuspended(MlbMapView);
		await vi.waitFor(() =>
			expect(wrapper.text()).toContain("アメリカ合衆国の州 (1)"),
		);
		expect(fetch).toHaveBeenCalledWith("/data/us-states.geojson");
	});

	it("updates the count when a division is selected", async () => {
		const wrapper = await mountSuspended(MlbMapView);
		await wrapper.find('input[value="NL-Central"]').setValue(true);
		expect(wrapper.text()).toContain("MLB 球場（5）");
	});
});
