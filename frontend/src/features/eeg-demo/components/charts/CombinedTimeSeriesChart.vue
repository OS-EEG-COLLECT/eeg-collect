<script setup lang="ts">
import { ref, watch } from 'vue';
import { Chart } from 'highcharts-vue';
import Highcharts from 'highcharts';
import HighchartsBoost from 'highcharts/modules/boost';
import type { ChannelInfo } from '../../composables';

HighchartsBoost(Highcharts);

const props = defineProps<{
  filteredBuffers: Record<string, Float32Array>;
  activeChannels: ChannelInfo[];
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
function generateTimeSeries(): any[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const series: any[] = [];
  props.activeChannels.forEach((ch) => {
    series.push({
      type: 'line' as const,
      name: ch.electrodeLabel,
      data: [] as number[],
      color: ch.color,
      lineWidth: 1,
      opacity: 0.8,
      marker: { enabled: false },
      states: { hover: { enabled: false } },
      enableMouseTracking: false,
    });
  });
  return series;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const chartOptions = ref<any>({
  chart: {
    type: 'line',
    animation: false,
    height: 250,
    backgroundColor: 'transparent'
  },
  title: {
    text: 'Filtered EEG Signal (All Channels)',
    style: { color: '#263238', fontSize: '14px' }
  },
  xAxis: {
    title: { text: 'Samples', style: { color: '#607d8b' } },
    labels: { style: { color: '#607d8b' } },
    gridLineColor: '#e0e0e0'
  },
  yAxis: {
    title: { text: 'Amplitude (µV)', style: { color: '#607d8b' } },
    labels: { style: { color: '#607d8b' } },
    gridLineColor: '#e0e0e0',
    plotLines: [{ value: 0, width: 1, color: '#b0bec5' }]
  },
  series: generateTimeSeries(),
  legend: {
    enabled: true,
    layout: 'horizontal' as const,
    align: 'center' as const,
    verticalAlign: 'bottom' as const,
    itemStyle: { color: '#607d8b', fontSize: '10px' },
    itemHoverStyle: { color: '#263238' }
  },
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
  const channels = props.activeChannels;
  const buffer = props.filteredBuffers;

  // Ensure correct number of series
  if (chart.series.length !== channels.length) {
    while (chart.series.length > 0) {
      chart.series[0].remove(false);
    }
    generateTimeSeries().forEach(s => chart.addSeries(s, false));
  }

  channels.forEach((ch, index) => {
    if (chart.series[index] && buffer[ch.electrodeLabel]) {
      chart.series[index].setData(buffer[ch.electrodeLabel], false, false, false);
    }
  });

  chart.redraw(false);
});

watch(() => props.activeChannels, () => {
  chartOptions.value.series = generateTimeSeries();
}, { deep: true });

watch([autoScale, yAxisRange, () => chartRef.value?.chart], () => {
  if (!chartRef.value?.chart?.yAxis?.[0]) return;
  const axis = chartRef.value.chart.yAxis[0];
  if (autoScale.value) {
    axis.update({ min: undefined, max: undefined, tickPositions: undefined }, true);
  } else {
    const half = yAxisRange.value / 2;
    axis.update({
      min: -yAxisRange.value,
      max: yAxisRange.value,
      tickPositions: [-yAxisRange.value, -half, 0, half, yAxisRange.value]
    }, true);
  }
}, { immediate: true });
</script>

<template>
  <div class="chart-container">
    <Chart ref="chartRef" :options="chartOptions" />
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

.axis-controls {
  position: absolute;
  top: 16px;
  right: 16px;
  display: flex;
  gap: 2px;
  z-index: 10;
}

.control-btn {
  width: 22px;
  height: 22px;
  padding: 0;
  border: 1px solid #b0bec5;
  background: rgba(255, 255, 255, 0.9);
  color: #607d8b;
  font-size: 12px;
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
