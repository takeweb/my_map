<script setup lang="ts">
import { boundingExtent } from "ol/extent";
import type { FeatureLike } from "ol/Feature";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import OlMap from "ol/Map";
import Overlay from "ol/Overlay";
import { fromLonLat } from "ol/proj";
import OSM from "ol/source/OSM";
import VectorSource from "ol/source/Vector";
import Icon from "ol/style/Icon";
import Style from "ol/style/Style";
import View from "ol/View";
import {
	// biome-ignore lint/correctness/noUnusedImports: used in <template>
	DIVISIONS,
	findStadiumFilter,
	LEAGUES,
	type League,
	STADIUM_FILTERS,
	STADIUMS,
	type Stadium,
	teamLogoUrl,
} from "~/utils/mlbStadiums";

const mapContainer = ref<HTMLDivElement | null>(null);
const popupElement = ref<HTMLDivElement | null>(null);
const selectedStadium = ref<Stadium | null>(null);
const logoError = ref(false);

const selectedFilterKey = ref("all");
const selectedFilter = computed(() =>
	findStadiumFilter(selectedFilterKey.value),
);
// biome-ignore lint/correctness/noUnusedVariables: used in <template>
const visibleCount = computed(
	() => STADIUMS.filter(selectedFilter.value.match).length,
);

// biome-ignore lint/correctness/noUnusedVariables: used in <template>
const topFilters = STADIUM_FILTERS.filter((f) => !f.group);
// biome-ignore lint/correctness/noUnusedVariables: used in <template>
const groupedFilters = [
	...new Set(STADIUM_FILTERS.map((f) => f.group).filter((g) => g)),
].map((group) => ({
	label: group as string,
	filters: STADIUM_FILTERS.filter((f) => f.group === group),
}));

// ロゴ読み込み前・読み込み失敗時のアイコン（ピン + 野球のダイヤモンド）
function stadiumIconSvg(color: string) {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="46" viewBox="0 0 36 46">
	<path d="M18 45 C18 45 2 27.5 2 17 A16 16 0 0 1 34 17 C34 27.5 18 45 18 45 Z" fill="${color}" stroke="#fff" stroke-width="2"/>
	<circle cx="18" cy="17" r="11.5" fill="#2e8b3e"/>
	<path d="M18 27.5 L7.5 17 A11.5 11.5 0 0 1 28.5 17 Z" fill="#c68a4a"/>
	<path d="M18 24 L11.5 17.5 L18 11 L24.5 17.5 Z" fill="#3fa34d" stroke="#fff" stroke-width="1.2"/>
	<rect x="16.8" y="22.8" width="2.4" height="2.4" fill="#fff"/>
	<rect x="23.3" y="16.3" width="2.4" height="2.4" fill="#fff" transform="rotate(45 24.5 17.5)"/>
	<rect x="16.8" y="9.8" width="2.4" height="2.4" fill="#fff" transform="rotate(45 18 11)"/>
	<rect x="10.3" y="16.3" width="2.4" height="2.4" fill="#fff" transform="rotate(45 11.5 17.5)"/>
	<circle cx="18" cy="17.6" r="1.3" fill="#c68a4a"/>
</svg>`;
}

// 球団ロゴのピン。ロゴは縦横比がチームごとに異なるため、
// SVG を data URI で埋め込み preserveAspectRatio で白い円の中に収める
// （画像として読み込む SVG は外部 URL を参照できないため埋め込みが必要）
function logoPinSvg(color: string, logoSvg: string) {
	const logo = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(logoSvg)}`;
	return `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="56" viewBox="0 0 44 56">
	<path d="M22 55 C22 55 2 34 2 21 A20 20 0 0 1 42 21 C42 34 22 55 22 55 Z" fill="${color}" stroke="#fff" stroke-width="2"/>
	<circle cx="22" cy="21" r="16" fill="#fff"/>
	<image href="${logo}" x="10" y="9" width="24" height="24" preserveAspectRatio="xMidYMid meet"/>
</svg>`;
}

function svgIconStyle(svg: string, width: number, height: number) {
	return new Style({
		image: new Icon({
			src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
			width,
			height,
			anchor: [0.5, 1],
		}),
	});
}

const fallbackStyles = Object.fromEntries(
	(Object.keys(LEAGUES) as League[]).map((league) => [
		league,
		svgIconStyle(stadiumIconSvg(LEAGUES[league].color), 36, 46),
	]),
) as Record<League, Style>;

// チーム ID → ロゴピンのスタイル（読み込みに成功したものだけ入る）
const logoStyles = new Map<number, Style>();

async function loadLogoStyle(stadium: Stadium) {
	try {
		const res = await fetch(teamLogoUrl(stadium.id));
		if (!res.ok) return;
		const logoSvg = await res.text();
		logoStyles.set(
			stadium.id,
			svgIconStyle(logoPinSvg(LEAGUES[stadium.league].color, logoSvg), 44, 56),
		);
	} catch {
		// 読み込めない場合はダイヤモンドのアイコンのまま表示する
	}
}

function stadiumStyleFn(feature: FeatureLike) {
	const stadium = feature.get("stadium") as Stadium;
	if (!selectedFilter.value.match(stadium)) return [];
	return logoStyles.get(stadium.id) ?? fallbackStyles[stadium.league];
}

const stadiumSource = new VectorSource({
	features: STADIUMS.map(
		(stadium) =>
			new Feature({
				geometry: new Point(fromLonLat([stadium.lng, stadium.lat])),
				stadium,
			}),
	),
});

let map: OlMap | null = null;
let popupOverlay: Overlay | null = null;

function closePopup() {
	selectedStadium.value = null;
	popupOverlay?.setPosition(undefined);
}

function fitToVisible(duration = 0) {
	const coords = stadiumSource
		.getFeatures()
		.filter((f) => selectedFilter.value.match(f.get("stadium") as Stadium))
		.map((f) => (f.getGeometry() as Point).getCoordinates());
	if (!map || coords.length === 0) return;
	// biome-ignore lint/suspicious/noFocusedTests: ol/View#fit であり Vitest の fit ではない
	map.getView().fit(boundingExtent(coords), {
		// 右上の表示切り替えパネルと重ならないよう右側を、ピンの高さ分だけ上側を広めに空ける
		padding: [90, 280, 60, 60],
		maxZoom: 7,
		duration,
	});
}

watch(selectedFilterKey, () => {
	closePopup();
	stadiumSource.changed();
	fitToVisible(500);
});

onMounted(() => {
	if (!mapContainer.value || !popupElement.value) return;

	popupOverlay = new Overlay({
		element: popupElement.value,
		positioning: "bottom-center",
		offset: [0, -60],
		autoPan: { animation: { duration: 250 } },
	});

	map = new OlMap({
		target: mapContainer.value,
		layers: [
			new TileLayer({ source: new OSM() }),
			new VectorLayer({ source: stadiumSource, style: stadiumStyleFn }),
		],
		overlays: [popupOverlay],
		view: new View({
			center: fromLonLat([-96.0, 38.5]),
			zoom: 4,
		}),
	});
	fitToVisible();

	map.on("click", async (e) => {
		const feature = map?.forEachFeatureAtPixel(e.pixel, (f) => f);
		if (!feature) {
			closePopup();
			return;
		}
		selectedStadium.value = feature.get("stadium") as Stadium;
		logoError.value = false;
		// ポップアップの中身が描画されてから位置を決めないと autoPan が効かない
		await nextTick();
		popupOverlay?.setPosition(
			(feature.getGeometry() as Point).getCoordinates(),
		);
	});

	Promise.all(STADIUMS.map(loadLogoStyle)).then(() => stadiumSource.changed());

	map.on("pointermove", (e) => {
		if (mapContainer.value) {
			mapContainer.value.style.cursor = map?.hasFeatureAtPixel(e.pixel)
				? "pointer"
				: "";
		}
	});
});

onUnmounted(() => {
	map?.setTarget(undefined);
	map = null;
});
</script>

<template>
  <div class="relative w-full h-screen">
    <div ref="mapContainer" class="w-full h-full" />

    <!-- 表示切り替え -->
    <div class="absolute right-4 top-4 rounded-lg bg-white/90 p-3 shadow-md">
      <p class="mb-2 text-xs font-bold text-gray-700">
        MLB 球場（{{ visibleCount }}）
      </p>
      <label
        v-for="filter in topFilters"
        :key="filter.key"
        class="mt-1.5 flex cursor-pointer items-center gap-2 text-sm"
      >
        <input
          v-model="selectedFilterKey"
          class="accent-gray-700"
          name="stadium-filter"
          type="radio"
          :value="filter.key"
        />
        <span
          v-if="filter.league"
          class="size-3 rounded-full"
          :style="{ backgroundColor: LEAGUES[filter.league].color }"
        />
        {{ filter.label }}
      </label>
      <div
        v-for="group in groupedFilters"
        :key="group.label"
        class="mt-2 border-t border-gray-200 pt-2"
      >
        <p class="text-xs text-gray-500">{{ group.label }}</p>
        <div class="mt-1 flex gap-3">
          <label
            v-for="filter in group.filters"
            :key="filter.key"
            class="flex cursor-pointer items-center gap-1 text-sm"
          >
            <input
              v-model="selectedFilterKey"
              class="accent-gray-700"
              name="stadium-filter"
              type="radio"
              :value="filter.key"
            />
            {{ filter.label }}
          </label>
        </div>
      </div>
    </div>

    <!-- クリックポップアップ（OpenLayers の Overlay で球場位置に固定） -->
    <div ref="popupElement">
      <div
        v-if="selectedStadium"
        class="relative w-72 rounded-lg bg-white p-3 text-sm shadow-lg"
      >
        <button
          aria-label="閉じる"
          class="absolute right-2 top-1 text-lg leading-none text-gray-400 hover:text-gray-600"
          type="button"
          @click="closePopup"
        >×</button>
        <div
          class="flex items-center gap-2.5 border-b-[3px] pb-2"
          :style="{ borderColor: LEAGUES[selectedStadium.league].color }"
        >
          <img
            :alt="`${selectedStadium.teamEn} ロゴ`"
            class="size-12 shrink-0 object-contain"
            :class="{ invisible: logoError }"
            :src="teamLogoUrl(selectedStadium.id)"
            @error="logoError = true"
          />
          <div>
            <p class="font-bold leading-tight">{{ selectedStadium.team }}</p>
            <p class="text-xs text-gray-500">{{ selectedStadium.teamEn }}</p>
          </div>
        </div>
        <dl class="my-2 grid grid-cols-[auto_1fr] gap-x-2.5 gap-y-1.5 text-[13px]">
          <dt class="font-bold text-gray-500">球場</dt>
          <dd>
            {{ selectedStadium.stadium }}
            <span class="block text-xs text-gray-500">{{ selectedStadium.stadiumEn }}</span>
          </dd>
          <dt class="font-bold text-gray-500">都市</dt>
          <dd>
            {{ selectedStadium.city }}
            <span class="block text-xs text-gray-500">{{ selectedStadium.cityEn }}</span>
          </dd>
        </dl>
        <p class="text-xs text-gray-600">
          <span
            class="mr-1 rounded px-1.5 py-px text-[11px] font-bold text-white"
            :style="{ backgroundColor: LEAGUES[selectedStadium.league].color }"
          >{{ selectedStadium.league }}</span>
          {{ LEAGUES[selectedStadium.league].name }} {{ DIVISIONS[selectedStadium.division] }}
        </p>
      </div>
    </div>
  </div>
</template>
