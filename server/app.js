const http = require('http');
const path = require('path');
const express = require('express');
const { Server } = require('socket.io');
const { RoomManager } = require('./rooms');
const { attachSocketHandlers, broadcastRoom } = require('./sockets');

function createGameServer() {
  const app = express();
  const httpServer = http.createServer(app);
  const io = new Server(httpServer);
  const rooms = new RoomManager();

  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.use('/vendor/three', express.static(path.join(__dirname, '..', 'node_modules', 'three', 'build')));

  attachSocketHandlers(io, rooms);

  const timer = setInterval(() => {
    for (const room of rooms.cleanup()) broadcastRoom(io, room);
  }, 5000);

  return {
    app,
    httpServer,
    io,
    rooms,
    close() {
      clearInterval(timer);
    },
  };
}

module.exports = { createGameServer };
