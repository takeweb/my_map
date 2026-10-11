export interface PlaneRectangularZoneFeature {
	type: "Feature";
	geometry: { type: string; coordinates: unknown };
	properties: { zone: number; name: string };
}

export interface PlaneRectangularZoneCollection {
	type: "FeatureCollection";
	features: PlaneRectangularZoneFeature[];
}

// 平面直角座標系の適用区域（scripts/fetch-plane-zones.mjs が生成する静的 GeoJSON）
export function usePlaneRectangularZones() {
	const geojson = ref<PlaneRectangularZoneCollection | null>(null);
	const loading = ref(false);
	const error = ref<string | null>(null);

	async function fetchPlaneRectangularZones() {
		if (geojson.value || loading.value) return;
		loading.value = true;
		error.value = null;
		try {
			const res = await fetch("/data/plane-rectangular-zones.geojson");
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			geojson.value = await res.json();
		} catch {
			error.value = "平面直角座標系の区域データの取得に失敗しました";
		} finally {
			loading.value = false;
		}
	}

	return { geojson, loading, error, fetchPlaneRectangularZones };
}
