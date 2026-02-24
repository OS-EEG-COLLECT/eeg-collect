<script setup lang="ts">
import { ref, watch } from 'vue';
import { Chart } from 'highcharts-vue';
import Highcharts from 'highcharts';
import HighchartsBoost from 'highcharts/modules/boost';
import type { ChannelInfo, ChannelFFTResult, FFTOutput } from '../../composables';

HighchartsBoost(Highcharts);

const props = defineProps<{
  fftOutput: Record<string, ChannelFFTResult>;
  averageFft: FFTOutput | null;
  activeChannels: ChannelInfo[];
  processingVersion: number;
  targetFrequencies?: number[];
}>();

const autoScale = ref(true);
const yAxisMax = ref(50);

function toggleAutoScale() {
  autoScale.value = !autoScale.value;
}

function increaseRange() {
  autoScale.value = false;
  yAxisMax.value += 50;
}

function decreaseRange() {
  autoScale.value = false;
  if (yAxisMax.value > 50) {
    yAxisMax.value -= 50;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const chartRef = ref<any>(null);

const targetColors = [
  { line: '#ffb300', band: 'rgba(255, 179, 0, 0.12)', label: '#b26a00' },
  { line: '#7c4dff', band: 'rgba(124, 77, 255, 0.12)', label: '#4a148c' },
];

function buildTargetIndicator(freqs: number[] | undefined) {
  if (!freqs || freqs.length === 0) {
    return { plotLines: [], plotBands: [] };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plotLines: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plotBands: any[] = [];
  freqs.forEach((freq, i) => {
    const colors = targetColors[i % targetColors.length];
    plotLines.push({
      value: freq,
      width: 2,
      color: colors.line,
      dashStyle: 'Dash',
      zIndex: 5,
    });
    plotBands.push({
      from: freq - 2,
      to: freq + 2,
      color: colors.band,
      label: {
        text: `${freq} Hz Target`,
        style: { color: colors.label, fontSize: '10px' },
      },
    });
  });
  return { plotLines, plotBands };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateFFTSeries(): any[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const series: any[] = [];

  // Per-channel series (thin lines)
  props.activeChannels.forEach((ch) => {
    series.push({
      type: 'line' as const,
      name: ch.electrodeLabel,
      data: [] as [number, number][],
      color: ch.color,
      lineWidth: 1,
      opacity: 0.6,
      marker: { enabled: false },
      states: { hover: { enabled: false } },
      enableMouseTracking: false,
    });
  });

  // Average spectrum series (thick, highlighted)
  series.push({
    type: 'area' as const,
    name: 'Average',
    data: [] as [number, number][],
    color: '#607d8b',
    fillOpacity: 0.15,
    lineWidth: 2.5,
    zIndex: 10,
    marker: { enabled: false },
    states: { hover: { enabled: false } },
    enableMouseTracking: false,
  });

  return series;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const chartOptions = ref<any>({
  chart: {
    type: 'line',
    animation: false,
    height: 300,
    backgroundColor: 'transparent'
  },
  title: {
    text: 'Multi-Channel Frequency Spectrum',
    style: { color: '#263238', fontSize: '14px' }
  },
  xAxis: {
    title: { text: 'Frequency (Hz)', style: { color: '#607d8b' } },
    labels: { style: { color: '#607d8b' } },
    gridLineColor: '#e0e0e0',
    min: 0,
    max: 60,
    ...buildTargetIndicator(props.targetFrequencies)
  },
  yAxis: {
    title: { text: 'Power', style: { color: '#607d8b' } },
    labels: { style: { color: '#607d8b' } },
    gridLineColor: '#e0e0e0',
    min: 0
  },
  series: generateFFTSeries(),
  legend: {
    enabled: true,
    layout: 'horizontal',
    align: 'center',
    verticalAlign: 'bottom',
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
  const fftResults = props.fftOutput;
  const avgFFT = props.averageFft;

  // Ensure correct number of series (channels + average)
  const expectedSeriesCount = channels.length + 1;
  if (chart.series.length !== expectedSeriesCount) {
    while (chart.series.length > 0) {
      chart.series[0].remove(false);
    }
    generateFFTSeries().forEach(s => chart.addSeries(s, false));
  }

  channels.forEach((ch, index) => {
    const result = fftResults[ch.electrodeLabel];
    if (result && chart.series[index]) {
      const { frequencies, magnitudes } = result.fft;

      let count = 0;
      for (let i = 0; i < frequencies.length && frequencies[i] <= 60; i++) {
        count++;
      }

      const fftData = new Array(count);
      for (let i = 0; i < count; i++) {
        fftData[i] = [frequencies[i], magnitudes[i]];
      }
      chart.series[index].setData(fftData, false, false, false);
    }
  });

  // Update average spectrum (last series)
  const avgSeriesIndex = chart.series.length - 1;
  if (avgFFT && chart.series[avgSeriesIndex]) {
    const { frequencies, magnitudes } = avgFFT;

    let count = 0;
    for (let i = 0; i < frequencies.length && frequencies[i] <= 60; i++) {
      count++;
    }

    const avgData = new Array(count);
    for (let i = 0; i < count; i++) {
      avgData[i] = [frequencies[i], magnitudes[i]];
    }
    chart.series[avgSeriesIndex].setData(avgData, false, false, false);
  }

  chart.redraw(false);
});

watch(() => props.targetFrequencies, (freqs) => {
  if (!chartRef.value?.chart) return;
  chartRef.value.chart.xAxis[0].update(buildTargetIndicator(freqs));
}, { deep: true });

watch(() => props.activeChannels, () => {
  chartOptions.value.series = generateFFTSeries();
}, { deep: true });

watch([autoScale, yAxisMax, () => chartRef.value?.chart], () => {
  if (!chartRef.value?.chart?.yAxis?.[0]) return;
  const axis = chartRef.value.chart.yAxis[0];
  if (autoScale.value) {
    axis.update({ min: 0, max: undefined, tickPositions: undefined }, true);
  } else {
    const half = yAxisMax.value / 2;
    axis.update({
      min: 0,
      max: yAxisMax.value,
      tickPositions: [0, half, yAxisMax.value]
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
        title="Increase range (+50)"
      >
        +
      </button>
      <button
        @click="decreaseRange"
        class="control-btn"
        title="Decrease range (-50)"
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
