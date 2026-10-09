import stadiumData from "~/data/mlbStadiums.json";

export type League = "AL" | "NL";
export type Division = "East" | "Central" | "West";

export interface Stadium {
	/** MLB Stats API のチーム ID（ロゴ画像の取得に使用） */
	id: number;
	team: string;
	teamEn: string;
	league: League;
	division: Division;
	stadium: string;
	stadiumEn: string;
	city: string;
	cityEn: string;
	lat: number;
	lng: number;
}

export interface StadiumFilter {
	key: string;
	label: string;
	/** リーグ色の凡例を表示する場合に指定 */
	league?: League;
	/** 地区別フィルタの見出し */
	group?: string;
	match: (stadium: Stadium) => boolean;
}

// MLB Stats API（statsapi.mlb.com/api/v1/teams?season=2026）と照合済みの2026年シーズンデータ
export const STADIUMS = stadiumData as Stadium[];

export const LEAGUES: Record<League, { name: string; color: string }> = {
	AL: { name: "アメリカンリーグ", color: "#1d4ed8" },
	NL: { name: "ナショナルリーグ", color: "#c8102e" },
};

export const DIVISIONS: Record<Division, string> = {
	East: "東地区",
	Central: "中地区",
	West: "西地区",
};

const ALL_FILTER: StadiumFilter = {
	key: "all",
	label: "全球場",
	match: () => true,
};

export const STADIUM_FILTERS: StadiumFilter[] = [
	ALL_FILTER,
	{
		key: "NL",
		label: LEAGUES.NL.name,
		league: "NL",
		match: (s) => s.league === "NL",
	},
	{
		key: "AL",
		label: LEAGUES.AL.name,
		league: "AL",
		match: (s) => s.league === "AL",
	},
	...(["AL", "NL"] as const).flatMap((league) =>
		(Object.keys(DIVISIONS) as Division[]).map((division) => ({
			key: `${league}-${division}`,
			label: DIVISIONS[division],
			group: `${LEAGUES[league].name} 地区別`,
			match: (s: Stadium) => s.league === league && s.division === division,
		})),
	),
];

export function findStadiumFilter(key: string): StadiumFilter {
	return STADIUM_FILTERS.find((f) => f.key === key) ?? ALL_FILTER;
}

export function teamLogoUrl(teamId: number): string {
	return `https://www.mlbstatic.com/team-logos/${teamId}.svg`;
}
