export interface UsStateFeature {
	type: "Feature";
	geometry: { type: string; coordinates: unknown };
	properties: { code: string; name: string; nameEn: string };
}

export interface UsStateCollection {
	type: "FeatureCollection";
	features: UsStateFeature[];
}

export function useUsStates() {
	const geojson = ref<UsStateCollection | null>(null);
	const loading = ref(false);
	const error = ref<string | null>(null);

	async function fetchUsStates() {
		loading.value = true;
		error.value = null;
		try {
			const res = await fetch("/data/us-states.geojson");
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			geojson.value = await res.json();
		} catch {
			error.value = "州境界データの取得に失敗しました";
		} finally {
			loading.value = false;
		}
	}

	return { geojson, loading, error, fetchUsStates };
}
