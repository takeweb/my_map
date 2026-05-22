export function usePrefectures() {
	const geojson = ref<Record<string, unknown> | null>(null);
	const loading = ref(false);
	const error = ref<string | null>(null);

	async function fetchPrefectures() {
		loading.value = true;
		error.value = null;
		try {
			const res = await fetch("/data/prefectures.geojson");
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			geojson.value = await res.json();
		} catch {
			error.value = "都道府県データの取得に失敗しました";
		} finally {
			loading.value = false;
		}
	}

	return { geojson, loading, error, fetchPrefectures };
}
