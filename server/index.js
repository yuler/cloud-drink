const { createGameServer } = require('./app');

const PORT = process.env.PORT || 3000;
const { httpServer } = createGameServer();

httpServer.listen(PORT, () => {
  console.log(`Cloud Drink listening on http://localhost:${PORT}`);
});
