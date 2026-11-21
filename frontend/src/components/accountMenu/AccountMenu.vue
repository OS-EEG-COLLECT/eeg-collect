<script setup lang="ts">
import { ref, computed, type Component } from "vue";
import { useRouter } from "vue-router";
import {
  PhCaretDown,
  PhFolders,
  PhKey,
  PhUsers,
  PhSignOut,
} from "@phosphor-icons/vue";
import { clearLogin, getCurrentUser } from "@/utils/auth";
import ChangePasswordDialog from "@/components/accountMenu/ChangePasswordDialog.vue";

const router = useRouter();
const currentUser = getCurrentUser();
const displayName = currentUser.username || "Account";

const isChangePasswordOpen = ref(false);

// "Max Mustermann" -> "MM", "max.mustermann@kit.edu" -> "MM", "admin" -> "AD"
const initials = computed(() => {
  const name = currentUser.username.split("@")[0];
  const parts = name.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0] || "?").slice(0, 2).toUpperCase();
});

const handleLogout = () => {
  clearLogin();
  router.push("/login");
};

// ---- MENU CONFIG ----
// New menu entries only need to be added to this list.
// "visible: false" hides an entry, dividers next to hidden entries are dropped automatically.
type AccountMenuEntry =
  | {
      type: "item";
      key: string;
      title: string;
      icon: Component;
      action: () => void;
      visible?: boolean;
    }
  | { type: "divider"; key: string };

const menuEntries: AccountMenuEntry[] = [
  {
    type: "item",
    key: "your-studies",
    title: "Your studies",
    icon: PhFolders,
    action: () => router.push("/dashboard"),
  },
  {
    type: "item",
    key: "change-password",
    title: "Change password",
    icon: PhKey,
    action: () => {
      isChangePasswordOpen.value = true;
    },
  },
  {
    type: "item",
    key: "manage-users",
    title: "Manage users",
    icon: PhUsers,
    action: () => router.push("/users"),
    visible: currentUser.isAdmin,
  },
  { type: "divider", key: "divider-logout" },
  {
    type: "item",
    key: "logout",
    title: "Log out",
    icon: PhSignOut,
    action: handleLogout,
  },
];

const visibleMenuEntries = computed(() => {
  const entries = menuEntries.filter(
    (entry) => entry.type === "divider" || entry.visible !== false,
  );
  // drop dividers at the start/end and directly after another divider
  return entries.filter(
    (entry, index) =>
      entry.type !== "divider" ||
      (index > 0 &&
        index < entries.length - 1 &&
        entries[index - 1].type !== "divider"),
  );
});
</script>

<template>
  <v-menu location="bottom end" offset="8">
    <template #activator="{ props: menuProps }">
      <VBtn
        v-bind="menuProps"
        class="account-button"
        variant="text"
        :height="48"
        :aria-label="`Account menu for ${displayName}`"
      >
        <span class="account-avatar" aria-hidden="true">{{ initials }}</span>
        <span class="account-name">{{ displayName }}</span>
        <PhCaretDown :size="16" class="ml-2" aria-hidden="true" />
      </VBtn>
    </template>

    <v-list density="compact" min-width="220" role="menu" class="py-1">
      <template v-for="entry in visibleMenuEntries" :key="entry.key">
        <v-divider v-if="entry.type === 'divider'" class="my-1"></v-divider>
        <v-list-item v-else role="menuitem" @click="entry.action">
          <template #prepend>
            <component :is="entry.icon" :size="18" class="mr-3" />
          </template>
          <v-list-item-title>{{ entry.title }}</v-list-item-title>
        </v-list-item>
      </template>
    </v-list>
  </v-menu>

  <ChangePasswordDialog v-model="isChangePasswordOpen" />
</template>

<style scoped>
.account-button {
  min-width: 0 !important;
  flex-shrink: 0;
  color: #2c3e50 !important;
  background-color: transparent !important;
  border-color: transparent !important;
  padding: 0 8px !important;
}
.account-button:hover {
  background-color: #f1f5f4 !important;
}

/* White on #00594C = 8.3:1 */
.account-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background-color: #00594c;
  color: #ffffff;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.account-name {
  margin-left: 10px;
  font-weight: 600;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Narrow screens: avatar and chevron only (aria-label still has the name) */
@media (max-width: 600px) {
  .account-name {
    display: none;
  }
}
</style>
