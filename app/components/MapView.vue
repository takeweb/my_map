<script setup lang="ts">
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
const {
	dams,
	loading: loadingDams,
	error: errorDams,
	fetchDams,
} = useDams();

// biome-ignore lint/correctness/noUnusedVariables: used in <template>
const isLoading = computed(
	() => loadingLighthouses.value || loadingCastles.value || loadingDams.value,
);
// biome-ignore lint/correctness/noUnusedVariables: used in <template>
const fetchError = computed(
	() => errorLighthouses.value ?? errorCastles.value ?? errorDams.value,
);
// biome-ignore lint/correctness/noUnusedVariables: used in <template>
const totalCount = computed(
	() => lighthouseCount.value + castleCount.value + damCount.value,
);

const geoJsonFormat = new GeoJSON();
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

const lighthouseStyle = makeStyle("#f97316");
const castleStyle = makeStyle("#3b82f6");
const damStyle = makeStyle("#10b981");

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

let lighthouseLayer: VectorLayer | null = null;
let castleLayer: VectorLayer | null = null;
let damLayer: VectorLayer | null = null;
let map: OlMap | null = null;

watch(
	() => visibleLayers.lighthouses,
	(v) => { lighthouseLayer?.setVisible(v); if (hasSearched.value) doSearch(); },
);
watch(
	() => visibleLayers.castles,
	(v) => { castleLayer?.setVisible(v); if (hasSearched.value) doSearch(); },
);
watch(
	() => visibleLayers.dams,
	(v) => { damLayer?.setVisible(v); if (hasSearched.value) doSearch(); },
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
		{ source: lighthouseSource, data: lighthouses.value, visible: visibleLayers.lighthouses, count: lighthouseCount },
		{ source: castleSource, data: castles.value, visible: visibleLayers.castles, count: castleCount },
		{ source: damSource, data: dams.value, visible: visibleLayers.dams, count: damCount },
	];

	for (const { source, data, visible, count } of targets) {
		source.clear();
		count.value = 0;
		if (!visible || !data) continue;
		const matched = data.features.filter((f) => f.properties.name?.includes(q));
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
			results.push({ name: feature.get("name") as string, coord: geom.getCoordinates() });
		}
	}

	searchCoords.value = results;
	hasSearched.value = true;
	updateSearchPixels();

	if (results.length > 0) {
		map?.getView().animate({ center: results[0].coord, duration: 500 });
	}
}

// biome-ignore lint/correctness/noUnusedVariables: used in <template>
function clearAll() {
	const restores = [
		{ source: lighthouseSource, data: lighthouses.value, count: lighthouseCount },
		{ source: castleSource, data: castles.value, count: castleCount },
		{ source: damSource, data: dams.value, count: damCount },
	];
	for (const { source, data, count } of restores) {
		source.clear();
		if (data) {
			source.addFeatures(geoJsonFormat.readFeatures(data, { featureProjection: "EPSG:3857" }));
			count.value = data.features.length;
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

	lighthouseLayer = new VectorLayer({
		source: lighthouseSource,
		style: lighthouseStyle,
	});
	castleLayer = new VectorLayer({ source: castleSource, style: castleStyle });
	damLayer = new VectorLayer({ source: damSource, style: damStyle });

	map = new OlMap({
		target: mapContainer.value,
		layers: [
			new TileLayer({ source: new OSM() }),
			lighthouseLayer,
			castleLayer,
			damLayer,
		],
		view: new View({
			center: fromLonLat([137.0, 37.0]),
			zoom: 5,
		}),
	});

	map.on("postrender", updateSearchPixels);

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

	await Promise.all([fetchLighthouses(), fetchCastles(), fetchDams()]);
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
      <label class="flex cursor-pointer items-center gap-2 text-sm">
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
