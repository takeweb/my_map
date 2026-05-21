export function useLighthouses() {
	const {
		points: lighthouses,
		loading,
		error,
		fetchPoints: fetchLighthouses,
	} = useOsmPoints({
		cacheKey: "lighthouses_jp_v5",
		dataUrl: "/data/lighthouses.json",
		defaultName: "灯台",
	});
	return { lighthouses, loading, error, fetchLighthouses };
}
