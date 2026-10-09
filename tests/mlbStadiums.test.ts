import { describe, expect, it } from "vitest";
import {
	findStadiumFilter,
	STADIUM_FILTERS,
	STADIUMS,
	teamLogoUrl,
} from "~/utils/mlbStadiums";

describe("mlbStadiums", () => {
	it("contains all 30 teams with unique ids", () => {
		expect(STADIUMS).toHaveLength(30);
		expect(new Set(STADIUMS.map((s) => s.id)).size).toBe(30);
	});

	it("has 5 teams in each of the 6 divisions", () => {
		for (const league of ["AL", "NL"]) {
			for (const division of ["East", "Central", "West"]) {
				const teams = STADIUMS.filter(
					(s) => s.league === league && s.division === division,
				);
				expect(teams, `${league} ${division}`).toHaveLength(5);
			}
		}
	});

	it("places every stadium in North America", () => {
		for (const s of STADIUMS) {
			expect(s.lat, s.stadiumEn).toBeGreaterThan(24);
			expect(s.lat, s.stadiumEn).toBeLessThan(50);
			expect(s.lng, s.stadiumEn).toBeGreaterThan(-125);
			expect(s.lng, s.stadiumEn).toBeLessThan(-66);
		}
	});

	it("filters stadiums by league and division", () => {
		const count = (key: string) =>
			STADIUMS.filter(findStadiumFilter(key).match).length;
		expect(count("all")).toBe(30);
		expect(count("NL")).toBe(15);
		expect(count("AL")).toBe(15);
		expect(count("AL-West")).toBe(5);
		expect(STADIUMS.filter(findStadiumFilter("NL-East").match)).toContainEqual(
			expect.objectContaining({ teamEn: "New York Mets" }),
		);
	});

	it("defines 9 filters and falls back to all for unknown keys", () => {
		expect(STADIUM_FILTERS).toHaveLength(9);
		expect(findStadiumFilter("unknown").key).toBe("all");
	});

	it("builds the team logo url", () => {
		expect(teamLogoUrl(119)).toBe(
			"https://www.mlbstatic.com/team-logos/119.svg",
		);
	});
});
