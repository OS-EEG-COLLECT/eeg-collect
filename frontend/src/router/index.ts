import {
  createRouter,
  createWebHistory,
  LocationQuery,
  NavigationGuardNext,
  RouteLocationNormalized,
} from "vue-router";

import SetupDevicePage from "@/pages/setupDevicePage/SetupDevicePage.vue";
import OptimizeSignalAndImpedancePage from "@/pages/optimizeSignalAndImpedancePage/OptimizeSignalAndImpedancePage.vue";
import RecordingPage from "@/pages/recordingPage/RecordingPage.vue";
import FinishPage from "@/pages/FinishPage.vue";
import { ROUTES } from "@/utils/routes";
import DemoPage from "@/features/eeg-demo/DemoPage.vue";
import SandBox from "@/features/eeg-demo/SandboxPage.vue";

let validNavigation = false;

const routes = [
  {
    path: "/",
    redirect: "start",
  },
  {
    path: "/setup-device",
    component: SetupDevicePage,
  },
  {
    path: "/optimize-signal",
    component: OptimizeSignalAndImpedancePage,
    meta: { requiresRef: true },
  },
  {
    path: "/recording",
    component: RecordingPage,
    meta: { requiresRef: true },
  },
  {
    path: "/finish",
    component: FinishPage,
  },
  {
    path: "/demo",
    component: DemoPage,
    meta: { requiresRef: true },
  },
  {
    path: "/sandbox",
    component: SandBox,
    meta: { requiresRef: true },
  }
];

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes,
});

router.beforeEach((to, from, next) => {
  if (to.meta.requiresRef && !validNavigation) {
    next({ path: ROUTES.SETUP_DEVICE, query: to.query });

    return;
  }

  // Allow Access
  validNavigation = false;
  next();
});

export const navigateToRestricted = (path: string, query?: LocationQuery) => {
  validNavigation = true;
  router.push({ path: path, query: query });
};

export default router;
