import { Server } from "socket.io";
import express from "express";
import { fileURLToPath } from "node:url";

const app = express();
const __dirname = fileURLToPath(new URL(".", import.meta.url));

const users = new Map<string, string>();

const server = app.listen(3000, () => {
  console.log("listening on *:3000");
});

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

io.on("connection", (socket) => {
  console.log(`🔌 New socket connected: ${socket.id}`);

  // -------------------------------------------------
  // 👤  Login – store username → socket.id mapping
  // -------------------------------------------------
  socket.on("login", (username: string) => {
    // Allow same username on multiple tabs; just map socket.id to username
    users.set(socket.id, username);
    console.log(`✅ ${username} logged in (socket ${socket.id})`);

    // Notify the logging‑in client that login succeeded
    socket.emit("login success", username);

    // Notify everyone (including the new user) about the current user list (unique usernames)
    const uniqueUsers = Array.from(new Set(users.values()));
    io.emit("user list", uniqueUsers);
    socket.broadcast.emit("user connected", username);
  });

  // -------------------------------------------------
  // 💬  Private text message (already in your code)
  // -------------------------------------------------
  socket.on(
    "message",
    (payload: { message: string; toUsername: string; timestamp: string }) => {
      const fromUsername = users.get(socket.id);
      if (!fromUsername) return; // not logged in

      const targetEntry = Array.from(users.entries()).find(
        ([, name]) => name === payload.toUsername,
      );

      if (targetEntry) {
        const [targetSocketId] = targetEntry;
        const targetPayload = {
          from: fromUsername,
          message: payload.message,
          timestamp: payload.timestamp,
        };
        // Send only to the target socket
        io.to(targetSocketId).emit("message", targetPayload);
      } else {
        socket.emit("error", `User "${payload.toUsername}" not found`);
      }
    },
  );

  // -------------------------------------------------
  // 🎥  WebRTC signalling: offer / answer / ICE
  // -------------------------------------------------
  // A user asks the server for the socket id of another user
  socket.on(
    "requestOffer",
    (toUsername: string, cb: (sid: string | null) => void) => {
      const entry = Array.from(users.entries()).find(
        ([, name]) => name === toUsername,
      );
      cb(entry ? entry[0] : null); // return the socket.id of the callee (or null)
    },
  );

  // Caller sends an SDP offer
  socket.on("offer", (data: { toSocketId: string; sdp: string }) => {
    console.log(`🔁 Offer from ${socket.id} → ${data.toSocketId}`);
    io.to(data.toSocketId).emit("offer", {
      fromSocketId: socket.id,
      sdp: data.sdp,
    });
  });

  // Callee replies with an SDP answer
  socket.on("answer", (data: { toSocketId: string; sdp: string }) => {
    console.log(`🔁 Answer from ${socket.id} → ${data.toSocketId}`);
    io.to(data.toSocketId).emit("answer", {
      fromSocketId: socket.id,
      sdp: data.sdp,
    });
  });

  // Both sides exchange ICE candidates
  socket.on(
    "ice-candidate",
    (data: { toSocketId: string; candidate: RTCIceCandidateInit }) => {
      io.to(data.toSocketId).emit("ice-candidate", {
        fromSocketId: socket.id,
        candidate: data.candidate,
      });
    },
  );

  const removeUser = (socketId: string) => {
    const username = users.get(socketId);
    if (!username) return;

    users.delete(socketId);

    console.log(`🔚 ${username} (${socketId}) removed`);

    // Broadcast updated unique user list
    io.emit("user list", Array.from(new Set(users.values())));

    // Only notify disconnected if no other socket uses this username
    const stillConnected = Array.from(users.values()).includes(username);

    if (!stillConnected) {
      socket.broadcast.emit("user disconnected", username);
    }
  };

  // Explicit logout
  socket.on("logout", () => {
    removeUser(socket.id);
  });

  // Socket disconnected (close tab, network lost, etc.)
  socket.on("disconnect", (reason) => {
    console.log(`🔌 Socket disconnected: ${socket.id}, reason: ${reason}`);
    removeUser(socket.id);
  });
});

app.get("/", (req, res) => {
  res.sendFile(`${__dirname}/index.html`);
});
