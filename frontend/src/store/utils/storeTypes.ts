export type State = {
  participantId: string | null;
  isParticipantIdModalOpen: boolean;
  webSocket: WebSocket | null;
  mode: ConnectionMode | null;
  webSerial: WebSerial;
  sessionFolder: SessionFolder | null;
};

export type SessionFolder = {
  researcherId: string;
  studyId: string;
  participantId: string;
  startTime: string;
};

export enum ConnectionMode {
  DAISY = "daisy",
  CYTON = "cyton",
}

export type WebSerial = {
  port?: SerialPort;
  reader?: ReadableStreamDefaultReader<any>;
};
