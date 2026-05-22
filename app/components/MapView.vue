<script setup lang="ts">
import type { FeatureLike } from "ol/Feature";
import GeoJSON from "ol/format/GeoJSON";
import type Point from "ol/geom/Point";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import OlMap from "ol/Map";
import { fromLonLat } from "ol/proj";
import OSM from "ol/source/OSM";
import VectorSource from "ol/source/Vector";
import CircleStyle from "ol/style/Circle";
import Fill from "ol/style/Fill";
import Stroke from "ol/style/Stroke";
import Style from "ol/style/Style";
import View from "ol/View";

const mapContainer = ref<HTMLDivElement | null>(null);
const popupName = ref<string | null>(null);
const popupPos = ref<[number, number] | null>(null);

const searchQuery = ref("");
const searchCoords = ref<Array<{ name: string; coord: number[] }>>([]);
const searchPopups = ref<Array<{ name: string; pixel: [number, number] }>>([]);
const hasSearched = ref(false);

const visibleLayers = reactive({
	lighthouses: true,
	castles: true,
	dams: true,
});

const visiblePrefCodes = ref<string[]>([]);
// biome-ignore lint/correctness/noUnusedVariables: used in <template>
const prefectureList = computed(() =>
	(prefectures.value?.features ?? [])
		.map((f) => ({
			name: f.properties.name as string,
			code: f.properties.code as string,
		}))
		.sort((a, b) => a.code.localeCompare(b.code)),
);

// 都道府県
const {
	geojson: prefectures,
	loading: loadingPrefectures,
	error: errorPrefectures,
	fetchPrefectures,
} = usePrefectures();

// 灯台
const {
	lighthouses,
	loading: loadingLighthouses,
	error: errorLighthouses,
	fetchLighthouses,
} = useLighthouses();

// 城
const {
	castles,
	loading: loadingCastles,
	error: errorCastles,
	fetchCastles,
} = useCastles();

// ダム
const { dams, loading: loadingDams, error: errorDams, fetchDams } = useDams();

// biome-ignore lint/correctness/noUnusedVariables: used in <template>
const isLoading = computed(
	() =>
		loadingPrefectures.value ||
		loadingLighthouses.value ||
		loadingCastles.value ||
		loadingDams.value,
);
// biome-ignore lint/correctness/noUnusedVariables: used in <template>
const fetchError = computed(
	() =>
		errorPrefectures.value ??
		errorLighthouses.value ??
		errorCastles.value ??
		errorDams.value,
);
// biome-ignore lint/correctness/noUnusedVariables: used in <template>
const totalCount = computed(
	() => lighthouseCount.value + castleCount.value + damCount.value,
);

const geoJsonFormat = new GeoJSON();
const prefectureSource = new VectorSource();
const lighthouseSource = new VectorSource();
const castleSource = new VectorSource();
const damSource = new VectorSource();

const lighthouseCount = ref(0);
const castleCount = ref(0);
const damCount = ref(0);

function makeStyle(color: string) {
	return new Style({
		image: new CircleStyle({
			radius: 5,
			fill: new Fill({ color }),
			stroke: new Stroke({ color: "#ffffff", width: 1.5 }),
		}),
	});
}

function makeStyleFn(color: string) {
	const style = makeStyle(color);
	return (feature: FeatureLike) => {
		const code = feature.get("prefecture_code") as string | undefined;
		if (code && !visiblePrefCodes.value.includes(code)) return [];
		return style;
	};
}

const lighthouseStyleFn = makeStyleFn("#f97316");
const castleStyleFn = makeStyleFn("#3b82f6");
const damStyleFn = makeStyleFn("#10b981");

const prefectureStyleBase = new Style({
	stroke: new Stroke({ color: "#6366f1", width: 1 }),
	fill: new Fill({ color: "rgba(99, 102, 241, 0.05)" }),
});

function prefectureStyleFn(feature: FeatureLike) {
	return visiblePrefCodes.value.includes(feature.get("code") as string)
		? prefectureStyleBase
		: [];
}

watch(prefectures, (data) => {
	prefectureSource.clear();
	if (data) {
		prefectureSource.addFeatures(
			geoJsonFormat.readFeatures(data, { featureProjection: "EPSG:3857" }),
		);
		visiblePrefCodes.value = data.features.map(
			(f) => f.properties.code as string,
		);
	}
});
watch(lighthouses, (data) => {
	lighthouseSource.clear();
	if (data) {
		lighthouseSource.addFeatures(
			geoJsonFormat.readFeatures(data, { featureProjection: "EPSG:3857" }),
		);
		lighthouseCount.value = data.features.length;
	}
});
watch(castles, (data) => {
	castleSource.clear();
	if (data) {
		castleSource.addFeatures(
			geoJsonFormat.readFeatures(data, { featureProjection: "EPSG:3857" }),
		);
		castleCount.value = data.features.length;
	}
});
watch(dams, (data) => {
	damSource.clear();
	if (data) {
		damSource.addFeatures(
			geoJsonFormat.readFeatures(data, { featureProjection: "EPSG:3857" }),
		);
		damCount.value = data.features.length;
	}
});

let prefectureLayer: VectorLayer | null = null;
let lighthouseLayer: VectorLayer | null = null;
let castleLayer: VectorLayer | null = null;
let damLayer: VectorLayer | null = null;
let map: OlMap | null = null;

function countVisible(source: VectorSource) {
	return source.getFeatures().filter((f) => {
		const code = f.get("prefecture_code") as string | null;
		return !code || visiblePrefCodes.value.includes(code);
	}).length;
}

watch(
	visiblePrefCodes,
	() => {
		prefectureSource.changed();
		lighthouseSource.changed();
		castleSource.changed();
		damSource.changed();
		lighthouseCount.value = countVisible(lighthouseSource);
		castleCount.value = countVisible(castleSource);
		damCount.value = countVisible(damSource);
	},
	{ deep: true },
);

watch(
	() => visibleLayers.lighthouses,
	(v) => {
		lighthouseLayer?.setVisible(v);
		if (hasSearched.value) doSearch();
	},
);
watch(
	() => visibleLayers.castles,
	(v) => {
		castleLayer?.setVisible(v);
		if (hasSearched.value) doSearch();
	},
);
watch(
	() => visibleLayers.dams,
	(v) => {
		damLayer?.setVisible(v);
		if (hasSearched.value) doSearch();
	},
);

function updateSearchPixels() {
	if (!map) return;
	searchPopups.value = searchCoords.value
		.map(({ name, coord }) => {
			const pixel = map!.getPixelFromCoordinate(coord);
			return pixel ? { name, pixel: pixel as [number, number] } : null;
		})
		.filter((p): p is { name: string; pixel: [number, number] } => p !== null);
}

function doSearch() {
	const q = searchQuery.value.trim();
	if (!q) return;

	const results: Array<{ name: string; coord: number[] }> = [];
	const targets = [
		{
			source: lighthouseSource,
			data: lighthouses.value,
			visible: visibleLayers.lighthouses,
			count: lighthouseCount,
		},
		{
			source: castleSource,
			data: castles.value,
			visible: visibleLayers.castles,
			count: castleCount,
		},
		{
			source: damSource,
			data: dams.value,
			visible: visibleLayers.dams,
			count: damCount,
		},
	];

	for (const { source, data, visible, count } of targets) {
		source.clear();
		count.value = 0;
		if (!visible || !data) continue;
		const matched = data.features.filter((f) => {
			const code = f.properties.prefecture_code as string | null;
			return (
				f.properties.name?.includes(q) &&
				(!code || visiblePrefCodes.value.includes(code))
			);
		});
		if (matched.length === 0) continue;
		source.addFeatures(
			geoJsonFormat.readFeatures(
				{ ...data, features: matched },
				{ featureProjection: "EPSG:3857" },
			),
		);
		count.value = matched.length;
		for (const feature of source.getFeatures()) {
			const geom = feature.getGeometry() as Point;
			results.push({
				name: feature.get("name") as string,
				coord: geom.getCoordinates(),
			});
		}
	}

	searchCoords.value = results;
	hasSearched.value = true;

	if (results.length > 0) {
		map
			?.getView()
			.animate({ center: results[0].coord, duration: 500 }, updateSearchPixels);
	} else {
		updateSearchPixels();
	}
}

// biome-ignore lint/correctness/noUnusedVariables: used in <template>
function clearAll() {
	const restores = [
		{
			source: lighthouseSource,
			data: lighthouses.value,
			count: lighthouseCount,
		},
		{ source: castleSource, data: castles.value, count: castleCount },
		{ source: damSource, data: dams.value, count: damCount },
	];
	for (const { source, data, count } of restores) {
		source.clear();
		if (data) {
			source.addFeatures(
				geoJsonFormat.readFeatures(data, { featureProjection: "EPSG:3857" }),
			);
			count.value = countVisible(source);
		}
	}
	searchQuery.value = "";
	searchCoords.value = [];
	searchPopups.value = [];
	hasSearched.value = false;
	popupName.value = null;
	popupPos.value = null;
}

onMounted(async () => {
	if (!mapContainer.value) return;

	prefectureLayer = new VectorLayer({
		source: prefectureSource,
		style: prefectureStyleFn,
	});
	lighthouseLayer = new VectorLayer({
		source: lighthouseSource,
		style: lighthouseStyleFn,
	});
	castleLayer = new VectorLayer({ source: castleSource, style: castleStyleFn });
	damLayer = new VectorLayer({ source: damSource, style: damStyleFn });

	map = new OlMap({
		target: mapContainer.value,
		layers: [
			new TileLayer({ source: new OSM() }),
			prefectureLayer,
			lighthouseLayer,
			castleLayer,
			damLayer,
		],
		view: new View({
			center: fromLonLat([137.0, 37.0]),
			zoom: 5,
		}),
	});

	map.on("moveend", updateSearchPixels);

	map.on("click", (e) => {
		const feature = map?.forEachFeatureAtPixel(e.pixel, (f) => f);
		if (feature) {
			popupName.value = feature.get("name") as string;
			popupPos.value = e.pixel as [number, number];
		} else {
			popupName.value = null;
			popupPos.value = null;
		}
	});

	map.on("pointermove", (e) => {
		if (mapContainer.value) {
			mapContainer.value.style.cursor = map?.hasFeatureAtPixel(e.pixel)
				? "pointer"
				: "";
		}
	});

	await Promise.all([
		fetchPrefectures(),
		fetchLighthouses(),
		fetchCastles(),
		fetchDams(),
	]);
});

onUnmounted(() => {
	map?.setTarget(undefined);
	map = null;
});
</script>

<template>
  <div class="relative w-full h-screen">
    <div ref="mapContainer" class="w-full h-full" />

    <!-- 読み込み中 -->
    <div
      v-if="isLoading"
      class="absolute left-1/2 top-4 -translate-x-1/2 rounded-lg bg-white/90 px-4 py-2 text-sm shadow"
    >
      データを読み込み中...
    </div>

    <!-- エラー -->
    <div
      v-if="fetchError"
      class="absolute left-1/2 top-4 -translate-x-1/2 rounded-lg bg-red-100 px-4 py-2 text-sm text-red-700 shadow"
    >
      {{ fetchError }}
    </div>

    <!-- レイヤー切り替え＋検索 -->
    <div class="absolute right-4 top-4 rounded-lg bg-white/90 p-3 shadow-md">
      <p class="mb-2 text-xs font-bold text-gray-700">
        レイヤー（{{ hasSearched ? searchCoords.length : totalCount }}）
      </p>

      <!-- 都道府県 -->
      <details class="mb-1.5">
        <summary class="flex cursor-pointer items-center gap-2 text-sm select-none">
          <span class="size-3 rounded bg-indigo-500 opacity-50 shrink-0" />
          都道府県
          <span class="text-xs text-gray-400">({{ visiblePrefCodes.length }}/{{ prefectureList.length }})</span>
        </summary>
        <div class="mt-1 flex gap-1">
          <button
            class="flex-1 rounded bg-gray-100 px-1 py-0.5 text-xs hover:bg-gray-200"
            type="button"
            @click="visiblePrefCodes = prefectureList.map((p) => p.code)"
          >全選択</button>
          <button
            class="flex-1 rounded bg-gray-100 px-1 py-0.5 text-xs hover:bg-gray-200"
            type="button"
            @click="visiblePrefCodes = []"
          >全解除</button>
        </div>
        <div class="mt-1 max-h-40 overflow-y-auto flex flex-col gap-0.5">
          <label
            v-for="pref in prefectureList"
            :key="pref.code"
            class="flex cursor-pointer items-center gap-1.5 text-xs"
          >
            <input
              :checked="visiblePrefCodes.includes(pref.code)"
              class="accent-indigo-500"
              type="checkbox"
              @change="(e) => {
                const checked = (e.target as HTMLInputElement).checked;
                if (checked) { if (!visiblePrefCodes.includes(pref.code)) visiblePrefCodes.push(pref.code); }
                else { visiblePrefCodes = visiblePrefCodes.filter((c) => c !== pref.code); }
              }"
            />
            {{ pref.name }}
          </label>
        </div>
      </details>

      <label class="mt-1.5 flex cursor-pointer items-center gap-2 text-sm">
        <input v-model="visibleLayers.lighthouses" class="accent-orange-500" type="checkbox" />
        <span class="size-3 rounded-full bg-orange-500" />
        灯台
        <span class="text-xs text-gray-400">({{ lighthouseCount }})</span>
      </label>
      <label class="mt-1.5 flex cursor-pointer items-center gap-2 text-sm">
        <input v-model="visibleLayers.castles" class="accent-blue-500" type="checkbox" />
        <span class="size-3 rounded-full bg-blue-500" />
        城
        <span class="text-xs text-gray-400">({{ castleCount }})</span>
      </label>
      <label class="mt-1.5 flex cursor-pointer items-center gap-2 text-sm">
        <input v-model="visibleLayers.dams" class="accent-emerald-500" type="checkbox" />
        <span class="size-3 rounded-full bg-emerald-500" />
        ダム
        <span class="text-xs text-gray-400">({{ damCount }})</span>
      </label>
      <div class="mt-3 flex flex-col gap-1.5">
        <input
          v-model="searchQuery"
          class="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none"
          placeholder="名称で検索..."
          type="text"
          @keyup.enter="doSearch"
        />
        <div class="flex gap-1.5">
          <button
            class="flex-1 rounded bg-gray-100 px-2 py-1.5 text-sm hover:bg-gray-200"
            type="button"
            @click="doSearch"
          >
            検索
          </button>
          <button
            class="flex-1 rounded bg-gray-100 px-2 py-1.5 text-sm hover:bg-gray-200"
            type="button"
            @click="clearAll"
          >
            クリア
          </button>
        </div>
      </div>
    </div>

    <!-- クリックポップアップ -->
    <div
      v-if="popupName && popupPos"
      class="absolute rounded-lg bg-white px-3 py-2 text-sm shadow-lg"
      :style="{ left: `${popupPos[0] + 12}px`, top: `${popupPos[1] - 12}px` }"
    >
      {{ popupName }}
    </div>

    <!-- 検索結果ポップアップ -->
    <div
      v-for="(popup, i) in searchPopups"
      :key="i"
      class="absolute rounded-lg bg-yellow-50 px-3 py-2 text-sm shadow-lg border border-yellow-300"
      :style="{ left: `${popup.pixel[0] + 12}px`, top: `${popup.pixel[1] - 12}px` }"
    >
      {{ popup.name }}
    </div>
  </div>
</template>
