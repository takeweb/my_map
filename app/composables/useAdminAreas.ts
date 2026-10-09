export interface AdminAreaFeature {
	type: "Feature";
	geometry: { type: string; coordinates: unknown };
	properties: { code: string; name: string; nameEn: string };
}

export interface AdminAreaCollection {
	type: "FeatureCollection";
	features: AdminAreaFeature[];
}

// 州などの行政区画の境界（静的 GeoJSON）を取得する共通実装
export function useAdminAreas(dataUrl: string, errorMessage: string) {
	const geojson = ref<AdminAreaCollection | null>(null);
	const loading = ref(false);
	const error = ref<string | null>(null);

	async function fetchAreas() {
		loading.value = true;
		error.value = null;
		try {
			const res = await fetch(dataUrl);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			geojson.value = await res.json();
		} catch {
			error.value = errorMessage;
		} finally {
			loading.value = false;
		}
	}

	return { geojson, loading, error, fetchAreas };
}
