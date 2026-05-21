const QUERY = `[out:json][timeout:60];
node["waterway"="dam"](24,122,46,154);
out body;`;

export function useDams() {
	const {
		points: dams,
		loading,
		error,
		fetchPoints: fetchDams,
	} = useOsmPoints({
		cacheKey: "dams_jp_v4",
		query: QUERY,
		defaultName: "ダム",
	});
	return { dams, loading, error, fetchDams };
}
