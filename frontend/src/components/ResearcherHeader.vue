<script setup lang="ts">
import { defineProps } from "vue";
import AccountMenu from "@/components/accountMenu/AccountMenu.vue";

// Compact header of the researcher pages (dashboard, manage users):
// title on the left, account menu on the right.
const props = defineProps<{ title: string; subtitle?: string }>();
</script>

<template>
  <!-- A div, not <header>: App.vue styles every <header> globally as the fixed green app bar. -->
  <div class="researcher-header">
    <div class="researcher-header-inner">
      <div style="min-width: 0;">
        <!-- optional slot above the title, e.g. a back link -->
        <slot name="before-title" />
        <h1 class="researcher-header-title">{{ props.title }}</h1>
        <p v-if="props.subtitle" class="researcher-header-subtitle">
          {{ props.subtitle }}
        </p>
      </div>

      <AccountMenu />
    </div>
  </div>
</template>

<style scoped>
.researcher-header {
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  padding: 16px 0;
}

/* same width and inner padding as the page content, so everything lines up */
.researcher-header-inner {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 32px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.researcher-header-title {
  font-size: 22px;
  font-weight: 600;
  color: #2c3e50;
  margin: 0;
}

.researcher-header-subtitle {
  font-size: 13px;
  color: #5f6b76;
  margin: 2px 0 0;
}
</style>
