require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { createServer } = require('http');
const { Server } = require('socket.io');

// Importar rotas
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/usuarios');
const nutritionistRoutes = require('./routes/nutricionistas');
const chatRoutes = require('./routes/chat');
const goalsRoutes = require('./routes/metas');

// Configuração do Express
const app = express();
const httpServer = createServer(app);

// Configuração do Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Middlewares
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());

// Rotas
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/nutricionistas', nutritionistRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/metas', goalsRoutes);

// Rota de saúde
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', timestamp: new Date() });
});

// Manipulação de conexões WebSocket
io.on('connection', (socket) => {
  console.log('Novo cliente conectado:', socket.id);

  // Entrar em uma sala de chat
  socket.on('join_chat', (data) => {
    const { userId, nutriId } = data;
    const roomId = [userId, nutriId].sort().join('_');
    socket.join(roomId);
    console.log(`Usuário ${socket.id} entrou na sala ${roomId}`);
  });

  // Enviar mensagem
  socket.on('send_message', (data) => {
    const { userId, nutriId, message } = data;
    const roomId = [userId, nutriId].sort().join('_');
    io.to(roomId).emit('receive_message', {
      userId,
      nutriId,
      message,
      timestamp: new Date()
    });
  });

  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
  });
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📡 WebSocket disponível em ws://localhost:${PORT}`);
});

module.exports = { app, io };
