const QUERY = `[out:json][timeout:55];
area(3600282408)->.japan;
node["man_made"="lighthouse"](area.japan);
out body;`;

export function useLighthouses() {
	const {
		points: lighthouses,
		loading,
		error,
		fetchPoints: fetchLighthouses,
	} = useOsmPoints({
		cacheKey: "lighthouses_jp_v4",
		query: QUERY,
		defaultName: "灯台",
	});
	return { lighthouses, loading, error, fetchLighthouses };
}
