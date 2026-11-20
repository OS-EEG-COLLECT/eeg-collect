<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import BasePage from "@/components/BasePage.vue";
import { URL_PARAMS, URLs, getEncodedPassphrase } from "@/utils/helpers";
import {
  PhPlus,
  PhCopy,
  PhCheck,
  PhFolder,
  PhWarningCircle,
  PhTrash,
  PhUsers,
  PhDownloadSimple,
  PhSignOut,
  PhEye,
  PhEyeSlash,
} from "@phosphor-icons/vue";

// ---- TYPES ----
interface Study {
  id: string;
  title: string;
  description?: string;
  createdAt: string;
  _count?: { sessions: number };
}

// ---- STATE ----
const studies = ref<Study[]>([]);
const isLoading = ref(false);
const isCreating = ref(false);

// Modal State
const isCreateModalOpen = ref(false);
const newStudyTitle = ref("");
const newStudyDescription = ref("");

// Delete Modal State
const isDeleteModalOpen = ref(false);
const isDeleting = ref(false);
const studyToDelete = ref<Study | null>(null);
const deleteConfirmationTitle = ref("");

// Download Modal State
interface DownloadSession {
  id: number;
  createdAt: string;
  participant: string | null;
  folderName: string | null;
  // false if the session folder does not exist on the server
  hasData: boolean;
}
const isDownloadModalOpen = ref(false);
const isLoadingSessions = ref(false);
const isDownloading = ref(false);
const studyToDownload = ref<Study | null>(null);
const downloadSessions = ref<DownloadSession[]>([]);
const selectedSessionIds = ref<number[]>([]);

const downloadableSessions = computed(() =>
  downloadSessions.value.filter((session) => session.hasData),
);
const allSessionsSelected = computed(
  () =>
    downloadableSessions.value.length > 0 &&
    selectedSessionIds.value.length === downloadableSessions.value.length,
);

// Status for the copy button
const copiedStudyId = ref<string | null>(null);

const errorModal = ref({
  isOpen: false,
  title: "",
  message: "",
});

// User information from localStorage
const userId = localStorage.getItem("user_id");
const isAdmin = localStorage.getItem("is_admin") === "true";

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("user_token")}`,
});

// User Management Modal State
interface ManagedUser {
  id: number;
  username: string | null;
  isAdmin: boolean;
}
const isUsersModalOpen = ref(false);
const isLoadingUsers = ref(false);
const users = ref<ManagedUser[]>([]);

// Create User form State
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

// Delete User Modal State
const isDeleteUserModalOpen = ref(false);
const isDeletingUser = ref(false);
const userToDelete = ref<ManagedUser | null>(null);
const deleteConfirmationUsername = ref("");

const router = useRouter();

// ---- METHODS ----

const handleLogout = () => {
  localStorage.removeItem("user_token");
  localStorage.removeItem("user_id");
  localStorage.removeItem("username");
  localStorage.removeItem("is_admin");
  router.push("/login");
};

const fetchStudies = async () => {
  if (!userId) return;

  isLoading.value = true;
  try {
    const response = await fetch(`${URLs.API_URL}/studies/list`, {
      headers: authHeaders(),
    });
    if (response.ok) {
      studies.value = await response.json();
    }
  } catch (error) {
    console.error("Error loading studies:", error);
  } finally {
    isLoading.value = false;
  }
};

const handleCreateStudy = async () => {
  if (!newStudyTitle.value.trim()) return;

  isCreating.value = true;
  try {
    const response = await fetch(`${URLs.API_URL}/studies/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        title: newStudyTitle.value,
        description: newStudyDescription.value,
      }),
    });

    if (response.ok) {
      const createdStudy = await response.json();
      studies.value.unshift(createdStudy); // Puts the new study at the top of the list
      closeCreateModal();
    } else {
      showError("Error", "Study could not be created.");
    }
  } catch (error) {
    showError("Connection Error", "Server is not reachable.");
  } finally {
    isCreating.value = false;
  }
};

const closeCreateModal = () => {
  isCreateModalOpen.value = false;
  newStudyTitle.value = "";
  newStudyDescription.value = "";
};

const openDeleteModal = (study: Study) => {
  studyToDelete.value = study;
  isDeleteModalOpen.value = true;
};

const closeDeleteModal = () => {
  isDeleteModalOpen.value = false;
  studyToDelete.value = null;
  deleteConfirmationTitle.value = "";
};

const handleDeleteStudy = async () => {
  if (!studyToDelete.value) return;
  if (deleteConfirmationTitle.value !== studyToDelete.value.title) return;

  isDeleting.value = true;
  try {
    const response = await fetch(
      `${URLs.API_URL}/studies/${studyToDelete.value.id}/delete`,
      { method: "DELETE", headers: authHeaders() },
    );

    if (response.ok) {
      studies.value = studies.value.filter(
        (study) => study.id !== studyToDelete.value!.id,
      );
      closeDeleteModal();
    } else {
      showError("Error", "Study could not be deleted.");
    }
  } catch (error) {
    showError("Connection Error", "Server is not reachable.");
  } finally {
    isDeleting.value = false;
  }
};

const resetCreateUserForm = () => {
  newUsername.value = "";
  newUserPassword.value = "";
  newUserPasswordConfirm.value = "";
  showNewUserPasswords.value = false;
  newUserIsAdmin.value = false;
};

const fetchUsers = async () => {
  isLoadingUsers.value = true;
  try {
    const response = await fetch(`${URLs.API_URL}/users/list`, {
      headers: authHeaders(),
    });
    if (response.ok) {
      users.value = await response.json();
    } else {
      showError("Error", "Users could not be loaded.");
    }
  } catch (error) {
    showError("Connection Error", "Server is not reachable.");
  } finally {
    isLoadingUsers.value = false;
  }
};

const openUsersModal = () => {
  isUsersModalOpen.value = true;
  fetchUsers();
};

const closeUsersModal = () => {
  isUsersModalOpen.value = false;
  resetCreateUserForm();
};

const handleToggleAdmin = async (user: ManagedUser, makeAdmin: boolean) => {
  try {
    const response = await fetch(
      `${URLs.API_URL}/users/${user.id}/admin`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ isAdmin: makeAdmin }),
      },
    );

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
      { method: "DELETE", headers: authHeaders() },
    );

    if (response.ok) {
      users.value = users.value.filter((u) => u.id !== userToDelete.value!.id);
      closeDeleteUserModal();
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

const handleCreateUser = async () => {
  if (!canCreateUser.value) return;

  isCreatingUser.value = true;
  try {
    const response = await fetch(`${URLs.API_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        username: newUsername.value,
        password: newUserPassword.value,
        isAdmin: newUserIsAdmin.value,
      }),
    });

    if (response.ok) {
      resetCreateUserForm();
      await fetchUsers();
    } else {
      const data = await response.json();
      showError("Error", data.message || "User could not be created.");
    }
  } catch (error) {
    showError("Connection Error", "Server is not reachable.");
  } finally {
    isCreatingUser.value = false;
  }
};

const openDownloadModal = async (study: Study) => {
  studyToDownload.value = study;
  selectedSessionIds.value = [];
  downloadSessions.value = [];
  isDownloadModalOpen.value = true;

  isLoadingSessions.value = true;
  try {
    const response = await fetch(
      `${URLs.API_URL}/studies/${study.id}/sessions`,
      { headers: authHeaders() },
    );
    if (response.ok) {
      downloadSessions.value = await response.json();
    } else {
      showError("Error", "Sessions could not be loaded.");
    }
  } catch (error) {
    showError("Connection Error", "Server is not reachable.");
  } finally {
    isLoadingSessions.value = false;
  }
};

const closeDownloadModal = () => {
  isDownloadModalOpen.value = false;
  studyToDownload.value = null;
  selectedSessionIds.value = [];
};

const toggleSelectAllSessions = () => {
  selectedSessionIds.value = allSessionsSelected.value
    ? []
    : downloadableSessions.value.map((session) => session.id);
};

// e.g. "28.08.2026, 12:44"
const formatSessionDate = (value: string) =>
  new Date(value).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

// Without sessionIds the whole study is downloaded
const handleDownloadStudyData = async (
  studyId: string,
  sessionIds?: number[],
) => {
  const query = sessionIds?.length ? `?sessions=${sessionIds.join(",")}` : "";
  isDownloading.value = true;
  try {
    const response = await fetch(
      `${URLs.API_URL}/studies/${studyId}/download${query}`,
      { headers: authHeaders() },
    );

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      const detail = data?.error || data?.message;
      showError(
        "Error",
        `Study data could not be downloaded. (${response.status}${detail ? `: ${detail}` : ""})`,
      );
      return;
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = sessionIds?.length
      ? `study-${studyId}-sessions.zip`
      : `study-${studyId}.zip`;
    link.click();
    window.URL.revokeObjectURL(downloadUrl);
  } catch (error) {
    showError("Connection Error", "Server is not reachable.");
  } finally {
    isDownloading.value = false;
  }
};

const handleCopySessionLink = (studyId: string) => {
  const baseUrl = window.location.origin;
  const params = new URLSearchParams({
    [URL_PARAMS.passPhrase]: getEncodedPassphrase(),
    [URL_PARAMS.channelConfig]: "E",
    [URL_PARAMS.studyIdParam]: studyId,
  });
  const sessionUrl = `${baseUrl}/optimize-signal?${params.toString()}`;

  navigator.clipboard.writeText(sessionUrl).then(() => {
    copiedStudyId.value = studyId;
    setTimeout(() => {
      copiedStudyId.value = null;
    }, 2000);
  });
};

const showError = (title: string, message: string) => {
  errorModal.value = { isOpen: true, title, message };
};

onMounted(() => {
  fetchStudies();
});
</script>

<template>
  <BasePage heading="Researcher Dashboard">
    <p
      class="mb-6"
      style="
        color: #737373;
        text-align: center;
        font-weight: 500;
        font-size: 18px;
      "
    >
      Manage your studies here and generate links for participants <br />
      to start new measurement sessions.
    </p>

    <div class="dashboard-container">
      <!-- Header Action -->
      <div class="d-flex justify-space-between align-center mb-6">
        <h3 style="color: #333; font-weight: 600;">Your Studies</h3>
        <div class="d-flex align-center" style="gap: 8px;">
          <VBtn
            variant="text"
            color="#737373"
            :prepend-icon="PhSignOut"
            @click="handleLogout"
          >
            Logout
          </VBtn>
          <VBtn
            v-if="isAdmin"
            variant="tonal"
            color="#00594C"
            :prepend-icon="PhUsers"
            @click="openUsersModal"
          >
            Manage users
          </VBtn>
          <VBtn
            color="#00594C"
            style="background-color: #00594C; color: white;"
            :prepend-icon="PhPlus"
            @click="isCreateModalOpen = true"
          >
            Create new study
          </VBtn>
        </div>
      </div>

      <!-- Loading Indicator -->
      <div v-if="isLoading" class="text-center py-8">
        <v-progress-circular indeterminate color="#00594C"></v-progress-circular>
      </div>

      <!-- Empty List -->
      <div
        v-else-if="studies.length === 0"
        class="text-center py-8 px-4"
        style="background: #f9f9f9; border-radius: 12px; border: 1px dashed #ccc;"
      >
        <PhFolder :size="48" color="#939393" class="mb-2" />
        <p style="color: #737373; font-weight: 500;">
          No studies yet. Create your first study!
        </p>
      </div>

      <!-- List of Studies -->
      <div v-else class="study-list">
        <v-card
          v-for="study in studies"
          :key="study.id"
          class="mb-3 pa-4 study-card"
          variant="outlined"
        >
          <div class="d-flex justify-space-between align-center">
            <div>
              <h4 style="font-size: 18px; color: #2c3e50; margin-bottom: 2px;">
                {{ study.title }}
              </h4>
              <p v-if="study.description" style="font-size: 14px; color: #737373; margin-bottom: 4px;">
                {{ study.description }}
              </p>
              <span style="font-size: 12px; color: #939393;">
                ID: {{ study.id }} &middot; {{ study._count?.sessions ?? 0 }}
                {{ study._count?.sessions === 1 ? 'Session' : 'Sessions' }}
              </span>
            </div>

            <div class="d-flex align-center" style="gap: 8px;">
              <!-- Button: Copy Link -->
              <VBtn
                variant="tonal"
                color="#00594C"
                :prepend-icon="copiedStudyId === study.id ? PhCheck : PhCopy"
                @click="handleCopySessionLink(study.id)"
              >
                {{ copiedStudyId === study.id ? 'Copied!' : 'Session Link' }}
              </VBtn>

              <!-- Button: Download Study Data -->
              <VBtn
                variant="tonal"
                color="#00594C"
                icon
                :width="40"
                :height="40"
                @click="openDownloadModal(study)"
              >
                <PhDownloadSimple :size="18" />
              </VBtn>

              <!-- Button: Delete Study -->
              <VBtn
                variant="tonal"
                color="red"
                icon
                :width="40"
                :height="40"
                @click="openDeleteModal(study)"
              >
                <PhTrash :size="18" />
              </VBtn>
            </div>
          </div>
        </v-card>
      </div>
    </div>
  </BasePage>

  <!-- Modal: Create New Study -->
  <v-dialog v-model="isCreateModalOpen" max-width="500px" persistent>
    <v-card style="padding: 24px; border-radius: 12px;">
      <v-card-title class="px-0 pt-0 mb-2" style="font-weight: 600;">
        Create New Study
      </v-card-title>

      <v-card-text class="px-0 py-2">
        <v-text-field
          v-model="newStudyTitle"
          label="Study Title *"
          placeholder="e.g. Auditory EEG Pilot Study 2026"
          variant="outlined"
          density="comfortable"
          class="mb-4"
          hide-details="auto"
          @keyup.enter="handleCreateStudy"
        ></v-text-field>

        <v-textarea
          v-model="newStudyDescription"
          label="Description (Optional)"
          placeholder="Short description of the research goal..."
          variant="outlined"
          density="comfortable"
          rows="3"
          hide-details="auto"
        ></v-textarea>
      </v-card-text>

      <v-card-actions class="px-0 pb-0 mt-4" style="justify-content: end;">
        <VBtn
          variant="text"
          color="#737373"
          @click="closeCreateModal"
        >
          Cancel
        </VBtn>
        <VBtn
          color="#00594C"
          style="background-color: #00594C; color: white;"
          :disabled="!newStudyTitle.trim()"
          :loading="isCreating"
          @click="handleCreateStudy"
        >
          Create new study
        </VBtn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- Modal: Manage Users -->
  <v-dialog v-model="isUsersModalOpen" max-width="560px" persistent>
    <v-card style="padding: 24px; border-radius: 12px;">
      <v-card-title class="px-0 pt-0 mb-2" style="font-weight: 600;">
        Manage Users
      </v-card-title>

      <v-card-text class="px-0 py-2">
        <div v-if="isLoadingUsers" class="text-center py-4">
          <v-progress-circular indeterminate color="#00594C"></v-progress-circular>
        </div>

        <div v-else style="max-height: 260px; overflow-y: auto;" class="mb-4">
          <div
            v-for="user in users"
            :key="user.id"
            class="d-flex justify-space-between align-center py-2 px-3 mb-2"
            style="border: 1px solid #e2e8f0; border-radius: 8px;"
          >
            <div>
              <span style="font-weight: 500; color: #2c3e50;">{{ user.username }}</span>
              <v-chip
                v-if="String(user.id) === userId"
                size="x-small"
                variant="tonal"
                class="ml-2"
              >
                You
              </v-chip>
            </div>
            <div class="d-flex align-center" style="gap: 12px;">
            <v-switch
              :model-value="user.isAdmin"
              label="Admin"
              color="#00594C"
              density="compact"
              hide-details
              inset
              :disabled="String(user.id) === userId"
              @update:model-value="(val: boolean | null) => handleToggleAdmin(user, !!val)"
            ></v-switch>
            <VBtn
              variant="tonal"
              color="red"
              icon
              :width="36"
              :height="36"
              :disabled="String(user.id) === userId"
              @click="openDeleteUserModal(user)"
            >
              <PhTrash :size="16" />
            </VBtn>
            </div>
          </div>
        </div>

        <h4 class="mb-3" style="font-weight: 600; color: #333;">Create new user</h4>

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
              variant="outlined"
              density="comfortable"
              class="mb-4"
              hide-details="auto"
            ></v-text-field>

            <v-text-field
              v-model="newUserPasswordConfirm"
              label="Repeat password *"
              :type="showNewUserPasswords ? 'text' : 'password'"
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
        <VBtn
          variant="text"
          color="#737373"
          @click="closeUsersModal"
        >
          Close
        </VBtn>
        <VBtn
          color="#00594C"
          style="background-color: #00594C; color: white;"
          :disabled="!canCreateUser"
          :loading="isCreatingUser"
          @click="handleCreateUser"
        >
          Create new user
        </VBtn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- Modal: Download Study Data -->
  <v-dialog v-model="isDownloadModalOpen" max-width="560px" persistent>
    <v-card style="padding: 24px; border-radius: 12px;">
      <v-card-title class="px-0 pt-0 mb-1" style="font-weight: 600;">
        Download Data
      </v-card-title>
      <p class="mb-2" style="font-size: 14px; color: #737373;">
        {{ studyToDownload?.title }} &middot; Select the sessions you want to download.
      </p>

      <v-card-text class="px-0 py-2">
        <div v-if="isLoadingSessions" class="text-center py-4">
          <v-progress-circular indeterminate color="#00594C"></v-progress-circular>
        </div>

        <div
          v-else-if="downloadSessions.length === 0"
          class="text-center py-6"
          style="color: #737373; font-weight: 500;"
        >
          No sessions recorded for this study yet.
        </div>

        <template v-else>
          <v-checkbox
            :model-value="allSessionsSelected"
            :indeterminate="selectedSessionIds.length > 0 && !allSessionsSelected"
            :disabled="downloadableSessions.length === 0"
            label="Select all"
            color="#00594C"
            density="compact"
            hide-details
            class="mb-1"
            @update:model-value="toggleSelectAllSessions"
          ></v-checkbox>

          <div style="max-height: 300px; overflow-y: auto;">
            <div
              v-for="session in downloadSessions"
              :key="session.id"
              class="d-flex align-center py-1 px-3 mb-2"
              style="border: 1px solid #e2e8f0; border-radius: 8px;"
            >
              <v-checkbox
                v-model="selectedSessionIds"
                :value="session.id"
                :disabled="!session.hasData"
                color="#00594C"
                density="compact"
                hide-details
                class="flex-grow-0"
              ></v-checkbox>
              <div class="ml-2" style="min-width: 0;">
                <div style="font-weight: 500; color: #2c3e50;">
                  {{ session.participant ?? "Unknown participant" }}
                </div>
                <div style="font-size: 12px; color: #939393;">
                  {{ formatSessionDate(session.createdAt) }} &middot; ID: {{ session.id }}
                  <span v-if="!session.hasData" style="color: #c62828;">
                    &middot; No data on server
                  </span>
                </div>
              </div>
            </div>
          </div>
        </template>
      </v-card-text>

      <v-card-actions class="px-0 pb-0 mt-4" style="justify-content: end; gap: 8px;">
        <VBtn variant="text" color="#737373" @click="closeDownloadModal">
          Back
        </VBtn>
        <VBtn
          variant="tonal"
          color="#00594C"
          :disabled="downloadableSessions.length === 0 || isDownloading"
          @click="studyToDownload && handleDownloadStudyData(studyToDownload.id)"
        >
          Download all
        </VBtn>
        <VBtn
          color="#00594C"
          style="background-color: #00594C; color: white;"
          :prepend-icon="PhDownloadSimple"
          :disabled="selectedSessionIds.length === 0"
          :loading="isDownloading"
          @click="
            studyToDownload &&
              handleDownloadStudyData(studyToDownload.id, selectedSessionIds)
          "
        >
          Download selected ({{ selectedSessionIds.length }})
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

  <!-- Modal: Delete Study -->
  <v-dialog v-model="isDeleteModalOpen" max-width="500px">
    <v-card style="padding: 24px; border-radius: 12px;">
      <v-card-title class="px-0 pt-0 mb-2" style="font-weight: 600;">
        Delete Study
      </v-card-title>

      <v-card-text class="px-0 py-2">
        Do you really want to delete the study "{{ studyToDelete?.title }}"?
        This action cannot be undone.

        <v-text-field
          v-model="deleteConfirmationTitle"
          :label="`Type &quot;${studyToDelete?.title}&quot; to confirm`"
          variant="outlined"
          density="comfortable"
          class="mt-4"
          hide-details="auto"
          @keyup.enter="handleDeleteStudy"
        ></v-text-field>
      </v-card-text>

      <v-card-actions class="px-0 pb-0 mt-4" style="justify-content: end;">
        <VBtn
          variant="text"
          color="#737373"
          @click="closeDeleteModal"
        >
          Cancel
        </VBtn>
        <VBtn
          color="red"
          style="background-color: #c62828; color: white;"
          :disabled="deleteConfirmationTitle !== studyToDelete?.title"
          :loading="isDeleting"
          @click="handleDeleteStudy"
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
.dashboard-container {
  width: 100%;
  max-width: 750px;
  margin: 0 auto;
}

.study-card {
  border-radius: 10px;
  border-color: #e2e8f0;
  transition: all 0.2s ease;
}

.study-card:hover {
  border-color: #00594C;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}
</style>