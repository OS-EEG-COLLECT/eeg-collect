import { InjectionKey } from "vue";
import { createStore, Store, useStore as baseUseStore } from "vuex";

import { ConnectionMode, SessionFolder, State } from "@/store/utils/storeTypes";
import { injectionKey, STATE_DEFAULT_CONFIG } from "@/store/utils/storeHelpers";

const store = createStore<State>({
  state: STATE_DEFAULT_CONFIG,
  getters: {
    webSerialPort: (state): SerialPort | undefined => state.webSerial.port,
    webSerialReader: (state): ReadableStreamDefaultReader | undefined =>
      state.webSerial.reader,
  },
  mutations: {
    setParticipantId(state, payload: { participantId: string }) {
      state.participantId = payload.participantId;
    },
    setParticipantIdModalOpen(state) {
      state.isParticipantIdModalOpen = true;
    },
    setParticipantIdModalClose(state) {
      state.isParticipantIdModalOpen = false;
    },
    setWebSocket(state, payload: { websocket: WebSocket }) {
      state.webSocket = payload.websocket;
    },
    setSessionFolder(state, payload: { sessionFolder: SessionFolder }) {
      state.sessionFolder = payload.sessionFolder;
    },
    setConnectionMode(state, payload: { connectionMode: ConnectionMode }) {
      state.mode = payload.connectionMode;
    },
    setWebSerialPort(state, payload: { port: SerialPort }) {
      state.webSerial.port = payload.port;
    },
    setWebSerialReader(
      state,
      payload: { reader: ReadableStreamDefaultReader<any> },
    ) {
      state.webSerial.reader = payload.reader;
    },
  },
});

export default store;

export const useStore = () => baseUseStore(injectionKey);
