const QUERY = `[out:json][timeout:55];
area(3600282408)->.japan;
node["waterway"="dam"](area.japan);
out body;`;

export function useDams() {
	const {
		points: dams,
		loading,
		error,
		fetchPoints: fetchDams,
	} = useOsmPoints({
		cacheKey: "dams_jp_v5",
		query: QUERY,
		defaultName: "ダム",
	});
	return { dams, loading, error, fetchDams };
}
