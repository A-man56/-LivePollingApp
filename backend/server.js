import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

/** In-memory store */
const polls = new Map(); // pollId -> pollObject

const makePoll = (teacherSocketId) => ({
  id: genId(),
  teacherSocketId,
  students: new Map(), // socketId -> {name}
  state: "idle", // 'idle' | 'asking' | 'results'
  current: null, // {q, options[], votes{}, responses{}, startAt, timeLimitMs, timeout}
  history: [], // [{q, options, votes, total}]
  chat: [] // {from, text, ts}
});

function genId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function canAskNext(poll) {
  if (!poll.current) return true; // no question yet
  const totalStudents = poll.students.size;
  const answered = Object.keys(poll.current.responses).length;
  return poll.state !== "asking" && (answered === totalStudents || totalStudents === 0);
}

/** REST (optional: health + poll lookup) */
app.get("/health", (_, res) => res.json({ ok: true }));
app.get("/poll/:id", (req, res) => {
  const poll = polls.get(req.params.id);
  if (!poll) return res.status(404).json({ error: "not found" });
  res.json({ id: poll.id, state: poll.state });
});

/** Socket handling */
io.on("connection", (socket) => {
  // Teacher creates poll
  socket.on("teacher:createPoll", (_, cb) => {
    const poll = makePoll(socket.id);
    polls.set(poll.id, poll);
    socket.join(poll.id);
    cb({ pollId: poll.id });
    io.to(poll.id).emit("poll:meta", { pollId: poll.id });
  });

  // Student joins poll
  socket.on("student:join", ({ pollId, name }, cb) => {
    const poll = polls.get(pollId);
    if (!poll) return cb?.({ ok: false, error: "Invalid poll" });
    poll.students.set(socket.id, { name });
    socket.join(pollId);
    io.to(pollId).emit("poll:students", Array.from(poll.students.values()));
    cb?.({ ok: true });
    // If a question is live, tell the new student
    if (poll.state === "asking" && poll.current) {
      const cur = poll.current;
      socket.emit("poll:question", {
        q: cur.q, options: cur.options, timeLimitMs: cur.timeLimitMs,
        startedAt: cur.startAt
      });
    }
  });

  // Teacher asks question (only when allowed)
  socket.on("teacher:ask", ({ pollId, q, options, timeLimitSec = 60 }, cb) => {
    const poll = polls.get(pollId);
    if (!poll) return cb?.({ ok: false, error: "Invalid poll" });
    if (socket.id !== poll.teacherSocketId) return cb?.({ ok: false, error: "Not teacher" });
    if (!canAskNext(poll)) return cb?.({ ok: false, error: "Cannot ask yet" });
    const timeLimitMs = Math.max(5, +timeLimitSec) * 1000;
    if (!q || !Array.isArray(options) || options.length < 2) {
      return cb?.({ ok: false, error: "Need q + 2 options" });
    }
    // clear prev timeout if any
    if (poll.current?.timeout) clearTimeout(poll.current.timeout);

    const votes = Object.fromEntries(options.map(o => [o, 0]));
    poll.current = {
      q, options, votes, responses: {}, startAt: Date.now(), timeLimitMs, timeout: null
    };
    poll.state = "asking";

    io.to(pollId).emit("poll:question", {
      q, options, timeLimitMs, startedAt: poll.current.startAt
    });

    // Auto-show results after time limit
    poll.current.timeout = setTimeout(() => {
      showResults(pollId);
    }, timeLimitMs);

    cb?.({ ok: true });
  });

  // Student submits answer
  socket.on("student:answer", ({ pollId, option }, cb) => {
    const poll = polls.get(pollId);
    if (!poll || poll.state !== "asking" || !poll.current) {
      return cb?.({ ok: false, error: "No active question" });
    }
    const cur = poll.current;
    if (!cur.options.includes(option)) {
      return cb?.({ ok: false, error: "Invalid option" });
    }
    if (cur.responses[socket.id]) {
      return cb?.({ ok: false, error: "Already answered" });
    }
    cur.responses[socket.id] = option;
    cur.votes[option] += 1;

    // send partial live results to everyone
    io.to(pollId).emit("poll:partial", { votes: cur.votes, total: Object.keys(cur.responses).length });

    // If all students answered, show results immediately
    if (Object.keys(cur.responses).length === poll.students.size) {
      showResults(pollId);
    }
    cb?.({ ok: true });
  });

  // Teacher requests next (only allowed after results or if none asked yet)
  socket.on("teacher:nextAllowed", ({ pollId }, cb) => {
    const poll = polls.get(pollId);
    cb?.({ allowed: !!poll && canAskNext(poll) });
  });

  // Teacher removes a student
  socket.on("teacher:removeStudent", ({ pollId, name }, cb) => {
    const poll = polls.get(pollId);
    if (!poll || socket.id !== poll.teacherSocketId) return cb?.({ ok: false });
    const target = [...poll.students.entries()].find(([_, s]) => s.name === name);
    if (target) {
      const [sockId] = target;
      poll.students.delete(sockId);
      io.to(sockId).emit("poll:kicked");
      io.sockets.sockets.get(sockId)?.leave(pollId);
      io.to(pollId).emit("poll:students", Array.from(poll.students.values()));
      cb?.({ ok: true });
    } else cb?.({ ok: false, error: "Not found" });
  });

  // Chat
  socket.on("chat:send", ({ pollId, from, text }) => {
    const poll = polls.get(pollId);
    if (!poll || !text?.trim()) return;
    const msg = { from, text: text.trim(), ts: Date.now() };
    poll.chat.push(msg);
    io.to(pollId).emit("chat:message", msg);
  });

  // Past results
  socket.on("poll:history", ({ pollId }, cb) => {
    const poll = polls.get(pollId);
    if (!poll) return cb?.({ ok: false });
    cb?.({ ok: true, history: poll.history });
  });

  socket.on("disconnect", () => {
    // Clean student lists and auto-finish if needed
    for (const poll of polls.values()) {
      if (poll.students.has(socket.id)) {
        poll.students.delete(socket.id);
        io.to(poll.id).emit("poll:students", Array.from(poll.students.values()));
        // If everyone who hadn't answered left, we can close early
        if (poll.state === "asking" && poll.current) {
          const all = poll.students.size;
          const answered = Object.keys(poll.current.responses).length;
          if (answered >= all) showResults(poll.id);
        }
      }
      if (poll.teacherSocketId === socket.id) {
        // End poll for everyone
        io.to(poll.id).emit("poll:ended");
        if (poll.current?.timeout) clearTimeout(poll.current.timeout);
        polls.delete(poll.id);
      }
    }
  });
});

function showResults(pollId) {
  const poll = polls.get(pollId);
  if (!poll || !poll.current) return;
  if (poll.current.timeout) clearTimeout(poll.current.timeout);
  poll.state = "results";
  const cur = poll.current;
  const total = Object.keys(cur.responses).length;
  io.to(pollId).emit("poll:results", { q: cur.q, options: cur.options, votes: cur.votes, total });
  poll.history.push({ q: cur.q, options: cur.options, votes: cur.votes, total, endedAt: Date.now() });
  poll.current = { ...poll.current, timeout: null }; // keep snapshot until next ask
}

const PORT = process.env.PORT || 3500;
server.listen(PORT, () => console.log("Backend on", PORT));
