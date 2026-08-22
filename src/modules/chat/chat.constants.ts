export const MESSAGE_TYPES = ['text', 'image', 'file'] as const;

export const SOCKET_EVENTS = {
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  JOIN_ROOM: 'joinRoom',
  LEAVE_ROOM: 'leaveRoom',
  SEND_MESSAGE: 'sendMessage',
  RECEIVE_MESSAGE: 'receiveMessage',
  TYPING: 'typing',
  STOP_TYPING: 'stopTyping',
  MESSAGE_READ: 'messageRead',
  ONLINE_USERS: 'onlineUsers',
  USER_ONLINE: 'online',
  USER_OFFLINE: 'offline',
} as const;
