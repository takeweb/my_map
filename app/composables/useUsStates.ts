export function useUsStates() {
	const { fetchAreas, ...rest } = useAdminAreas(
		"/data/us-states.geojson",
		"アメリカ合衆国の州境界データの取得に失敗しました",
	);
	return { ...rest, fetchUsStates: fetchAreas };
}
