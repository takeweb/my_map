const QUERY = `[out:json][timeout:90];
area["ISO3166-1"="JP"]["admin_level"="2"]->.japan;
(
  node["historic"="castle"](area.japan);
  way["historic"="castle"](area.japan);
  relation["historic"="castle"](area.japan);
);
out center;`;

export function useCastles() {
	const {
		points: castles,
		loading,
		error,
		fetchPoints: fetchCastles,
	} = useOsmPoints({
		cacheKey: "castles_jp_v2",
		query: QUERY,
		defaultName: "城",
	});
	return { castles, loading, error, fetchCastles };
}
