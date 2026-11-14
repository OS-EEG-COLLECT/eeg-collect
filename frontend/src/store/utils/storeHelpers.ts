import { State } from "@/store/utils/storeTypes";
import { InjectionKey } from "vue";
import { Store } from "vuex";

export const injectionKey: InjectionKey<Store<State>> = Symbol("vuex-key");

export const STATE_DEFAULT_CONFIG: State = {
  participantId: null,
  isParticipantIdModalOpen: false,
  webSocket: null,
  mode: null,
  webSerial: { port: undefined, reader: undefined },
  sessionFolder: null,
};
