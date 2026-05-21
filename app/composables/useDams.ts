export function useDams() {
	const {
		points: dams,
		loading,
		error,
		fetchPoints: fetchDams,
	} = useOsmPoints({
		cacheKey: "dams_jp_v6",
		dataUrl: "/data/dams.json",
		defaultName: "ダム",
	});
	return { dams, loading, error, fetchDams };
}
