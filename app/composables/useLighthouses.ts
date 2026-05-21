const QUERY = `[out:json][timeout:60];
node["man_made"="lighthouse"](24,122,46,154);
out body;`;

export function useLighthouses() {
	const {
		points: lighthouses,
		loading,
		error,
		fetchPoints: fetchLighthouses,
	} = useOsmPoints({
		cacheKey: "lighthouses_jp_v3",
		query: QUERY,
		defaultName: "灯台",
	});
	return { lighthouses, loading, error, fetchLighthouses };
}
