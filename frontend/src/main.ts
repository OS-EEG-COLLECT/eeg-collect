import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import vuetify from "./plugins/vuetify";
import { loadFonts } from "./plugins/webfontloader";
import store from "@/store";
import { injectionKey } from "@/store/utils/storeHelpers";

loadFonts();

createApp(App).use(router).use(vuetify).use(store, injectionKey).mount("#app");