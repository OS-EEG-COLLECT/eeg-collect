import {
  createRouter,
  createWebHistory,
  LocationQuery,
  NavigationGuardNext,
  RouteLocationNormalized,
} from "vue-router";

import LoginPage from "@/pages/loginPage/LoginPage.vue";
import DashboardPage from "@/pages/dashboardPage/DashboardPage.vue";
import SetupDevicePage from "@/pages/setupDevicePage/SetupDevicePage.vue";
import OptimizeSignalAndImpedancePage from "@/pages/optimizeSignalAndImpedancePage/OptimizeSignalAndImpedancePage.vue";
import RecordingPage from "@/pages/recordingPage/RecordingPage.vue";
import FinishPage from "@/pages/FinishPage.vue";
import { ROUTES } from "@/utils/routes";

let validNavigation = false;

const routes = [
  {
    path: "/",
    redirect: "login",
  },
  // Part 1 for Researchers (IAM and Dashboard)
  {
    path: "/login",
    component: LoginPage,
    meta: { requiresAuth: false},
  },
  {
    path: "/dashboard",
    component: DashboardPage,
    meta: { requiresAuth: true},
  },
  // Part 2 for sessions of a study
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
];

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes,
});

router.beforeEach((to, from, next) => {
  const isAuthenticated = !!localStorage.getItem("user_token");

  if (to.meta.requiresAuth && !isAuthenticated) {
    next({path: "/login"});

    return;
  }

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
