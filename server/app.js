const http = require('http');
const path = require('path');
const express = require('express');

function createGameServer() {
  const app = express();
  const httpServer = http.createServer(app);
  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.use('/vendor/three', express.static(path.join(__dirname, '..', 'node_modules', 'three', 'build')));
  return { app, httpServer };
}

module.exports = { createGameServer };
