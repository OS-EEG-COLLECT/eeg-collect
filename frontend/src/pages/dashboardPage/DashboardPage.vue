<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { URL_PARAMS, URLs, getEncodedPassphrase } from "@/utils/helpers";
import { useToast } from "@/utils/toast";
import ResearcherHeader from "@/components/ResearcherHeader.vue";
import {
  PhPlus,
  PhCopy,
  PhCheck,
  PhFolder,
  PhWarningCircle,
  PhTrash,
  PhDownloadSimple,
} from "@phosphor-icons/vue";

// ---- TYPES ----
interface Study {
  id: string;
  title: string;
  description?: string;
  createdAt?: string;
  // date of the newest session, null if the study has no sessions
  lastSessionAt?: string | null;
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

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("user_token")}`,
});

const { showToast, showErrorToast } = useToast();

// ---- METHODS ----

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
      showToast("Study deleted");
    } else {
      showErrorToast("Couldn't delete study");
    }
  } catch (error) {
    showErrorToast("Couldn't delete study: server not reachable");
  } finally {
    isDeleting.value = false;
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
      showErrorToast(
        data?.message
          ? `Couldn't download data: ${data.message}`
          : "Couldn't download data",
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
    showToast("Download started");
  } catch (error) {
    showErrorToast("Couldn't download data: server not reachable");
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

  // navigator.clipboard only exists on https or localhost
  if (!navigator.clipboard) {
    showErrorToast("Couldn't copy link");
    return;
  }

  navigator.clipboard
    .writeText(sessionUrl)
    .then(() => {
      copiedStudyId.value = studyId;
      showToast("Participant link copied");
      setTimeout(() => {
        copiedStudyId.value = null;
      }, 2000);
    })
    .catch(() => {
      showErrorToast("Couldn't copy link");
    });
};

const showError = (title: string, message: string) => {
  errorModal.value = { isOpen: true, title, message };
};

// ---- STUDY CARD META LINE ----

const pluralize = (count: number, word: string) =>
  `${count} ${count === 1 ? word : `${word}s`}`;

// "just now", "5 minutes ago", "2 days ago", ...
const formatRelativeTime = (value: string) => {
  const seconds = Math.max(0, (Date.now() - new Date(value).getTime()) / 1000);
  const units: [string, number][] = [
    ["year", 365 * 24 * 3600],
    ["month", 30 * 24 * 3600],
    ["week", 7 * 24 * 3600],
    ["day", 24 * 3600],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, unitSeconds] of units) {
    const amount = Math.floor(seconds / unitSeconds);
    if (amount >= 1) return `${pluralize(amount, unit)} ago`;
  }
  return "just now";
};

// e.g. "12 Nov 2026"
const formatShortDate = (value: string) =>
  new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

// "6 sessions · Last session 2 days ago · Created 12 Nov 2026"
const getStudyMetaLine = (study: Study) => {
  const sessionCount = study._count?.sessions ?? 0;
  const parts = [pluralize(sessionCount, "session")];
  parts.push(
    sessionCount > 0 && study.lastSessionAt
      ? `Last session ${formatRelativeTime(study.lastSessionAt)}`
      : "No sessions yet",
  );
  if (study.createdAt) {
    parts.push(`Created ${formatShortDate(study.createdAt)}`);
  }
  return parts.join(" · ");
};

onMounted(() => {
  fetchStudies();
});
</script>

<template>
  <div class="dashboard-page">
    <ResearcherHeader
      title="Researcher Dashboard"
      subtitle="Manage your studies and generate links for participants to start new sessions."
    />

    <div class="dashboard-container dashboard-content">
      <!-- Header Action -->
      <div class="d-flex justify-space-between align-center mb-6">
        <h3 style="color: #333; font-weight: 600;">Your Studies</h3>
        <div class="d-flex align-center" style="gap: 8px;">
          <!-- Only primary (filled) button on this page -->
          <VBtn
            class="btn-primary"
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
          <!-- Grid: text on the left, actions always in the same place on the right -->
          <div class="study-card-row">
            <div style="min-width: 0;">
              <!-- Study ID only as a hover tooltip -->
              <h4
                style="font-size: 18px; color: #2c3e50; margin-bottom: 2px;"
                :title="`Study ID: ${study.id}`"
              >
                {{ study.title }}
              </h4>
              <p v-if="study.description" style="font-size: 14px; color: #737373; margin-bottom: 4px;">
                {{ study.description }}
              </p>
              <!-- #5f6b76 on white = 5.5:1, meets WCAG AA for small text -->
              <span style="font-size: 12px; color: #5f6b76;">
                {{ getStudyMetaLine(study) }}
              </span>
            </div>

            <div class="study-card-actions">
              <!-- Button: Copy Link -->
              <VBtn
                class="btn-secondary"
                variant="outlined"
                :prepend-icon="copiedStudyId === study.id ? PhCheck : PhCopy"
                @click="handleCopySessionLink(study.id)"
              >
                {{ copiedStudyId === study.id ? 'Copied!' : 'Copy participant link' }}
              </VBtn>

              <!-- Button: Download Study Data
                   Disabled buttons get no mouse events, so the tooltip sits on a wrapper span -->
              <v-tooltip
                text="No sessions to download yet"
                location="top"
                :disabled="(study._count?.sessions ?? 0) > 0"
              >
                <template #activator="{ props: tooltipProps }">
                  <span
                    v-bind="tooltipProps"
                    :class="{ 'btn-disabled-wrapper': (study._count?.sessions ?? 0) === 0 }"
                  >
                    <VBtn
                      class="btn-secondary"
                      variant="outlined"
                      :prepend-icon="PhDownloadSimple"
                      :disabled="(study._count?.sessions ?? 0) === 0"
                      @click="openDownloadModal(study)"
                    >
                      Download data
                    </VBtn>
                  </span>
                </template>
              </v-tooltip>

              <!-- Button: Delete Study -->
              <VBtn
                class="btn-secondary btn-danger"
                variant="outlined"
                :prepend-icon="PhTrash"
                @click="openDeleteModal(study)"
              >
                Delete
              </VBtn>
            </div>
          </div>
        </v-card>
      </div>
    </div>
  </div>

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
/* ---- Button styles (overview page) ----
   The global VBtn defaults (vuetify.ts) set a pale background and a light grey
   border with !important, so these classes override them with real contrast. */
.btn-primary,
.btn-secondary {
  min-width: 0 !important;
  font-weight: 600;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

/* Primary: filled. White on #00594C = 8.3:1 */
.btn-primary {
  background-color: #00594c !important;
  color: #ffffff !important;
  border: 1px solid #00594c !important;
}
.btn-primary:hover {
  background-color: #00473d !important;
}

/* Secondary: outline. #00594C text/border on white = 8.3:1 */
.btn-secondary {
  background-color: #ffffff !important;
  color: #00594c !important;
  border: 1px solid #00594c !important;
}
.btn-secondary:hover {
  background-color: #e6f0ee !important;
}

/* Destructive secondary: #b42318 on white = 6.5:1 */
.btn-danger {
  color: #b42318 !important;
  border-color: #b42318 !important;
}
.btn-danger:hover {
  background-color: #fdecea !important;
}

/* Only really disabled buttons look pale */
.btn-primary.v-btn--disabled,
.btn-secondary.v-btn--disabled {
  opacity: 0.45;
}
/* Vuetify sets pointer-events: none on disabled buttons, so the cursor is shown on the wrapper */
.btn-disabled-wrapper {
  display: inline-block;
  cursor: not-allowed;
}

.dashboard-page {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  background: #fafafc;
}

.study-card-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 16px;
}

.study-card-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: nowrap;
  gap: 8px;
}

/* Narrow screens: buttons go below the text on every card */
@media (max-width: 760px) {
  .study-card-row {
    grid-template-columns: minmax(0, 1fr);
  }
  .study-card-actions {
    justify-content: flex-start;
    flex-wrap: wrap;
  }
}

.dashboard-container {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
}

.dashboard-content {
  padding: 32px;
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