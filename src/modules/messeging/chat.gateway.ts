import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MessageService } from './message.service';

interface OnlineUser {
  userId: string;
  socketId: string;
  name: string;
}

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:5173'],
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private onlineUsers: OnlineUser[] = [];

  constructor(private readonly messageService: MessageService) {}

  handleConnection(client: Socket) {
    console.log(`Socket connected: ${client.id}`);
    // Wait for client to send 'register_user' event with userId and name
    client.on('register_user', (data: { userId: string; name: string }) => {
      console.log(`User registered: userId=${data.userId}, name=${data.name}, socketId=${client.id}`);
      if (!this.onlineUsers.find(u => u.userId === data.userId)) {
        this.onlineUsers.push({ userId: data.userId, socketId: client.id, name: data.name });
        this.broadcastOnlineUsers();
      }
    });
  }

  handleDisconnect(client: Socket) {
    console.log(`Socket disconnected: ${client.id}`);
    this.onlineUsers = this.onlineUsers.filter(u => u.socketId !== client.id);
    this.broadcastOnlineUsers();
  }

  @SubscribeMessage('get_online_users')
  handleGetOnlineUsers(@ConnectedSocket() client: Socket) {
    console.log(`Sending online users to socket: ${client.id}`);
    client.emit('online_users', this.onlineUsers);
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @MessageBody() data: { toUserId: string; fromUserId: string; fromName: string; message: string; pendingId?: string },
    @ConnectedSocket() client: Socket,
  ) {
    console.log(`Message sent from ${data.fromUserId} to ${data.toUserId}: ${data.message} (pendingId: ${data.pendingId})`);
    // Save to DB
    await this.messageService.saveMessage({
      fromUserId: data.fromUserId,
      toUserId: data.toUserId,
      fromName: data.fromName,
      message: data.message,
    });

    const recipient = this.onlineUsers.find(u => u.userId === data.toUserId);
    if (recipient) {
      console.log(`Delivering message to recipient socket: ${recipient.socketId}`);
      this.server.to(recipient.socketId).emit('receive_message', {
        fromUserId: data.fromUserId,
        toUserId: data.toUserId,
        fromName: data.fromName,
        message: data.message,
        pendingId: data.pendingId,
      });
    } else {
      console.log(`Recipient userId ${data.toUserId} not online.`);
    }
    // Echo back to sender for delivery confirmation
    console.log(`Echoing message back to sender socket: ${client.id}`);
    client.emit('receive_message', {
      fromUserId: data.fromUserId,
      toUserId: data.toUserId,
      fromName: data.fromName,
      message: data.message,
      pendingId: data.pendingId,
    });
  }

  @SubscribeMessage('fetch_messages')
  async handleFetchMessages(
    @MessageBody() data: { userA: string; userB: string },
    @ConnectedSocket() client: Socket,
  ) {
    const messages = await this.messageService.getMessages(data.userA, data.userB);
    client.emit('messages_history', { userA: data.userA, userB: data.userB, messages });
  }

  private broadcastOnlineUsers() {
    this.server.emit('online_users', this.onlineUsers);
  }
}