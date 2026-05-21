import tailwindcss from "@tailwindcss/vite";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
	compatibilityDate: "2025-07-15",
	devtools: { enabled: true },
	ssr: false,
	css: ["ol/ol.css", "~/assets/css/main.css"],
	vite: {
		plugins: [tailwindcss()],
	},
	routeRules: {
		"/api/overpass": { proxy: "https://overpass-api.de/api/interpreter" },
	},
});
