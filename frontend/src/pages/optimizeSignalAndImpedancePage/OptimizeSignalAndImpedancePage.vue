<script setup lang="ts">
import { computed, ComputedRef, onMounted, Ref, ref, watch } from "vue";
import { navigateToRestricted } from "@/router";

import BasePage from "@/components/BasePage.vue";
import {
  useConfigureParticipantId,
  useOpenBCIUtils,
  useWebsocketConnection,
} from "@/utils/hooks";
import * as d3 from "d3";
import { NODES } from "@/utils/types";
import { BaseType } from "d3";
import {
  Node,
  Node2,
  NODES_DEFAULT_VALUES,
} from "@/pages/optimizeSignalAndImpedancePage/utils/optimizeSignalAndImpedanceTypes";
import { getSignalState } from "@/pages/optimizeSignalAndImpedancePage/utils/helpers";
import { SerialDataRMS } from "@/utils/openBCISerialTypes";
import {
  PhArrowRight,
  PhCheckCircle,
  PhWarningCircle,
  PhGameController,
  PhFlask,
} from "@phosphor-icons/vue";
import OptimizeSignalAside from "@/pages/optimizeSignalAndImpedancePage/aside/OptimizeSignalAside.vue";
import OptimizeSignalAudioAndImpedancePanel from "@/components/audioAndImpedancePanel/OptimizeSignalAudioAndImpedancePanel.vue";
import CHANNEL_ASSIGNMENT from "../../config/channelAssignment.json";
import { ROUTES } from "@/utils/routes";
import { useRoute } from "vue-router";
import dolphinControllerSvg from "@/features/eeg-demo/assets/support_dolphin_controller.svg";

// ---- STATE ----

useConfigureParticipantId();
useWebsocketConnection();

const route = useRoute();

const channelAssignment = computed(
  () => CHANNEL_ASSIGNMENT[channelConfig.value!],
);

const channelConfig = ref<string | null>("H");

const {
  startSignalQualityCheck,
  signalRMS,
  isImpedanceCheckRunning,
  impedanceCheckChannel,
  runImpedanceCheck,
  stopRecording,
} = useOpenBCIUtils();

const preventUnloadWarningDialog = ref(false);

const isAudioAndImpedancePanelOpen = ref(false);

const reactiveSignalRMS = ref<SerialDataRMS>(signalRMS.value);

const baseModel = ref(null);
const svg: Ref<d3.Selection<
  SVGImageElement,
  unknown,
  HTMLElement,
  any
> | null> = ref(null);
const tooltip: Ref<d3.Selection<BaseType, unknown, HTMLElement, any> | null> =
  ref(null);
const circles: Ref<d3.Selection<
  SVGCircleElement,
  { id: string; x: number; y: number; r: number },
  SVGImageElement,
  unknown
> | null> = ref(null);

const isOverAllSignalQualitySufficient = computed(
  () => !nodeData.value.some((node) => [0, 1, 2].includes(node.state)),
);

const nodeData: ComputedRef<Node[]> = computed(() => {
  //const a = reactiveSignalRMS.value;

  if (!reactiveSignalRMS.value) {
    return NODES_DEFAULT_VALUES;
  }

  // Wir betrachten von signalRMS nur A1 bis A8

  const nodes: Node[] = [];

  // console.log(reactiveSignalRMS.value);
  // console.log(reactiveSignalRMS.value["A1"]);
  // console.log(JSON.stringify(reactiveSignalRMS.value));

  for (const key in reactiveSignalRMS.value) {
    switch (key) {
      case "A1":
        nodes.push({
          node_id: channelAssignment.value.A1,
          state: getSignalState({ signal: reactiveSignalRMS.value.A1 ?? 0 }),
          impedance: reactiveSignalRMS.value.A1 ?? 0,
        });
        break;
      case "A2":
        nodes.push({
          node_id: channelAssignment.value.A2,
          state: getSignalState({ signal: reactiveSignalRMS.value.A2 ?? 0 }),
          impedance: reactiveSignalRMS.value.A2 ?? 0,
        });
        break;
      case "A3":
        nodes.push({
          node_id: channelAssignment.value.A3,
          state: getSignalState({ signal: reactiveSignalRMS.value.A3 ?? 0 }),
          impedance: reactiveSignalRMS.value.A3 ?? 0,
        });
        break;
      case "A4":
        nodes.push({
          node_id: channelAssignment.value.A4,
          state: getSignalState({ signal: reactiveSignalRMS.value.A4 ?? 0 }),
          impedance: signalRMS.value.A4 ?? 0,
        });
        break;
      case "A5":
        nodes.push({
          node_id: channelAssignment.value.A5,
          state: getSignalState({ signal: reactiveSignalRMS.value.A5 ?? 0 }),
          impedance: reactiveSignalRMS.value.A5 ?? 0,
        });
        break;
      case "A6":
        nodes.push({
          node_id: channelAssignment.value.A6,
          state: getSignalState({ signal: reactiveSignalRMS.value.A6 ?? 0 }),
          impedance: reactiveSignalRMS.value.A6 ?? 0,
        });
        break;
      case "A7":
        nodes.push({
          node_id: channelAssignment.value.A7,
          state: getSignalState({ signal: reactiveSignalRMS.value.A7 ?? 0 }),
          impedance: reactiveSignalRMS.value.A7 ?? 0,
        });
        break;
      case "A8":
        nodes.push({
          node_id: channelAssignment.value.A8,
          state: getSignalState({ signal: reactiveSignalRMS.value.A8 ?? 0 }),
          impedance: reactiveSignalRMS.value.A8 ?? 0,
        });
        break;
    }
  }

  return nodes;
});

watch(
  () => nodeData.value,
  () => updateCircles(),
);

// ---- LIFECYCLE HOOKS ----

onMounted(() => {
  window.addEventListener("beforeunload", handleBeforeUnload);

  const urlParams = new URLSearchParams(window.location.search);
  channelConfig.value = urlParams.get("wlmtdoqtqe");

  initializeD3();

  // Start the signal quality check in the background
  startSignalQualityCheck();
});

// ---- METHODS ----

const initializeD3 = () => {
  console.log("Initializing D3");
  svg.value = d3
    .select(baseModel.value)
    .append("image")
    .attr("xlink:href", require("@/assets/baseModel.png"))
    .attr("width", 1000)
    .attr("height", 500);
  tooltip.value = d3.select(".tooltip");

  svg.value = d3.select(baseModel.value);

  if (!svg.value) {
    return;
  }

  circles.value = svg.value
    .selectAll("circle")
    .data(NODES)
    .enter()
    .append("circle")
    .attr("id", (d: Node2) => `node-${d.id}`)
    .attr("cx", (d: Node2) => d.x)
    .attr("cy", (d: Node2) => d.y)
    .attr("r", (d: Node2) => d.r)
    .attr("class", "node");

  updateCircles();
};

const updateCircles = () => {
  if (!baseModel.value) {
    return;
  }

  svg.value = d3.select(baseModel.value);

  if (svg.value === null) {
    return;
  }

  svg.value
    .selectAll("circle")
    .data(nodeData.value, (d: any) => d.node_id)
    .join(
      (enter: any) =>
        enter
          .append("circle")
          .attr("class", (d: Node) => `node ${stateToClass(d.state)}`)
          .attr(
            "cx",
            (d: Node) => NODES.find((n) => n.id === d.node_id)?.x || 0,
          )
          .attr(
            "cy",
            (d: Node) => NODES.find((n) => n.id === d.node_id)?.y || 0,
          )
          .attr("r", 12)
          .on("mouseover", handleMouseOver)
          .on("mouseout", handleMouseOut),
      (update: any) =>
        update.attr("class", (d: any) => `node ${stateToClass(d.state)}`),
    );
};

const handleMouseOut = (event: MouseEvent) => {
  if (!tooltip.value || !svg.value) {
    return;
  }

  tooltip.value.style("opacity", 0);
  d3.select(event.target as SVGCircleElement).attr("r", 12); // Reset radius

  // Remove desaturation from all circles
  svg.value.selectAll("circle").classed("desaturated", false);
};

const handleMouseOver = (event: MouseEvent, d: Node) => {
  if (!tooltip.value || !svg.value) {
    return;
  }
  console.log(d);

  tooltip.value
    .style("opacity", 1)
    .html(
      `Node ID: ${d.node_id}<br/>State: ${stateToClass(
        d.state,
      )}<br/>µRMS: ${d.impedance}`,
    )
    .style("left", `${event.offsetX + 200}px`)
    .style("top", `${event.offsetY + 300}px`);

  // Select the current circle element using D3's event handling
  d3.select(event.target as SVGCircleElement).attr("r", 14); // Enlarge on hover

  // Desaturate other circles
  svg.value
    .selectAll("circle")
    .filter((node: any) => node.node_id !== d.node_id)
    .classed("desaturated", true);
};

// TODO - Move to utils; Make Array Constant
const stateToClass = (state: number) => {
  const stateClasses = ["off", "bad", "moderate", "better", "good"];
  return stateClasses[state] || "unknown";
};

const handleBeforeUnload = (event: BeforeUnloadEvent) => {
  const confirmationMessage =
    "Are you sure you want to leave? Changes you made may not be saved.";

  console.log(preventUnloadWarningDialog.value);
  event.returnValue = confirmationMessage; // Standard for most browsers
  if (!preventUnloadWarningDialog.value) {
    event.returnValue = confirmationMessage; // Standard for most browsers
  }
  return confirmationMessage; // For some browsers
};
const handleRedirectToRecording = async () => {
  isAudioAndImpedancePanelOpen.value = true;
};

const handleRedirectToDemo = () => {
  navigateToRestricted(ROUTES.DEMO, route.query);
};

const handleRedirectToSandbox = () => {
  navigateToRestricted(ROUTES.SANDBOX, route.query);
}
</script>

<template>
  <BasePage heading="Adjust Position">
    <OptimizeSignalAside
      style="position: absolute; top: 150px; left: 70px; width: fit-content"
    />

    <p
      style="
        color: #737373;
        text-align: center;
        font-weight: 500;
        font-size: 18px;
      "
    >
      Please adjust the headset until most of the electrodes <br />have a good
      connection, as indicated by the color in the picture.
    </p>

    <div
      class="headphones"
      style="
        max-height: 320px;
        align-items: center;
        display: flex;
        justify-content: center;
      "
    >
      <!-- Device Check Content -->

      <svg
        ref="baseModel"
        width="1000"
        height="500"
        style="
          position: relative;
          right: -11px;
          scale: 0.79;
          top: 15px;
          z-index: 900;
        "
      ></svg>
      <div class="tooltip"></div>
    </div>

    <VCard
      class="rounded-pill d-flex justify-start align-center pl-3 pr-4 mb-8"
      style="height: 40px"
      :color="isOverAllSignalQualitySufficient ? '#dff5e0' : '#ffe7ea'"
    >
      <PhWarningCircle
        v-if="!isOverAllSignalQualitySufficient"
        size="24"
        class="mr-2"
        color="#E72321"
      />
      <PhCheckCircle v-else size="24" class="mr-2" color="#68a772" />

      <p
        style="
          color: #737373;
          text-align: center;
          font-weight: 500;
          font-size: 15px;
        "
      >
        {{
          !isOverAllSignalQualitySufficient
            ? "Overall signal quality insufficient"
            : "You are good to go"
        }}
      </p>
    </VCard>

    <VRow class="mb-2" style="gap: 16px; max-height: 60px">
      <v-btn v-on:click="handleRedirectToRecording" :append-icon="PhArrowRight">
        Start Recording
      </v-btn>
    </VRow>

    <p
      style="
        font-size: 13px;
        color: #939393;
        text-align: center;
        max-width: 600px;
      "
    >
      An impedance check of the electrodes will be performed. This may take a
      minute. <br />Afterwards, the recording is started and you can start with
      your task.
    </p>

    <VRow justify="center" class="mt-6 mb-4">
      <VCard
        max-width="520"
        class="pa-2"
      >
        <div class="d-flex align-center">
          <!-- Dolphin Mascot -->
          <img
            :src="dolphinControllerSvg"
            alt="Demo mascot"
            style="width: 56px; height: 56px; flex-shrink: 0;"
            class="mr-4"
          />

          <!-- Content Section -->
          <div class="flex-grow-1 mr-4">
            <p class="text-subtitle-1 mb-1" style="font-weight: 600; color: rgba(0, 0, 0, 0.87);">
              Try ASSR EEG Demo
            </p>
            <p class="mb-0" style="font-size: 13px; color: #939393; font-weight: 500;">
              Experience brain-controlled gaming. Test in Demo Mode or experiment in Sandbox.
            </p>
          </div>

          <!-- Buttons Section -->
          <div class="d-flex flex-column" style="flex-shrink: 0; gap: 4px;">
            <v-btn
              size="small"
              :prepend-icon="PhGameController"
              @click="handleRedirectToDemo"
              style="min-width: 120px; justify-content: flex-start;"
            >
              Demo Mode
            </v-btn>
            <v-btn
              size="small"
              :prepend-icon="PhFlask"
              @click="handleRedirectToSandbox"
              style="min-width: 120px; justify-content: flex-start;"
            >
              Sandbox
            </v-btn>
          </div>
        </div>
      </VCard>
    </VRow>
  </BasePage>

  <OptimizeSignalAudioAndImpedancePanel
    v-if="isAudioAndImpedancePanelOpen"
    :is-setup="true"
    :impedance-check-channel="impedanceCheckChannel"
    :is-impedance-check-running="isImpedanceCheckRunning"
    :run-impedance-check="runImpedanceCheck"
    :stop-recording="stopRecording"
    :next-route="ROUTES.RECORDING"
    :impedance-panel-description="`Resistance measurements for each electrode.<br />You will be able to start your session after this step.`"
  />
</template>
<style>
.node {
  fill-opacity: 0.8;
  stroke: white;
  stroke-width: 2;
}
.off {
  fill: gray;
}
.bad {
  fill: red;
}
.moderate {
  fill: #f09837;
}
.better {
  fill: #a1c720;
}
.good {
  fill: #008f00;
}

.tooltip {
  position: absolute;
  text-align: left;
  width: auto;
  padding: 8px 20px;
  font-size: 12px;
  color: #000000;
  font-weight: 500;
  border-radius: 12px;
  pointer-events: none; /* Don't block mouse events */
  opacity: 0; /* Hidden by default */
  background: rgba(255, 255, 255, 0.5);
  box-shadow: 0 4px 32px 0 rgba(106, 107, 131, 0.37);
  backdrop-filter: blur(7px);
  -webkit-backdrop-filter: blur(7px);
  z-index: 5000;
}

.desaturated {
  opacity: 0.5;
}
</style>
