<script setup lang="ts">
/**
 * GameController Component
 * 
 * Allows user to configure the key mapping for brain-controlled input.
 * Dynamically displays actions based on the selected game.
 */

import { ref, computed, defineEmits, defineProps, watch } from 'vue';
import {
  PhArrowRight,
  PhKeyboard,
  PhBrain,
  PhGameController,
  PhCheck,
  PhLock
} from '@phosphor-icons/vue';
import { getKeyboardDriver, type KeyCode } from '../services';
import { getGameById, ALL_GAME_ACTIONS, type GameConfig, type GameAction, type GameActionType } from '../games';

const emit = defineEmits(['continue', 'back']);

const props = defineProps({
  gameId: {
    type: String,
    default: 'flappy-brain',
  },
});

const keyboardDriver = getKeyboardDriver();

const gameConfig = computed<GameConfig | undefined>(() => getGameById(props.gameId));

const availableActions = computed<GameAction[]>(() => gameConfig.value?.actions ?? []);

const unavailableActions = computed<GameAction[]>(() => {
  const availableIds = new Set(availableActions.value.map(a => a.id));
  return ALL_GAME_ACTIONS.filter(a => !availableIds.has(a.id));
});

const selectedAction = ref<GameActionType | null>(null);

watch(availableActions, (actions) => {
  if (actions.length > 0 && !selectedAction.value) {
    selectedAction.value = actions[0].id;
  }
}, { immediate: true });

const actionKeyMapping = ref<Record<string, KeyCode>>({});

watch(availableActions, (actions) => {
  actions.forEach(action => {
    if (!actionKeyMapping.value[action.id]) {
      actionKeyMapping.value[action.id] = action.defaultKey as KeyCode;
    }
  });
}, { immediate: true });

const selectedKey = computed(() => {
  if (selectedAction.value) {
    return actionKeyMapping.value[selectedAction.value] || 'Space';
  }
  return keyboardDriver.getCurrentKey();
});

const cooldownMs = ref(keyboardDriver.getDefaultCooldown());

const availableKeys = keyboardDriver.getAvailableKeys();

const keyGroups = computed(() => {
  return {
    common: availableKeys.filter(k => ['Space', 'Enter'].includes(k.code)),
    arrows: availableKeys.filter(k => k.code.startsWith('Arrow')),
    wasd: availableKeys.filter(k => ['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(k.code)),
  };
});

const handleKeySelect = (key: KeyCode) => {
  if (selectedAction.value) {
    actionKeyMapping.value[selectedAction.value] = key;
  }
  keyboardDriver.setKey(key);
};

const handleActionSelect = (action: GameAction) => {
  selectedAction.value = action.id;
};

const handleCooldownChange = (value: number) => {
  cooldownMs.value = value;
  // Set cooldown for all actions in this game
  availableActions.value.forEach(action => {
    keyboardDriver.setCooldown(value, action.id);
  });
};

const handleContinue = () => {
  // Apply key mappings for all actions as named bindings
  for (const action of availableActions.value) {
    const key = actionKeyMapping.value[action.id] || action.defaultKey;
    keyboardDriver.setKey(key as KeyCode, action.id);
  }
  emit('continue');
};
</script>

<template>
  <div class="game-controller pa-8">
    <div class="text-center mb-4">
      <div class="d-flex justify-center align-center mb-3">
        <span v-if="gameConfig" class="game-emoji mr-2">{{ gameConfig.thumbnail }}</span>
        <PhGameController :size="48" color="#00876c" />
      </div>
      <h1 class="text-h5 font-weight-bold mb-1">
        Game Controls
      </h1>
      <p class="text-body-2 text-grey">
        Configure how your brain signals control
        <strong>{{ gameConfig?.name ?? 'the game' }}</strong>
      </p>
    </div>

    <div class="control-container">
      <VCard class="mapping-card mb-4 px-4 py-4" variant="outlined">
        <div class="mapping-visual d-flex align-center justify-center">
          <div class="mapping-side text-center">
            <VAvatar color="#00876c" size="56">
              <PhBrain :size="28" color="white" />
            </VAvatar>
            <p class="text-caption font-weight-medium mt-2 mb-0">Brain (ASSR)</p>
          </div>

          <PhArrowRight :size="32" color="#bdbdbd" class="mx-6" />

          <div class="mapping-side text-center">
            <VAvatar color="#1a2b5a" size="56">
              <PhKeyboard :size="28" color="white" />
            </VAvatar>
            <p class="text-caption font-weight-medium mt-2 mb-0">{{ keyboardDriver.getKeyLabel(selectedKey) }}</p>
          </div>
        </div>
      </VCard>

      <VCard class="info-card mb-4 pa-3" variant="tonal" color="#00876c">
        <p class="text-caption mb-0" style="color: #000">
          <strong>How it works:</strong> When your brain's 40 Hz response is strong enough relative to background noise, the selected key is pressed. Focus on the sound.
        </p>
      </VCard>

      <VCard class="actions-card mb-4 px-4 py-3" variant="outlined">
        <VCardText class="pa-0">
          <h3 class="text-subtitle-2 font-weight-bold mb-3">
            Available Brain Controls
            <span class="text-caption text-grey ml-2">({{ availableActions.length }} action{{ availableActions.length !== 1 ? 's' : '' }})</span>
          </h3>

          <div class="d-flex flex-wrap mb-3">
            <VChip
              v-for="action in availableActions"
              :key="action.id"
              :variant="selectedAction === action.id ? 'tonal' : 'outlined'"
              :color="selectedAction === action.id ? '#00876c' : 'primary'"
              class="mr-2 mb-2 action-chip"
              @click="handleActionSelect(action)"
            >
              <template #prepend>
                <VIcon size="16" class="mr-1">{{ action.icon }}</VIcon>
              </template>
              {{ action.label }}
              <template v-if="selectedAction === action.id" #append>
                <PhCheck :size="14" class="ml-1" />
              </template>
            </VChip>
          </div>

          <div v-if="unavailableActions.length > 0">
            <p class="text-caption text-grey mb-2">
              <PhLock :size="12" class="mr-1" />
              Not available for this game:
            </p>
            <div class="d-flex flex-wrap">
              <VChip
                v-for="action in unavailableActions"
                :key="action.id"
                size="small"
                variant="outlined"
                color="grey"
                class="mr-2 mb-2"
                disabled
              >
                <template #prepend>
                  <VIcon size="16" class="mr-1" color="grey">{{ action.icon }}</VIcon>
                </template>
                {{ action.label }}
              </VChip>
            </div>
          </div>
        </VCardText>
      </VCard>

      <VCard class="keys-card mb-4 px-4 py-4" variant="outlined">
        <VCardText class="pa-0">
          <h3 class="text-subtitle-2 font-weight-bold mb-4">
            Select Key for
            <VChip size="small" color="#00876c" variant="tonal" class="ml-1">
              {{ availableActions.find(a => a.id === selectedAction)?.label ?? 'Action' }}
            </VChip>
          </h3>

          <v-row class="key-groups-row">
            <v-col cols="12" sm="4" class="key-group-col">
              <p class="text-caption text-grey font-weight-medium mb-2">Common Controls</p>
              <div class="d-flex flex-wrap">
                <VChip
                  v-for="key in keyGroups.common"
                  :key="key.code"
                  :variant="selectedKey === key.code ? 'tonal' : 'outlined'"
                  :color="selectedKey === key.code ? '#00876c' : 'default'"
                  class="mr-2 mb-2"
                  @click="handleKeySelect(key.code)"
                >
                  <template v-if="selectedKey === key.code" #prepend>
                    <PhCheck :size="16" class="mr-1" />
                  </template>
                  {{ key.label }}
                </VChip>
              </div>
            </v-col>

            <v-col cols="12" sm="4" class="key-group-col">
              <p class="text-caption text-grey font-weight-medium mb-2">Arrow Keys</p>
              <div class="d-flex flex-wrap">
                <VChip
                  v-for="key in keyGroups.arrows"
                  :key="key.code"
                  :variant="selectedKey === key.code ? 'tonal' : 'outlined'"
                  :color="selectedKey === key.code ? '#00876c' : 'default'"
                  class="mr-2 mb-2"
                  @click="handleKeySelect(key.code)"
                >
                  <template v-if="selectedKey === key.code" #prepend>
                    <PhCheck :size="16" class="mr-1" />
                  </template>
                  {{ key.label }}
                </VChip>
              </div>
            </v-col>

            <v-col cols="12" sm="4" class="key-group-col">
              <p class="text-caption text-grey font-weight-medium mb-2">WASD Keys</p>
              <div class="d-flex flex-wrap">
                <VChip
                  v-for="key in keyGroups.wasd"
                  :key="key.code"
                  :variant="selectedKey === key.code ? 'tonal' : 'outlined'"
                  :color="selectedKey === key.code ? '#00876c' : 'default'"
                  class="mr-2 mb-2"
                  @click="handleKeySelect(key.code)"
                >
                  <template v-if="selectedKey === key.code" #prepend>
                    <PhCheck :size="16" class="mr-1" />
                  </template>
                  {{ key.label }}
                </VChip>
              </div>
            </v-col>
          </v-row>
        </VCardText>
      </VCard>

      <VCard class="cooldown-card mb-4 pa-3" variant="outlined">
        <div class="d-flex align-center">
          <span class="text-body-2 font-weight-medium" style="min-width: 90px">Cooldown:</span>
          <VSlider
            v-model="cooldownMs"
            :min="100"
            :max="1000"
            :step="50"
            color="#00876c"
            density="compact"
            hide-details
            @update:model-value="handleCooldownChange"
            class="flex-1 mx-3"
          />
          <span class="text-body-2 font-weight-bold" style="min-width: 55px; color: #00876c">
            {{ cooldownMs }}ms
          </span>
        </div>
      </VCard>

      <div class="d-flex justify-center">
        <VBtn
          variant="text"
          color="grey"
          @click="emit('back')"
          class="mr-4"
        >
          Back to Game Selection
        </VBtn>

        <VBtn
          :append-icon="PhArrowRight"
          @click="handleContinue"
        >
          Start Playing
        </VBtn>
      </div>
    </div>
  </div>
</template>

<style scoped>
.game-controller {
  min-height: calc(100vh - 140px);
  padding: 32px 16px !important;
}

.control-container {
  max-width: 700px;
  margin: 0 auto;
}

.game-emoji {
  font-size: 32px;
  line-height: 1;
}

.mapping-card,
.actions-card,
.keys-card,
.cooldown-card,
.info-card {
  border-radius: 12px;
}

.mapping-card,
.actions-card,
.keys-card,
.cooldown-card {
  border-color: #e0e0e0;
}

.action-chip {
  cursor: pointer;
}

.mapping-visual {
  padding: 8px 0;
}

.mapping-side {
  min-width: 100px;
}

.key-groups-row {
  margin: 0 -8px;
}

.key-group-col {
  padding: 0 8px;
}

@media (max-width: 600px) {
  .key-group-col {
    margin-bottom: 16px;
  }

  .key-group-col:last-child {
    margin-bottom: 0;
  }
}
</style>
