import { defineVitestConfig } from "@nuxt/test-utils/config";

export default defineVitestConfig({
	test: {
		environment: "nuxt",
		environmentOptions: {
			nuxt: {
				domEnvironment: "happy-dom",
			},
		},
		// Node 25 以降は組み込みの localStorage がグローバルに存在し、
		// happy-dom の localStorage が適用されず undefined になるため無効化する
		execArgv: ["--no-experimental-webstorage"],
	},
});
