<script setup lang="ts">
/**
 * ComingSoonGame Component
 *
 * Generic placeholder component for games that haven't been implemented yet.
 */
import { PhGameController } from '@phosphor-icons/vue';
</script>

<template>
  <div class="coming-soon-game">
    <div class="coming-soon-content">
      <PhGameController :size="64" color="#9e9e9e" class="mb-4" />
      <h2 class="text-h4 font-weight-bold mb-2">Coming Soon</h2>
      <p class="text-body-1 text-grey">
        This game is currently under development.
      </p>
      <p class="text-body-2 text-grey-lighten-1 mt-4">
        Check back later for updates!
      </p>
    </div>
  </div>
</template>

<style scoped>
.coming-soon-game {
  width: 100%;
  height: 100%;
  min-height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%);
  border-radius: 12px;
}

.coming-soon-content {
  text-align: center;
  padding: 2rem;
}
</style>
