export function useLighthouses() {
	const {
		geojson: lighthouses,
		loading,
		error,
		fetchPoints: fetchLighthouses,
	} = useOsmPoints({
		cacheKey: "lighthouses_jp_v9",
		dataUrl: "/data/lighthouses.geojson",
		defaultName: "灯台",
	});
	return { lighthouses, loading, error, fetchLighthouses };
}
