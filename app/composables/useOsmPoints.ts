export interface OsmPoint {
	id: number;
	lat: number;
	lon: number;
	name: string;
}

interface CacheEntry {
	data: OsmPoint[];
	timestamp: number;
}

interface Options {
	cacheKey: string;
	dataUrl: string;
	defaultName: string;
}

const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

export function useOsmPoints({ cacheKey, dataUrl, defaultName }: Options) {
	const points = ref<OsmPoint[]>([]);
	const loading = ref(false);
	const error = ref<string | null>(null);

	async function fetchPoints() {
		const raw = localStorage.getItem(cacheKey);
		if (raw) {
			const cache: CacheEntry = JSON.parse(raw);
			if (Date.now() - cache.timestamp < CACHE_TTL) {
				points.value = cache.data;
				return;
			}
		}

		loading.value = true;
		error.value = null;

		try {
			const res = await fetch(dataUrl);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data: OsmPoint[] = await res.json();
			points.value = data;
			localStorage.setItem(
				cacheKey,
				JSON.stringify({ data, timestamp: Date.now() }),
			);
		} catch {
			error.value = `${defaultName}データの取得に失敗しました`;
		} finally {
			loading.value = false;
		}
	}

	return { points, loading, error, fetchPoints };
}
