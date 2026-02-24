<script setup lang="ts">
import { ref, watch } from 'vue';
import { Chart } from 'highcharts-vue';
import Highcharts from 'highcharts';
import HighchartsBoost from 'highcharts/modules/boost';
import type { ChannelInfo } from '../../composables';

HighchartsBoost(Highcharts);

const props = defineProps<{
  channel: ChannelInfo;
  filteredBuffers: Record<string, Float32Array>;
  processingVersion: number;
}>();

const autoScale = ref(false); // Y-axis
const yAxisRange = ref(150); // Range in µV (±150 µV default)

function toggleAutoScale() {
  autoScale.value = !autoScale.value;
}

function increaseRange() {
  autoScale.value = false;
  yAxisRange.value += 50;
}

function decreaseRange() {
  autoScale.value = false;
  if (yAxisRange.value > 50) {
    yAxisRange.value -= 50;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const chartRef = ref<any>(null);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const chartOptions = ref<any>({
  chart: {
    type: 'line',
    animation: false,
    height: 180,
    backgroundColor: 'transparent',
    spacingTop: 5,
    spacingBottom: 5,
    spacingLeft: 8,
    spacingRight: 8
  },
  title: {
    text: props.channel.electrodeLabel,
    align: 'left' as const,
    style: { color: props.channel.color, fontSize: '13px', fontWeight: 'bold' },
    margin: 5,
    y: 12
  },
  xAxis: {
    title: {
      text: 'Samples',
      style: { color: '#78909c', fontSize: '9px' },
      margin: 5
    },
    labels: {
      style: { color: '#78909c', fontSize: '9px' },
      y: 12
    },
    gridLineColor: '#e0e0e0'
  },
  yAxis: {
    title: {
      text: 'µV',
      style: { color: '#78909c', fontSize: '9px' },
      margin: 8
    },
    labels: {
      style: { color: '#78909c', fontSize: '9px' },
      x: -3
    },
    gridLineColor: '#e0e0e0',
    plotLines: [{ value: 0, width: 1, color: '#b0bec5' }]
  },
  series: [{
    type: 'line' as const,
    name: props.channel.electrodeLabel,
    data: [] as number[],
    color: props.channel.color,
    lineWidth: 1.5,
    marker: { enabled: false },
    states: { hover: { enabled: false } },
    enableMouseTracking: false,
  }],
  legend: { enabled: false },
  credits: { enabled: false },
  boost: {
    useGPUTranslations: true,
    seriesThreshold: 1
  },
  plotOptions: {
    series: {
      enableMouseTracking: false,
      animation: false,
      turboThreshold: 10000,
      boostThreshold: 1
    }
  }
});

watch(() => props.processingVersion, () => {
  if (!chartRef.value?.chart) return;
  const chart = chartRef.value.chart;

  if (chart.series[0] && props.filteredBuffers[props.channel.electrodeLabel]) {
    chart.series[0].setData(props.filteredBuffers[props.channel.electrodeLabel], false, false, false);
  }
  chart.redraw(false);
});

watch([autoScale, yAxisRange, () => chartRef.value?.chart], () => {
  if (!chartRef.value?.chart?.yAxis?.[0]) return;
  const axis = chartRef.value.chart.yAxis[0];
  if (autoScale.value) {
    axis.update({ min: undefined, max: undefined, tickPositions: undefined }, true);
  } else {
    axis.update({
      min: -yAxisRange.value,
      max: yAxisRange.value,
      tickPositions: [-yAxisRange.value, 0, yAxisRange.value]
    }, true);
  }
}, { immediate: true });
</script>

<template>
  <div class="chart-container">
    <Chart ref="chartRef" :options="chartOptions" class="per-channel-chart" />
    <div class="axis-controls">
      <button
        @click="toggleAutoScale"
        :class="{ active: autoScale }"
        class="control-btn"
        title="Auto scale"
      >
        A
      </button>
      <button
        @click="increaseRange"
        class="control-btn"
        title="Increase range (+50µV)"
      >
        +
      </button>
      <button
        @click="decreaseRange"
        class="control-btn"
        title="Decrease range (-50µV)"
      >
        −
      </button>
    </div>
  </div>
</template>

<style scoped>
.chart-container {
  position: relative;
  width: 100%;
}

.per-channel-chart {
  width: 100%;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  overflow: visible;
  background: #f7f7f7;
  flex-shrink: 0;
  margin-bottom: 0;
}

.axis-controls {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  gap: 2px;
  z-index: 10;
}

.control-btn {
  width: 20px;
  height: 20px;
  padding: 0;
  border: 1px solid #b0bec5;
  background: rgba(255, 255, 255, 0.9);
  color: #607d8b;
  font-size: 11px;
  font-weight: bold;
  border-radius: 3px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.control-btn:hover {
  background: #fff;
  border-color: #78909c;
  color: #263238;
}

.control-btn.active {
  background: #78909c;
  color: #fff;
  border-color: #78909c;
}
</style>
