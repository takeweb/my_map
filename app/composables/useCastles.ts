const QUERY = `[out:json][timeout:55];
area(3600282408)->.japan;
node["historic"="castle"](area.japan);
out body;`;

export function useCastles() {
	const {
		points: castles,
		loading,
		error,
		fetchPoints: fetchCastles,
	} = useOsmPoints({
		cacheKey: "castles_jp_v5",
		query: QUERY,
		defaultName: "城",
	});
	return { castles, loading, error, fetchCastles };
}
