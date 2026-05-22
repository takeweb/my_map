export function useCastles() {
	const {
		geojson: castles,
		loading,
		error,
		fetchPoints: fetchCastles,
	} = useOsmPoints({
		cacheKey: "castles_jp_v10",
		dataUrl: "/data/castles.geojson",
		defaultName: "城",
	});
	return { castles, loading, error, fetchCastles };
}
