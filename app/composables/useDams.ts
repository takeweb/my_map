export function useDams() {
	const {
		geojson: dams,
		loading,
		error,
		fetchPoints: fetchDams,
	} = useOsmPoints({
		cacheKey: "dams_jp_v9",
		dataUrl: "/data/dams.geojson",
		defaultName: "ダム",
	});
	return { dams, loading, error, fetchDams };
}
