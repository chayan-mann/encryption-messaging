require('dotenv').config();
const WebSocket = require('ws');
const express = require('express');
const cors = require('cors');
const WebSocketHandler = require('./websocket-handler');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());

// HTTP Routes
app.get('/health', (req, res) => {
  res.json({ status: 'Server is running' });
});

app.get('/api/status', (req, res) => {
  const storage = require('./storage');
  res.json(storage.getStats());
});

// Start HTTP server
const server = app.listen(PORT, () => {
  console.log(`\n🚀 HTTP Server running on http://localhost:${PORT}`);
  console.log(`🔌 WebSocket endpoint: ws://localhost:${PORT}`);
  console.log(`📊 Status: http://localhost:${PORT}/api/status\n`);
});

// WebSocket Server
const wss = new WebSocket.Server({ server });

wss.on('connection', (socket) => {
  let userId = null;

  socket.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      // First message must be registration
      if (!userId) {
        if (data.type === 'register') {
          userId = data.userId;
          if (!userId) {
            socket.send(JSON.stringify({
              type: 'error',
              message: 'userId is required'
            }));
            return;
          }
          WebSocketHandler.handleConnection(socket, userId);
        } else {
          socket.send(JSON.stringify({
            type: 'error',
            message: 'You must register first with type: "register" and userId'
          }));
        }
      } else {
        // Handle other messages
        WebSocketHandler.handleMessage(socket, userId, message);
      }
    } catch (error) {
      socket.send(JSON.stringify({
        type: 'error',
        message: `Server error: ${error.message}`
      }));
    }
  });

  socket.on('close', () => {
    if (userId) {
      WebSocketHandler.handleDisconnect(userId);
    }
  });

  socket.on('error', (error) => {
    console.error('WebSocket error:', error.message);
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});