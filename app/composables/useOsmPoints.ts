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
	query: string;
	defaultName: string;
}

type OsmElement = {
	id: number;
	lat?: number;
	lon?: number;
	center?: { lat: number; lon: number };
	tags?: Record<string, string>;
};

const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

export function useOsmPoints({ cacheKey, query, defaultName }: Options) {
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
			const res = await fetch("https://overpass.kumi.systems/api/interpreter", {
				method: "POST",
				body: query,
			});

			if (!res.ok) throw new Error(`HTTP ${res.status}`);

			const json = await res.json();
			const data: OsmPoint[] = (json.elements as OsmElement[])
				.map((el) => {
					const lat = el.lat ?? el.center?.lat;
					const lon = el.lon ?? el.center?.lon;
					if (lat === undefined || lon === undefined) return null;
					return {
						id: el.id,
						lat,
						lon,
						name: el.tags?.["name:ja"] ?? el.tags?.name ?? defaultName,
					};
				})
				.filter((x): x is OsmPoint => x !== null && x.name !== defaultName);

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
