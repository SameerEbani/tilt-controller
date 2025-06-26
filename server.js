const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      callback(null, origin); // ✅ Use dynamic origin (secure it further if needed)
    },
  },
});


// Serve static files from public folder
app.use(express.static(path.join(__dirname, 'public')));

// Serve mobile controller
app.get("/soc/:id", (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'mobile.html'));
});

// Generate QR Code
app.get("/generate", async (req, res) => {
  const { text } = req.query;
  const baseURL = process.env.BASE_URL || "http://localhost:3000";
  try {
    const url = text || baseURL;
    const qr = await QRCode.toDataURL(url);
    const base64Image = qr.split(",")[1];
    res.type("image/png");
    res.send(Buffer.from(base64Image, "base64"));
  } catch (err) {
    console.error("QR Code generation error:", err);
    res.status(500).send("QR Code generation failed");
  }
});

// Pairing logic
const pairings = {};

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
  socket.emit("socket_id", socket.id);

  socket.on("register", (desktopId) => {
    const desktopSocket = io.sockets.sockets.get(desktopId);
    if (desktopSocket) {
      pairings[socket.id] = desktopId;
      io.to(desktopId).emit("scanconnected");
      console.log(`📱 Mobile ${socket.id} linked with 🖥️ Desktop ${desktopId}`);
    } else {
      console.warn(`⚠️ Desktop ID ${desktopId} not found`);
    }
  });

  socket.on("sliderMove", (data) => {
    const desktopId = pairings[socket.id];
    if (desktopId && typeof data.x === "number") {
      io.to(desktopId).emit("sliderUpdate", data);
    }
  });

  socket.on("triggerSpin", () => {
    const desktopId = pairings[socket.id];
    if (desktopId) {
      io.to(desktopId).emit("triggerSpin");
    }
  });

  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.id);
    delete pairings[socket.id];
  });
});

// Use dynamic port for Render
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
