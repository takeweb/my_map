export function useCanadaProvinces() {
	const { fetchAreas, ...rest } = useAdminAreas(
		"/data/canada-provinces.geojson",
		"カナダの州境界データの取得に失敗しました",
	);
	return { ...rest, fetchCanadaProvinces: fetchAreas };
}
