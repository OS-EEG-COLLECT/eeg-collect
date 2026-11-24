const express = require("express");
const path = require("path");
const cors = require("cors");
const formidable = require("express-formidable");
const fs = require("fs");
const { DataFilter, FilterTypes } = require("brainflow");

const app = express();
const PORT = process.env.PORT || 8081;

app.use(cors());
app.use(formidable());

const RECORDINGS_DIR = path.join(__dirname, "recordings");

// All values below come from the browser and end up in a file path,
// so every part is checked against a fixed pattern before it is used.
const SAVE_CSV_PATTERNS = {
  researcherId: /^researcher-\d+$/, // folder name from websocket.js, e.g. "researcher-3"
  studyId: /^study-\d+$/, // e.g. "study-12"
  participantId: /^[A-Za-z0-9_-]{1,64}$/, // same rule as TESTER_ID_PATTERN in websocket.js
  startTime: /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/, // e.g. "2026-11-22_10-15-03"
  fileName: /^[A-Za-z0-9_-]{1,200}\.csv$/, // only letters, digits, "-", "_" and the .csv ending
};

const isValidField = (key, value) =>
  typeof value === "string" && SAVE_CSV_PATTERNS[key].test(value);

app.post("/save-csv", (req, res) => {
  const { fileName, csvContent, researcherId, studyId, participantId, startTime } = req.fields;

  if (!isValidField("fileName", fileName) || typeof csvContent !== "string") {
    return res.status(400).json({ error: "Invalid file name or content" });
  }

  // If the frontend told us which session this belongs to, save next to the
  // rest of that session's files (Recording.csv, Setup.csv). Otherwise fall
  // back to the flat recordings folder.
  const sessionFields = { researcherId, studyId, participantId, startTime };
  const hasSessionFolder = Object.values(sessionFields).some(Boolean);

  if (
    hasSessionFolder &&
    !Object.entries(sessionFields).every(([key, value]) => isValidField(key, value))
  ) {
    return res.status(400).json({ error: "Invalid session folder" });
  }

  const targetDir = hasSessionFolder
    ? path.join(RECORDINGS_DIR, researcherId, studyId, participantId, startTime)
    : RECORDINGS_DIR;

  // Session folders are created by websocket.js when a session starts.
  // Writing into a folder that does not exist is not allowed.
  if (!fs.existsSync(targetDir)) {
    return res.status(404).json({ error: "Session folder not found" });
  }

  // last safety net: the final path must stay inside the recordings folder
  const targetFile = path.resolve(targetDir, fileName);
  if (!targetFile.startsWith(path.resolve(RECORDINGS_DIR) + path.sep)) {
    return res.status(400).json({ error: "Invalid file path" });
  }

  fs.writeFile(targetFile, csvContent, (err) => {
    if (err) {
      console.error("Error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
    console.log("File saved");
    res.status(200).json({ message: "File saved successfully" });
  });
});

app.post("/raw-eeg-data", (req, res) => {
  // Array of numbers
  const data = req.fields.data;

  console.log(data);

  data.map((arr) => {
    if (!arr) {
      return;
    }
    DataFilter.performBandPass(
      arr,
      250,
      1.0,
      30.0,
      2,
      FilterTypes.BUTTERWORTH_ZERO_PHASE,
      0,
    );
  });

  console.log(data);

  // Send the filtered data back to the client
  res.status(200).json({ filteredData: data });
});

// Recordings are NOT served publicly here. Researchers download them through the
// login-protected endpoint /api/studies/:id/download in websocket.js.

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
