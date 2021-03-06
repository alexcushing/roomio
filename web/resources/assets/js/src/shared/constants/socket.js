// socket server to connect to
// export const SOCKET_SERVER = 'http://localhost:3000';
// export const SOCKET_SERVER = 'http://roomio-socket.us-west-2.elasticbeanstalk.com/';

export const SOCKET_SERVER = process.env.SOCKET;

// socket events
export const NEW_MESSAGE = 'new_message';
export const SEND_MESSAGE = 'send_message';
export const USER_CONNECTED = 'user_connected';
export const JOIN_ROOM = 'join_room';
export const LEAVE_ROOM = 'leave_room';
