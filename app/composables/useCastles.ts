const QUERY = `[out:json][timeout:60];
node["historic"="castle"](24,122,46,154);
out body;`;

export function useCastles() {
	const {
		points: castles,
		loading,
		error,
		fetchPoints: fetchCastles,
	} = useOsmPoints({
		cacheKey: "castles_jp_v4",
		query: QUERY,
		defaultName: "城",
	});
	return { castles, loading, error, fetchCastles };
}
