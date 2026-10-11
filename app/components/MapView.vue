<script setup lang="ts">
import { createEmpty, extend } from "ol/extent";
import type { FeatureLike } from "ol/Feature";
import Feature from "ol/Feature";
import GeoJSON from "ol/format/GeoJSON";
import LineString from "ol/geom/LineString";
import Point from "ol/geom/Point";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import OlMap from "ol/Map";
import { fromLonLat, toLonLat, transform, transformExtent } from "ol/proj";
import OSM from "ol/source/OSM";
import VectorSource from "ol/source/Vector";
import CircleStyle from "ol/style/Circle";
import Fill from "ol/style/Fill";
import Stroke from "ol/style/Stroke";
import Style from "ol/style/Style";
import Text from "ol/style/Text";
import View from "ol/View";
import REGION_GROUPS from "~/data/regionGroups.json";
import {
	buildGridLines,
	chooseGridInterval,
	type Datum,
	epsgCode,
	formatCoordinate,
	formatGridLabel,
	getZone,
	PLANE_RECTANGULAR_ZONES,
	registerPlaneRectangularProjections,
} from "~/utils/planeRectangular";

const mapContainer = ref<HTMLDivElement | null>(null);
const popupName = ref<string | null>(null);
const popupPos = ref<[number, number] | null>(null);

const searchQuery = ref("");
const searchCoords = ref<Array<{ name: string; coord: number[] }>>([]);
const searchPopups = ref<Array<{ name: string; pixel: [number, number] }>>([]);
const hasSearched = ref(false);

const visibleLayers = reactive({
	lighthouses: false,
	castles: false,
	dams: false,
});

// 平面直角座標（グリッド＋マウス位置の座標表示）
const planeRect = reactive<{ enabled: boolean; datum: Datum; zone: number }>({
	enabled: false,
	datum: "JGD2011",
	zone: 9,
});
// biome-ignore lint/correctness/noUnusedVariables: used in <template>
const planeRectZones = PLANE_RECTANGULAR_ZONES;
const cursorCoord = ref<{
	lat: string;
	lon: string;
	x: string;
	y: string;
} | null>(null);

type Extent4 = [number, number, number, number];

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
// biome-ignore lint/correctness/noUnusedVariables: used in <template>
const groupedPrefectures = computed(() => {
	const prefMap = new Map(prefectureList.value.map((p) => [p.code, p]));
	return REGION_GROUPS.map(({ label, codes }) => ({
		label,
		codes,
		prefectures: codes
			.map((c) => prefMap.get(c))
			.filter((p): p is { name: string; code: string } => p !== undefined),
	})).filter((g) => g.prefectures.length > 0);
});

// biome-ignore lint/correctness/noUnusedVariables: used in <template>
function regionAllVisible(codes: string[]) {
	return (
		codes.length > 0 && codes.every((c) => visiblePrefCodes.value.includes(c))
	);
}
// biome-ignore lint/correctness/noUnusedVariables: used in <template>
function toggleRegion(codes: string[], checked: boolean) {
	if (checked) {
		const toAdd = codes.filter((c) => !visiblePrefCodes.value.includes(c));
		visiblePrefCodes.value = [...visiblePrefCodes.value, ...toAdd];
	} else {
		visiblePrefCodes.value = visiblePrefCodes.value.filter(
			(c) => !codes.includes(c),
		);
	}
}

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

// 平面直角座標系の適用区域（平面直角座標をオンにしたときに取得する）
const {
	geojson: planeZones,
	loading: loadingPlaneZones,
	error: errorPlaneZones,
	fetchPlaneRectangularZones,
} = usePlaneRectangularZones();

// biome-ignore lint/correctness/noUnusedVariables: used in <template>
const isLoading = computed(
	() =>
		loadingPrefectures.value ||
		loadingLighthouses.value ||
		loadingCastles.value ||
		loadingDams.value ||
		loadingPlaneZones.value,
);
// biome-ignore lint/correctness/noUnusedVariables: used in <template>
const fetchError = computed(
	() =>
		errorPrefectures.value ??
		errorLighthouses.value ??
		errorCastles.value ??
		errorDams.value ??
		errorPlaneZones.value,
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
const gridSource = new VectorSource();
const zoneSource = new VectorSource();

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
let gridLayer: VectorLayer | null = null;
let zoneLayer: VectorLayer | null = null;
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

const gridLineStyle = new Style({
	stroke: new Stroke({ color: "rgba(220, 38, 38, 0.7)", width: 1 }),
});

function gridStyleFn(feature: FeatureLike) {
	const label = feature.get("label") as string | undefined;
	if (!label) return gridLineStyle;
	const axis = feature.get("axis") as "x" | "y";
	return new Style({
		text: new Text({
			text: label,
			font: "11px sans-serif",
			fill: new Fill({ color: "#b91c1c" }),
			stroke: new Stroke({ color: "#ffffff", width: 3 }),
			textAlign: axis === "x" ? "left" : "center",
			textBaseline: axis === "x" ? "middle" : "top",
			offsetX: axis === "x" ? 4 : 0,
			offsetY: axis === "x" ? 0 : 4,
		}),
	});
}

// 中央子午線から離れすぎると横メルカトルが破綻するので、描画範囲を絞る
const GRID_LON_RANGE = 20;
const GRID_LAT_RANGE = 20;

function updateGrid() {
	gridSource.clear();
	if (!map || !planeRect.enabled) return;
	const size = map.getSize();
	if (!size) return;

	const code = epsgCode(planeRect.datum, planeRect.zone);
	const { lat0, lon0 } = getZone(planeRect.zone);
	const viewExtent = map.getView().calculateExtent(size);
	const [w, s, e, n] = transformExtent(
		viewExtent,
		"EPSG:3857",
		"EPSG:4326",
	) as Extent4;
	const west = Math.max(w, lon0 - GRID_LON_RANGE);
	const south = Math.max(s, lat0 - GRID_LAT_RANGE, -80);
	const east = Math.min(e, lon0 + GRID_LON_RANGE);
	const north = Math.min(n, lat0 + GRID_LAT_RANGE, 84);
	if (west >= east || south >= north) return;

	const extent = transformExtent(
		[west, south, east, north],
		"EPSG:4326",
		code,
		16,
	) as Extent4;
	const interval = chooseGridInterval(
		Math.max(extent[2] - extent[0], extent[3] - extent[1]),
	);

	// ラベルは画面の端（南北線は上端、東西線は左端）に置く
	const [vMinX, vMinY, vMaxX, vMaxY] = viewExtent as Extent4;
	const margin = (vMaxX - vMinX) * 0.01;
	const inView = ([x, y]: [number, number]) =>
		x >= vMinX + margin &&
		x <= vMaxX - margin &&
		y >= vMinY + margin &&
		y <= vMaxY - margin;

	const features: Feature[] = [];
	for (const line of buildGridLines(extent, interval, 64)) {
		const coords = line.coords.map(
			(c) => transform(c, code, "EPSG:3857") as [number, number],
		);
		features.push(new Feature({ geometry: new LineString(coords) }));

		const visible = coords.filter(inView);
		if (visible.length === 0) continue;
		const anchor = visible.reduce((a, b) =>
			line.axis === "x" ? (b[0] < a[0] ? b : a) : b[1] > a[1] ? b : a,
		);
		features.push(
			new Feature({
				geometry: new Point(anchor),
				label: formatGridLabel(line, interval),
				axis: line.axis,
			}),
		);
	}
	gridSource.addFeatures(features);
}

function updateCursorCoord(coordinate: number[]) {
	if (!planeRect.enabled) {
		cursorCoord.value = null;
		return;
	}
	const [lon, lat] = toLonLat(coordinate) as [number, number];
	const [e, n] = transform(
		coordinate,
		"EPSG:3857",
		epsgCode(planeRect.datum, planeRect.zone),
	) as [number, number];
	// 平面直角座標系では北方向が X、東方向が Y
	cursorCoord.value = {
		lat: lat.toFixed(6),
		lon: lon.toFixed(6),
		x: formatCoordinate(n),
		y: formatCoordinate(e),
	};
}

// 選択中の系の区域だけを塗る
const zoneStyle = new Style({
	stroke: new Stroke({ color: "#dc2626", width: 2 }),
	fill: new Fill({ color: "rgba(220, 38, 38, 0.15)" }),
});

function zoneStyleFn(feature: FeatureLike) {
	return feature.get("zone") === planeRect.zone ? zoneStyle : [];
}

watch(planeZones, (data) => {
	zoneSource.clear();
	if (data) {
		zoneSource.addFeatures(
			geoJsonFormat.readFeatures(data, { featureProjection: "EPSG:3857" }),
		);
		fitToZone();
	}
});

// 選択中の系の区域が収まるようにズームする（右上のパネルの分だけ右側を空ける）
function fitToZone() {
	if (!map || !planeRect.enabled) return;
	const extent = createEmpty();
	for (const f of zoneSource.getFeatures()) {
		if (f.get("zone") !== planeRect.zone) continue;
		const geom = f.getGeometry();
		if (geom) extend(extent, geom.getExtent());
	}
	if (!Number.isFinite(extent[0])) return;
	// biome-ignore lint/suspicious/noFocusedTests: ol/View#fit であり Vitest の fit ではない
	map.getView().fit(extent, {
		padding: [60, 300, 60, 60],
		duration: 600,
		maxZoom: 10,
	});
}

watch(
	() => [planeRect.enabled, planeRect.datum, planeRect.zone],
	() => {
		gridLayer?.setVisible(planeRect.enabled);
		zoneLayer?.setVisible(planeRect.enabled);
		zoneSource.changed();
		updateGrid();
		if (!planeRect.enabled) cursorCoord.value = null;
	},
);

watch(
	() => [planeRect.enabled, planeRect.zone],
	() => {
		if (!planeRect.enabled) return;
		if (planeZones.value) fitToZone();
		else fetchPlaneRectangularZones();
	},
);

// biome-ignore lint/correctness/noUnusedVariables: used in <template>
function clearCursorCoord() {
	cursorCoord.value = null;
}

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

	const first = results[0];
	if (first) {
		map
			?.getView()
			.animate({ center: first.coord, duration: 500 }, updateSearchPixels);
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

	registerPlaneRectangularProjections();

	prefectureLayer = new VectorLayer({
		source: prefectureSource,
		style: prefectureStyleFn,
	});
	lighthouseLayer = new VectorLayer({
		source: lighthouseSource,
		style: lighthouseStyleFn,
		visible: visibleLayers.lighthouses,
	});
	castleLayer = new VectorLayer({
		source: castleSource,
		style: castleStyleFn,
		visible: visibleLayers.castles,
	});
	damLayer = new VectorLayer({
		source: damSource,
		style: damStyleFn,
		visible: visibleLayers.dams,
	});
	zoneLayer = new VectorLayer({
		source: zoneSource,
		style: zoneStyleFn,
		visible: planeRect.enabled,
	});
	gridLayer = new VectorLayer({
		source: gridSource,
		style: gridStyleFn,
		visible: planeRect.enabled,
	});
	const pointLayers = [lighthouseLayer, castleLayer, damLayer];
	const isPointLayer = (layer: unknown) =>
		pointLayers.includes(layer as VectorLayer);

	map = new OlMap({
		target: mapContainer.value,
		layers: [
			new TileLayer({ source: new OSM() }),
			prefectureLayer,
			zoneLayer,
			gridLayer,
			lighthouseLayer,
			castleLayer,
			damLayer,
		],
		view: new View({
			center: fromLonLat([137.0, 37.0]),
			zoom: 5,
		}),
	});

	map.on("moveend", () => {
		updateSearchPixels();
		updateGrid();
	});

	map.on("click", (e) => {
		const feature = map?.forEachFeatureAtPixel(e.pixel, (f) => f, {
			layerFilter: isPointLayer,
		});
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
			mapContainer.value.style.cursor = map?.hasFeatureAtPixel(e.pixel, {
				layerFilter: isPointLayer,
			})
				? "pointer"
				: "";
		}
		updateCursorCoord(e.coordinate);
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
    <div ref="mapContainer" class="w-full h-full" @mouseleave="clearCursorCoord" />

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
        <div class="mt-1 max-h-52 overflow-y-auto flex flex-col gap-0.5">
          <template v-for="group in groupedPrefectures" :key="group.label">
            <!-- 地域ヘッダー -->
            <label class="mt-1 flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-gray-600">
              <input
                :checked="regionAllVisible(group.codes)"
                class="accent-indigo-500"
                type="checkbox"
                @change="(e) => toggleRegion(group.codes, (e.target as HTMLInputElement).checked)"
              />
              {{ group.label }}
              <span class="font-normal text-gray-400">
                ({{ group.prefectures.filter((p) => visiblePrefCodes.includes(p.code)).length }}/{{ group.prefectures.length }})
              </span>
            </label>
            <!-- 都道府県 -->
            <label
              v-for="pref in group.prefectures"
              :key="pref.code"
              class="flex cursor-pointer items-center gap-1.5 pl-4 text-xs"
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
          </template>
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

      <!-- 平面直角座標 -->
      <div class="mt-1.5">
        <label class="flex cursor-pointer items-center gap-2 text-sm">
          <input v-model="planeRect.enabled" class="accent-red-600" type="checkbox" />
          <span class="size-3 border-2 border-red-600 shrink-0" />
          平面直角座標
        </label>
        <div v-if="planeRect.enabled" class="mt-1 flex flex-col gap-1 pl-5">
          <select
            v-model="planeRect.datum"
            aria-label="測地系"
            class="rounded border border-gray-300 px-1 py-0.5 text-xs"
          >
            <option value="JGD2011">JGD2011</option>
            <option value="JGD2000">JGD2000</option>
          </select>
          <select
            v-model.number="planeRect.zone"
            aria-label="系"
            class="max-w-56 rounded border border-gray-300 px-1 py-0.5 text-xs"
          >
            <option v-for="z in planeRectZones" :key="z.zone" :value="z.zone">
              {{ z.roman }}系（{{ z.area }}）
            </option>
          </select>
        </div>
      </div>
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

    <!-- マウス位置の平面直角座標（左下の「MLB 球場マップ →」のリンク（pages/index.vue）と重ならないよう、その上に置く） -->
    <div
      v-if="planeRect.enabled && cursorCoord"
      class="absolute bottom-16 left-4 rounded-lg bg-white/90 px-3 py-2 font-mono text-xs shadow-md"
    >
      <p class="mb-1 font-sans font-bold text-gray-700">
        {{ planeRect.datum }} 平面直角座標 {{ planeRectZones[planeRect.zone - 1]?.roman }}系
      </p>
      <p>X: {{ cursorCoord.x }} m</p>
      <p>Y: {{ cursorCoord.y }} m</p>
      <p class="mt-1 text-gray-500">{{ cursorCoord.lat }}, {{ cursorCoord.lon }}</p>
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
