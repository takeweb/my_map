const QUERY = `[out:json][timeout:90];
area["ISO3166-1"="JP"]["admin_level"="2"]->.japan;
node["man_made"="lighthouse"](area.japan);
out body;`;

export function useLighthouses() {
	const {
		points: lighthouses,
		loading,
		error,
		fetchPoints: fetchLighthouses,
	} = useOsmPoints({
		cacheKey: "lighthouses_jp_v2",
		query: QUERY,
		defaultName: "灯台",
	});
	return { lighthouses, loading, error, fetchLighthouses };
}
