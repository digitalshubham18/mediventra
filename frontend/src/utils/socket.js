// import { io } from 'socket.io-client';

// const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

// let socket = null;

// export const connectSocket = (userId, role) => {
//   socket = io(SOCKET_URL, {
//     transports: ['websocket'],
//     reconnection: true,
//     reconnectionAttempts: 5,
//     reconnectionDelay: 1000,
//   });

//   socket.on('connect', () => {
//     console.log('🔌 Socket connected:', socket.id);
//     socket.emit('join_room', `user_${userId}`);
//     socket.emit('join_room', role);
//     socket.emit('join_room', 'all');
//   });

//   socket.on('disconnect', () => {
//     console.log('🔌 Socket disconnected');
//   });

//   return socket;
// };

// export const getSocket = () => socket;

// export const disconnectSocket = () => {
//   if (socket) {
//     socket.disconnect();
//     socket = null;
//   }
// };

// export const emitSOS = (data) => {
//   if (socket) socket.emit('sos_trigger', data);
// };

import { io } from 'socket.io-client';

let socket = null;
let boundUserId = null; // which user the current socket connection belongs to

export const initSocket = (userId) => {
  // Already connected AND for the same user — reuse it.
  if (socket?.connected && boundUserId === userId) return socket;

  // Either no socket yet, or it belongs to a *different* user (e.g. someone
  // switched accounts without a full page reload) — tear down the old
  // connection first so we never stay joined to the previous user's room.
  if (socket) { socket.disconnect(); socket = null; }

  boundUserId = userId;
  socket = io(process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000', {
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
  });
  socket.on('connect', () => {
    console.log('🔌 Socket connected:', socket.id);
    if (userId) socket.emit('join_user_room', userId);
  });
  socket.on('disconnect', () => console.log('🔌 Socket disconnected'));
  socket.on('connect_error', err => console.error('Socket error:', err.message));
  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) { socket.disconnect(); socket = null; }
  boundUserId = null;
};
