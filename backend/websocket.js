require("dotenv").config();
const http =  require("http");
const express = require("express");
const cors = require("cors");
const WebSocket = require("ws");
const fs = require("fs");
const path = require("path");
const url = require("url");
const { getPrismaClient } = require('./db');
const jwt = require("jsonwebtoken");
const bcrypt = require('bcrypt');
const archiver = require('archiver');

const port = process.env.PORT || 3000;
const SECRET_KEY = process.env.JWT_SECRET || "fallback_secret_key"; //maybe change
const RECORDINGS_DIR = path.join(__dirname, "recordings");

// Ensure the recordings directory exists
if (!fs.existsSync(RECORDINGS_DIR)) {
  fs.mkdirSync(RECORDINGS_DIR);
}

// Express Application Setup
const app = express();
app.use(cors());
app.use(express.json());

// Decodes the Authorization header (if present) and attaches the matching user to req.authUser
const attachAuthUser = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    req.authUser = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    const prisma = await getPrismaClient();
    req.authUser = await prisma.user.findUnique({ where: { id: decoded.userId } });
  } catch (error) {
    req.authUser = null;
  }

  next();
};

app.use(attachAuthUser);

// Rejects the request unless a valid, logged-in user is attached by attachAuthUser
const requireAuth = (req, res, next) => {
  if (!req.authUser) {
    return res.status(401).json({ message: "Authentication required." });
  }
  next();
};


// HTTP REST Endpoints

// Registration endpoint
app.post("/api/register", async (req, res) => {
  const { username, password, isAdmin } = req.body;

  try {
    const prisma = await getPrismaClient();

    // The very first user bootstraps the system and becomes an admin automatically.
    // Every subsequent registration requires an authenticated admin.
    const isBootstrap = (await prisma.user.count()) === 0;

    if (!isBootstrap && (!req.authUser || !req.authUser.isAdmin)) {
      return res.status(403).json({ message: "Only admins can create new users." });
    }

    const existingUser = await prisma.user.findUnique({ where: { username } });

    if (existingUser) {
      return res.status(400).json({ message: "Username already taken" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = await prisma.user.create({
      data: {
        username,
        passwordHash,
        isAdmin: isBootstrap ? true : !!isAdmin,
      },
    });

    res.status(201).json({ message: "User was successfully registered", userId: newUser.id });
  } catch (error) {
    res.status(500).json({ message: "Registration error", error: error.message });
  }
})

// Rejects the request unless the logged-in user is an admin
const requireAdmin = (req, res, next) => {
  if (!req.authUser || !req.authUser.isAdmin) {
    return res.status(403).json({ message: "Admin rights required." });
  }
  next();
};

// user listing endpoint (admin only)
app.get("/api/users/list", requireAuth, requireAdmin, async (req, res) => {
  try {
    const prisma = await getPrismaClient();
    const users = await prisma.user.findMany({
      orderBy: { id: "asc" },
      select: { id: true, username: true, isAdmin: true },
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Error while fetching users", error: error.message });
  }
});

// grant / revoke admin rights (admin only)
app.patch("/api/users/:id/admin", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { isAdmin } = req.body;

  try {
    if (typeof isAdmin !== "boolean") {
      return res.status(400).json({ message: "isAdmin must be a boolean." });
    }
    if (id === req.authUser.id) {
      return res.status(400).json({ message: "You cannot change your own admin rights." });
    }

    const prisma = await getPrismaClient();
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { isAdmin },
      select: { id: true, username: true, isAdmin: true },
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Error while updating user", error: error.message });
  }
});

// user deletion endpoint (admin only) - also removes the user's studies and sessions
app.delete("/api/users/:id/delete", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);

  try {
    const prisma = await getPrismaClient();

    if (id === req.authUser.id) {
      return res.status(400).json({ message: "You cannot delete your own account." });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await prisma.$transaction([
      prisma.session.deleteMany({ where: { study: { userId: id } } }),
      prisma.study.deleteMany({ where: { userId: id } }),
      prisma.user.delete({ where: { id } }),
    ]);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: "Error while deleting user", error: error.message });
  }
});

// Login endpoint
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const prisma = await getPrismaClient();

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return res.status(401).json({ message: "Invalid login details." });
    }

    console.log("Name:", username);
    console.log("Input:", password, "DB-Hash:", user.passwordHash);

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    console.log(isPasswordValid);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid login details." });
    }

    // issue JWT Token
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      SECRET_KEY,
      { expiresIn: "8h" }
    );

    res.json({
      token,
      userId: user.id,
      username: user.username,
      isAdmin: user.isAdmin,
    });
  } catch (error) {
    console.error("Login Error Details:", error);
    res.status(500).json({ message: "Server error while logging in.", error: error.message });
  }
});

// study listing endpoint
app.get("/api/studies/list", requireAuth, async (req, res) => {
  try {
    const prisma = await getPrismaClient();

    const studies = await prisma.study.findMany({
      where: { userId: req.authUser.id },
      orderBy: { id: "desc" },
      include: { _count: { select: { sessions: true } } },
    });
    res.json(studies);
  } catch (error) {
    res.status(500).json({ message: "Error while fetching studies", error: error.message });
  }
});

// study creation endpoint
app.post("/api/studies/create", requireAuth, async (req, res) => {
  const { title, description } = req.body;

  try {
    const prisma = await getPrismaClient();

    const study = await prisma.study.create({
      data: {
        title,
        userId: req.authUser.id,
        description,
      },
    });
    res.status(201).json(study);
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ message: "Error while creating study", error: error.message });
  }
});

// study data download endpoint
app.get("/api/studies/:id/download", requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    const prisma = await getPrismaClient();

    const study = await prisma.study.findUnique({ where: { id: Number(id) } });
    if (!study) {
      return res.status(404).json({ message: "Study not found" });
    }

    if (study.userId !== req.authUser.id) {
      return res.status(403).json({ message: "You do not have access to this study." });
    }

    const studyDir = path.join(RECORDINGS_DIR, `${study.userId}`, `${study.id}`);
    if (!fs.existsSync(studyDir)) {
      return res.status(404).json({ message: "No data exists for this study yet" });
    }

    const safeTitle = study.title.replace(/[^a-z0-9]+/gi, "_");
    res.attachment(`study-${study.id}-${safeTitle}.zip`);

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (archiveError) => {
      console.error("Error while zipping study data:", archiveError);
      res.status(500).end();
    });

    archive.pipe(res);
    archive.directory(studyDir, false);
    archive.finalize();
  } catch (error) {
    res.status(500).json({ message: "Error while downloading study data", error: error.message });
  }
});

// study deletion endpoint
app.delete("/api/studies/:id/delete", requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    const prisma = await getPrismaClient();

    const study = await prisma.study.findUnique({ where: { id: Number(id) } });
    if (!study) {
      return res.status(404).json({ message: "Study not found" });
    }

    if (study.userId !== req.authUser.id) {
      return res.status(403).json({ message: "You do not have access to this study." });
    }

    await prisma.$transaction([
      prisma.session.deleteMany({ where: { studyId: Number(id) } }),
      prisma.study.delete({ where: { id: Number(id) } }),
    ]);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: "Error while deleting study", error: error.message });
  }
});



/**
 * central log-function
 * writes errors and warnings in file
 */
const writeLog = (targetDir, mode, level, contextMessage, errorDetails = "") => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level.toUpperCase()}] [MODE: ${mode}] ${contextMessage}\nDetails: ${errorDetails}\n------------------------------------------\n`;

  // live feedback in server terminal
  console.log(`[${level.toUpperCase()}] ${contextMessage}`, errorDetails ? `\nDetails: ${errorDetails}` : "");


  const logFilePath = path.join(targetDir, "session_error.log");

  fs.appendFile(logFilePath, logMessage, (fsErr) => {
    if (fsErr) {
      console.error("critical system error: logfile couldn't be written to !", fsErr);
    }
  });
};


// Create WebSocket server
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on("connection", async (ws, req) => {
  console.log("WebSocket connection established");
  const location = url.parse(req.url, true);
  const pathParts = location.pathname.split("/");
  const mode = pathParts[2];
  const participant = pathParts[3]; // Assuming the path is /websocket/participant1
  const studyId = location.query.studyId;
  console.log(`mode: ${mode} participant: ${participant} studyId: ${studyId}`);

  let prisma;
  let study;
  try {
    prisma = await getPrismaClient();
    study = await prisma.study.findUnique({ where: { id: Number(studyId) } });
  } catch (error) {
    console.error("Error while looking up study for websocket connection:", error);
    ws.close(1011, "Server error while looking up study");
    return;
  }

  if (!study) {
    console.error(`No study found for studyId: ${studyId}`);
    ws.close(1008, "Invalid study id");
    return;
  }

  const researcher = `${study.userId}`
  const studyFolder = `${study.id}`

  let hasMainRecordingStarted = false;

  // Session folder name in local time, e.g. 2026-08-28_12-44-26
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const startTime =
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;

  //creating new directory for the files
  const sessionDir = path.join(RECORDINGS_DIR, researcher, studyFolder, participant, startTime.toString());


  // ensure directory for recordings exists
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  // let the frontend know where this session's files live, so it can tell
  // other services (e.g. the CSV-saving Express server) where to write to
  ws.send(JSON.stringify({
    event: "session_folder",
    researcherId: researcher,
    studyId: studyFolder,
    participantId: participant,
    startTime: startTime.toString(),
  }));

  const fileName = `Recording.csv`;
  const filePath = path.join(sessionDir, fileName);
  const writeStream = fs.createWriteStream(filePath);

  const deviceSetupFileName = `Setup.csv`;
  const deviceSetupFilePath = path.join(sessionDir, deviceSetupFileName);
  const setupWriteStream = fs.createWriteStream(deviceSetupFilePath);


  // new sesion will be added to Prisma DB
  const newSession = await prisma.session.create({
    data: {
      studyId: study.id,
      folderPath: sessionDir
    }
  });



  if (mode === "daisy") {
    // Write the CSV header
    writeStream.write(
      "Index;Datetime;sampleNumber;timestamp;A1;A2;A3;A4;A5;A6;A7;A8;A9;A10;A11;A12;A13;A14;A15;A16;Accel0;Accel1;Accel2\n",
    );
    setupWriteStream.write(
      "Index;Datetime;sampleNumber;timestamp;A1;A2;A3;A4;A5;A6;A7;A8;A9;A10;A11;A12;A13;A14;A15;A16;Accel0;Accel1;Accel2\n",
    );
  } else if (mode === "cyton") {
    // Write the CSV header
    writeStream.write(
      "Index;Datetime;sampleNumber;timestamp;A1;A2;A3;A4;A5;A6;A7;A8;Accel0;Accel1;Accel2;Note\n",
    );
    setupWriteStream.write(
      "Index;Datetime;sampleNumber;timestamp;A1;A2;A3;A4;A5;A6;A7;A8;Accel0;Accel1;Accel2;Note\n",
    );
  }
  let index = 0;
  let previousData = null;

  ws.on("message", (message) => {
    try {
      if (message.toString() === "heartbeat") {
        return;
      }

      // catch frontend logs
      if (message.toString().startsWith("{") && message.toString().endsWith("}")) {
        const parsed = JSON.parse(message);

        if (parsed.event === "frontend_log") {
          writeLog(
            sessionDir,
            mode,
            parsed.level.toUpperCase(),
            `[Frontend] ${parsed.message}`,
            parsed.details
          );
          return;
        }
      }

      if (message.toString() === "Audio File Started") {
        index += 1;
        const datetime = new Date().toLocaleString();
        const csvRow = `${index};${datetime};;;;;;;;;;;;;;Audio Recording Started\n`;

        !hasMainRecordingStarted
            ? setupWriteStream.write(csvRow)
            : writeStream.write(csvRow);

        console.log("Audio File Started");
        return;
      }

      if (message.toString() === "Audio File Ended") {
        index += 1;
        const datetime = new Date().toLocaleString();
        const csvRow = `${index};${datetime};;;;;;;;;;;;;;Audio Recording Ended\n`;

        !hasMainRecordingStarted
            ? setupWriteStream.write(csvRow)
            : writeStream.write(csvRow);

        console.log("Audio File Ended");
        return;
      }

      if (message.toString() === "Setup Finished") {
        hasMainRecordingStarted = true;
        return;
      }

      let data;
      if (mode === "daisy") {
        data = decodeDaisyData(message);
        if (data) {
          if (data.sampleNumber % 2 === 0) {
            // Combine with previous odd sample
            if (
                previousData &&
                previousData.sampleNumber === data.sampleNumber - 1
            ) {
              const combinedData = {
                ...previousData,
                ...data,
              };
              index += 1;
              const datetime = new Date(combinedData.timestamp).toLocaleString();
              const csvRow = `${index};${datetime};${combinedData.sampleNumber};${combinedData.timestamp};${combinedData.A1};${combinedData.A2};${combinedData.A3};${combinedData.A4};${combinedData.A5};${combinedData.A6};${combinedData.A7};${combinedData.A8};${combinedData.A9};${combinedData.A10};${combinedData.A11};${combinedData.A12};${combinedData.A13};${combinedData.A14};${combinedData.A15};${combinedData.A16};${combinedData.Accel0};${combinedData.Accel1};${combinedData.Accel2}\n`;
              writeStream.write(csvRow);
              previousData = null; // Reset for next pair
            }
          } else {
            // Store odd sample data
            previousData = data;
          }
        }
      } else if (mode === "cyton") {
        data = decodeCytonData(message);

        if (!data) {
          return;
        }

        index += 1;
        const datetime = new Date(data.timestamp).toLocaleString();
        const csvRow = `${index};${datetime};${data.sampleNumber};${data.timestamp};${data.A1};${data.A2};${data.A3};${data.A4};${data.A5};${data.A6};${data.A7};${data.A8};${data.Accel0};${data.Accel1};${data.Accel2}\n`;

        hasMainRecordingStarted
            ? writeStream.write(csvRow)
            : setupWriteStream.write(csvRow);
      } else {
        // Store odd sample data
        previousData = data;
      }
    } catch (globalMsgError) {
      // catches unexpected critical errors
      writeLog(sessionDir, mode, "ERROR", "critical runtime error during stream-data-process", globalMsgError);
    }
  });

  // Security from unexpected loss of connection
  ws.on("error", (wsError) => {
    writeLog(sessionDir, mode, "ERROR", "WebSocket connection-error occurred", wsError);
  });

  ws.on("close", () => {
    writeStream.end();
    console.log(`WebSocket connection closed for participant: ${participant}`);
  });

  const decodeDaisyData = (message) => {
    const str = message.toString();
    const numbers = str.split(",").map(Number);

    const chunk = new Uint8Array(numbers);
    const odd = chunk[1] % 2 !== 0;
    const byteArray = chunk.slice(1, -1);
    const sampleNumber = chunk[1];

    const data = {
      sampleNumber,
      timestamp: new Date().getTime(),
      Accel0: 0,
      Accel1: 0,
      Accel2: 0,
    };

    if (chunk[chunk.length - 1] === 192) {
      data.Accel0 = interpret16bitAsInt32(chunk.slice(26, 28)) * 0.000125;
      data.Accel1 = interpret16bitAsInt32(chunk.slice(28, 30)) * 0.000125;
      data.Accel2 = interpret16bitAsInt32(chunk.slice(30, 32)) * 0.000125;
    }

    for (let i = 2; i <= 24; i += 3) {
      const channelData =
        interpret24bitAsInt32(byteArray.slice(i - 1, i + 2)) * 0.0223517445;
      const channelName = `A${Math.ceil((i - 1) / 3) + (odd ? 0 : 8)}`;
      data[channelName] = channelData;
    }

    return data;
  };

  const decodeCytonData = (message) => {
    const str = message.toString();
    const numbers = str.split(",").map(Number);

    const chunk = new Uint8Array(numbers);
    const byteArray = chunk.slice(1, -1);
    const sampleNumber = chunk[1];
    const data = {
      sampleNumber,
      timestamp: new Date().getTime(),
      Accel0: interpret16bitAsInt32(chunk.slice(26, 28)) * 0.000125,
      Accel1: interpret16bitAsInt32(chunk.slice(28, 30)) * 0.000125,
      Accel2: interpret16bitAsInt32(chunk.slice(30, 32)) * 0.000125,
    };

    for (let i = 2; i <= 24; i += 3) {
      const channelData =
        interpret24bitAsInt32(byteArray.slice(i - 1, i + 2)) * 0.0223517445;
      const channelName = `A${Math.ceil((i - 1) / 3)}`;
      data[channelName] = channelData;
    }

    return data;
  };
});



function interpret24bitAsInt32(byteArray) {
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
}

function interpret16bitAsInt32(byteArray) {
  let newInt = ((0xff & byteArray[0]) << 8) | (0xff & byteArray[1]);

  if ((newInt & 0x00008000) > 0) {
    newInt |= 0xffff0000;
  } else {
    newInt &= 0x0000ffff;
  }

  return newInt;
}


// Single Server Start (HTTP + WebSocket)
server.listen(port, () => {
  console.log(`HTTP Server running on http://localhost:${port}`);
  console.log(`WebSocket Server listening on ws://localhost:${port}`);
});
