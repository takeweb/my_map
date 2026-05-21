const QUERY = `[out:json][timeout:90];
area["ISO3166-1"="JP"]["admin_level"="2"]->.japan;
(
  node["waterway"="dam"](area.japan);
  way["waterway"="dam"](area.japan);
  relation["waterway"="dam"](area.japan);
);
out center;`;

export function useDams() {
	const {
		points: dams,
		loading,
		error,
		fetchPoints: fetchDams,
	} = useOsmPoints({
		cacheKey: "dams_jp_v2",
		query: QUERY,
		defaultName: "ダム",
	});
	return { dams, loading, error, fetchDams };
}
