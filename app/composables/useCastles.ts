export function useCastles() {
	const {
		points: castles,
		loading,
		error,
		fetchPoints: fetchCastles,
	} = useOsmPoints({
		cacheKey: "castles_jp_v7",
		dataUrl: "/data/castles.json",
		defaultName: "城",
	});
	return { castles, loading, error, fetchCastles };
}
