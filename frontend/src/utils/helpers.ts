import { useRoute, useRouter } from "vue-router";
import {
  AugmentedPartial,
  CytonBoardCommands,
  OpenBCISerialData,
} from "@/utils/openBCISerialTypes";

export const URLs = { WEB_SOCKET_URL: "wss://exg.iism.kit.edu/websocket/" };

export const URL_PARAMS = {
  participantIdParam: "AbXHPCkszw",
  passPhrase: "aHCWFRZvlU",
  channelConfig: "wlmtdoqtqe",
};

const DECODED_PASSPHRASE = "iism4ever";

export const getIsPassphraseValid = async (): Promise<boolean> => {
  const urlRoute = useRoute();
  const router = useRouter();

  await router.isReady();

  const passphrase = urlRoute.query[URL_PARAMS.passPhrase];
  if (passphrase) {
    return atob(`${passphrase}`) === DECODED_PASSPHRASE;
  }

  return false;
};

export const getReadableTimestamp = () => {
  const now = new Date(); // Current date and time

  // Get individual components of the date
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0"); // months are 0-indexed
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");

  // Format the date and time in a readable format (YYYY-MM-DD HH:MM:SS)
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

// ---- START CYTON HELPER FUNCTIONS

export const decodeCytonData = (message: any[]) => {
  const str = message.toString();
  const numbers = str.split(",").map(Number);

  const chunk = new Uint8Array(numbers);
  const byteArray = chunk.slice(1, -1);
  const sampleNumber = chunk[1];
  let data: AugmentedPartial<
    OpenBCISerialData,
    keyof Omit<
      OpenBCISerialData,
      "sampleNumber" | "timestamp" | "Accel0" | "Accel1" | "Accel2"
    >
  > = {
    sampleNumber: sampleNumber,
    timestamp: new Date().getTime(),
    Accel0: interpret16bitAsInt32(chunk.slice(26, 28)) * 0.000125,
    Accel1: interpret16bitAsInt32(chunk.slice(28, 30)) * 0.000125,
    Accel2: interpret16bitAsInt32(chunk.slice(30, 32)) * 0.000125,
  };

  for (let i = 2; i <= 24; i += 3) {
    const channelData =
      interpret24bitAsInt32(byteArray.slice(i - 1, i + 2)) * 0.0223517445;
    const channelName = `A${Math.ceil((i - 1) / 3)}`;
    data = { ...data, channelName: channelData };
  }

  return data;
};

export const interpret24bitAsInt32 = (byteArray: Uint8Array) => {
  if (byteArray.length !== 3) {
    throw new Error("Byte array must have exactly 3 elements");
  }

  let newInt =
    ((0xff & byteArray[0]) << 16) |
    ((0xff & byteArray[1]) << 8) |
    (0xff & byteArray[2]);

  if ((newInt & 0x00800000) > 0) {
    newInt |= 0xff000000;
  } else {
    newInt &= 0x00ffffff;
  }

  return newInt;
};

export const interpret16bitAsInt32 = (byteArray: Uint8Array) => {
  let newInt = ((0xff & byteArray[0]) << 8) | (0xff & byteArray[1]);

  if ((newInt & 0x00008000) > 0) {
    newInt |= 0xffff0000;
  } else {
    newInt &= 0x0000ffff;
  }

  return newInt;
};

export const logErrorDetails = (
  error: any,
  buffer: any,
  isRecording: boolean,
) => {
  console.log("Error occurred:", error.message);
  console.log("Stack trace:", error.stack);
  console.log("Connection status:", isRecording);
  console.log("Last buffer contents:", buffer); // Add your buffer or relevant data
  console.log("Timestamp of error:", new Date());
};

export const getEncodedCytonCommand = (command: CytonBoardCommands) =>
  new TextEncoder().encode(command);

// ---- END CYTON HELPER FUNCTIONS
