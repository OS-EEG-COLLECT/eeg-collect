<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import {
  PhEye,
  PhEyeSlash,
  PhTrash,
  PhUserPlus,
  PhWarningCircle,
} from "@phosphor-icons/vue";
import ResearcherHeader from "@/components/ResearcherHeader.vue";
import { URLs } from "@/utils/helpers";
import { getAuthHeaders, getCurrentUser } from "@/utils/auth";
import { useToast } from "@/utils/toast";

// User management (admin only). The backend endpoints check admin rights as well.

// ---- TYPES ----
interface ManagedUser {
  id: number;
  username: string | null;
  isAdmin: boolean;
}

// ---- STATE ----
const currentUser = getCurrentUser();
const { showToast } = useToast();

const isLoadingUsers = ref(false);
const users = ref<ManagedUser[]>([]);

// Add User dialog State
const isAddUserModalOpen = ref(false);
const isCreatingUser = ref(false);
const newUsername = ref("");
const newUserPassword = ref("");
// Second password field, to catch typos
const newUserPasswordConfirm = ref("");
// Eye button: shows both password fields as plain text
const showNewUserPasswords = ref(false);
const newUserIsAdmin = ref(false);

// Only show the mismatch message once something was typed into the second field
const newUserPasswordsMismatch = computed(
  () =>
    newUserPasswordConfirm.value.length > 0 &&
    newUserPasswordConfirm.value !== newUserPassword.value,
);

const canCreateUser = computed(
  () =>
    newUsername.value.trim().length > 0 &&
    newUserPassword.value.trim().length > 0 &&
    newUserPasswordConfirm.value === newUserPassword.value,
);

// Delete User dialog State
const isDeleteUserModalOpen = ref(false);
const isDeletingUser = ref(false);
const userToDelete = ref<ManagedUser | null>(null);
const deleteConfirmationUsername = ref("");

const errorModal = ref({
  isOpen: false,
  title: "",
  message: "",
});

// ---- METHODS ----

const showError = (title: string, message: string) => {
  errorModal.value = { isOpen: true, title, message };
};

const isOwnAccount = (user: ManagedUser) => String(user.id) === currentUser.id;

const fetchUsers = async () => {
  isLoadingUsers.value = true;
  try {
    const response = await fetch(`${URLs.API_URL}/users/list`, {
      headers: getAuthHeaders(),
    });
    if (response.ok) {
      users.value = await response.json();
    } else if (response.status === 403) {
      showError("No access", "Only admins can manage users.");
    } else {
      showError("Error", "Users could not be loaded.");
    }
  } catch (error) {
    showError("Connection Error", "Server is not reachable.");
  } finally {
    isLoadingUsers.value = false;
  }
};

const resetCreateUserForm = () => {
  newUsername.value = "";
  newUserPassword.value = "";
  newUserPasswordConfirm.value = "";
  showNewUserPasswords.value = false;
  newUserIsAdmin.value = false;
};

const openAddUserModal = () => {
  resetCreateUserForm();
  isAddUserModalOpen.value = true;
};

const closeAddUserModal = () => {
  isAddUserModalOpen.value = false;
  resetCreateUserForm();
};

const handleCreateUser = async () => {
  if (!canCreateUser.value) return;

  isCreatingUser.value = true;
  try {
    const response = await fetch(`${URLs.API_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({
        username: newUsername.value,
        password: newUserPassword.value,
        isAdmin: newUserIsAdmin.value,
      }),
    });

    if (response.ok) {
      closeAddUserModal();
      showToast("User added");
      await fetchUsers();
    } else {
      const data = await response.json().catch(() => null);
      showError("Error", data?.message || "User could not be created.");
    }
  } catch (error) {
    showError("Connection Error", "Server is not reachable.");
  } finally {
    isCreatingUser.value = false;
  }
};

const handleToggleAdmin = async (user: ManagedUser, makeAdmin: boolean) => {
  try {
    const response = await fetch(`${URLs.API_URL}/users/${user.id}/admin`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ isAdmin: makeAdmin }),
    });

    if (response.ok) {
      user.isAdmin = makeAdmin;
    } else {
      const data = await response.json().catch(() => null);
      showError("Error", data?.message || "Admin rights could not be changed.");
    }
  } catch (error) {
    showError("Connection Error", "Server is not reachable.");
  }
};

const openDeleteUserModal = (user: ManagedUser) => {
  userToDelete.value = user;
  isDeleteUserModalOpen.value = true;
};

const closeDeleteUserModal = () => {
  isDeleteUserModalOpen.value = false;
  userToDelete.value = null;
  deleteConfirmationUsername.value = "";
};

const handleDeleteUser = async () => {
  if (!userToDelete.value) return;
  if (deleteConfirmationUsername.value !== userToDelete.value.username) return;

  isDeletingUser.value = true;
  try {
    const response = await fetch(
      `${URLs.API_URL}/users/${userToDelete.value.id}/delete`,
      { method: "DELETE", headers: getAuthHeaders() },
    );

    if (response.ok) {
      users.value = users.value.filter((u) => u.id !== userToDelete.value!.id);
      closeDeleteUserModal();
      showToast("User deleted");
    } else {
      const data = await response.json().catch(() => null);
      showError("Error", data?.message || "User could not be deleted.");
    }
  } catch (error) {
    showError("Connection Error", "Server is not reachable.");
  } finally {
    isDeletingUser.value = false;
  }
};

onMounted(() => {
  fetchUsers();
});
</script>

<template>
  <div class="users-page">
    <ResearcherHeader
      title="Manage users"
      subtitle="Add researchers, grant admin rights or remove accounts."
    />

    <div class="users-content">
      <div class="d-flex justify-space-between align-center mb-6">
        <h3 style="color: #333; font-weight: 600;">Users</h3>
        <VBtn class="btn-primary" :prepend-icon="PhUserPlus" @click="openAddUserModal">
          Add user
        </VBtn>
      </div>

      <div v-if="isLoadingUsers" class="text-center py-8">
        <v-progress-circular indeterminate color="#00594C"></v-progress-circular>
      </div>

      <div v-else>
        <v-card
          v-for="user in users"
          :key="user.id"
          class="mb-3 pa-4 user-card"
          variant="outlined"
        >
          <div class="d-flex justify-space-between align-center" style="gap: 16px;">
            <div style="min-width: 0;">
              <span style="font-weight: 600; color: #2c3e50; font-size: 16px;">
                {{ user.username }}
              </span>
              <v-chip v-if="isOwnAccount(user)" size="x-small" variant="tonal" class="ml-2">
                You
              </v-chip>
            </div>

            <div class="d-flex align-center flex-shrink-0" style="gap: 12px;">
              <v-switch
                :model-value="user.isAdmin"
                label="Admin"
                color="#00594C"
                density="compact"
                hide-details
                inset
                :disabled="isOwnAccount(user)"
                @update:model-value="(val: boolean | null) => handleToggleAdmin(user, !!val)"
              ></v-switch>
              <!-- same style as the "Delete" button on the study cards -->
              <VBtn
                class="btn-secondary btn-danger"
                variant="outlined"
                :prepend-icon="PhTrash"
                :disabled="isOwnAccount(user)"
                :aria-label="`Delete user ${user.username}`"
                @click="openDeleteUserModal(user)"
              >
                Delete
              </VBtn>
            </div>
          </div>
        </v-card>
      </div>
    </div>
  </div>

  <!-- Modal: Add User -->
  <v-dialog v-model="isAddUserModalOpen" max-width="500px" persistent>
    <v-card style="padding: 24px; border-radius: 12px;">
      <v-card-title class="px-0 pt-0 mb-2" style="font-weight: 600;">
        Add user
      </v-card-title>

      <v-card-text class="px-0 py-2">
        <v-text-field
          v-model="newUsername"
          label="Username *"
          variant="outlined"
          density="comfortable"
          class="mb-4"
          hide-details="auto"
        ></v-text-field>

        <!-- Both password fields share one column, so they always have the same width.
             The eye button sits next to the first field in its own column. -->
        <div class="d-flex align-start mb-4" style="gap: 8px;">
          <div class="flex-grow-1" style="min-width: 0;">
            <v-text-field
              v-model="newUserPassword"
              label="Password *"
              :type="showNewUserPasswords ? 'text' : 'password'"
              autocomplete="new-password"
              variant="outlined"
              density="comfortable"
              class="mb-4"
              hide-details="auto"
            ></v-text-field>

            <v-text-field
              v-model="newUserPasswordConfirm"
              label="Repeat password *"
              :type="showNewUserPasswords ? 'text' : 'password'"
              autocomplete="new-password"
              variant="outlined"
              density="comfortable"
              hide-details="auto"
              :error-messages="newUserPasswordsMismatch ? ['Passwords do not match'] : []"
              @keyup.enter="handleCreateUser"
            ></v-text-field>
          </div>

          <VBtn
            class="flex-shrink-0"
            variant="text"
            color="#737373"
            icon
            :width="48"
            :height="48"
            :aria-label="showNewUserPasswords ? 'Hide passwords' : 'Show passwords'"
            @click="showNewUserPasswords = !showNewUserPasswords"
          >
            <PhEyeSlash v-if="showNewUserPasswords" :size="20" />
            <PhEye v-else :size="20" />
          </VBtn>
        </div>

        <v-checkbox
          v-model="newUserIsAdmin"
          label="Grant admin rights"
          density="comfortable"
          hide-details="auto"
        ></v-checkbox>
      </v-card-text>

      <v-card-actions class="px-0 pb-0 mt-4" style="justify-content: end;">
        <VBtn variant="text" color="#737373" @click="closeAddUserModal">
          Cancel
        </VBtn>
        <VBtn
          color="#00594C"
          style="background-color: #00594C; color: white;"
          :disabled="!canCreateUser"
          :loading="isCreatingUser"
          @click="handleCreateUser"
        >
          Add user
        </VBtn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- Modal: Delete User -->
  <v-dialog v-model="isDeleteUserModalOpen" max-width="500px">
    <v-card style="padding: 24px; border-radius: 12px;">
      <v-card-title class="px-0 pt-0 mb-2" style="font-weight: 600;">
        Delete User
      </v-card-title>

      <v-card-text class="px-0 py-2">
        Do you really want to delete the user "{{ userToDelete?.username }}"?
        All of their studies and sessions will be deleted as well.
        This action cannot be undone.

        <v-text-field
          v-model="deleteConfirmationUsername"
          :label="`Type &quot;${userToDelete?.username}&quot; to confirm`"
          variant="outlined"
          density="comfortable"
          class="mt-4"
          hide-details="auto"
          @keyup.enter="handleDeleteUser"
        ></v-text-field>
      </v-card-text>

      <v-card-actions class="px-0 pb-0 mt-4" style="justify-content: end;">
        <VBtn variant="text" color="#737373" @click="closeDeleteUserModal">
          Cancel
        </VBtn>
        <VBtn
          color="red"
          style="background-color: #c62828; color: white;"
          :disabled="deleteConfirmationUsername !== userToDelete?.username"
          :loading="isDeletingUser"
          @click="handleDeleteUser"
        >
          Delete
        </VBtn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- Error Modal -->
  <v-dialog v-model="errorModal.isOpen" max-width="500px">
    <v-card style="padding: 16px; border-radius: 12px">
      <div style="display: flex; flex-direction: row; align-items: center">
        <PhWarningCircle :size="24" color="red" />
        <v-card-title class="pb-0 pl-2" style="text-align: left">
          {{ errorModal.title }}
        </v-card-title>
      </div>

      <v-card-text class="px-8 mb-1" style="text-align: left">
        {{ errorModal.message }}
      </v-card-text>

      <v-card-actions class="pb-0" style="justify-content: end">
        <VBtn @click="errorModal.isOpen = false" rounded="lg">Close</VBtn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.users-page {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  background: #fafafc;
}

.users-content {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 32px;
}

.user-card {
  border-radius: 10px;
  border-color: #e2e8f0;
}

/* same primary button as "Create new study" on the dashboard. White on #00594C = 8.3:1 */
.btn-primary {
  min-width: 0 !important;
  font-weight: 600;
  background-color: #00594c !important;
  color: #ffffff !important;
  border: 1px solid #00594c !important;
}
.btn-primary:hover {
  background-color: #00473d !important;
}

/* same delete button as on the study cards. #b42318 on white = 6.5:1 */
.btn-secondary {
  min-width: 0 !important;
  font-weight: 600;
  background-color: #ffffff !important;
  border: 1px solid #00594c !important;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}
.btn-danger {
  color: #b42318 !important;
  border-color: #b42318 !important;
}
.btn-danger:hover {
  background-color: #fdecea !important;
}
/* own account cannot be deleted: only then the button looks pale */
.btn-secondary.v-btn--disabled {
  opacity: 0.45;
}
</style>
