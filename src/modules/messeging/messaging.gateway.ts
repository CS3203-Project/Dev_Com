import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { MessagingService } from './services/messaging.service';
import { CreateMessageDto } from './dto';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  },
  namespace: '/messaging',
})
export class MessagingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MessagingGateway.name);
  private connectedUsers = new Map<string, string>(); // userId -> socketId
  private activeConversations = new Map<string, string>(); // userId -> conversationId (currently viewing)

  constructor(
    @Inject(forwardRef(() => MessagingService))
    private readonly messagingService: MessagingService
  ) {}

  // Handle client connection
  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  // Handle client disconnection
  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    
    // Remove user from connected users map and active conversations
    for (const [userId, socketId] of this.connectedUsers.entries()) {
      if (socketId === client.id) {
        this.connectedUsers.delete(userId);
        this.activeConversations.delete(userId); // Clean up active conversation tracking
        this.logger.log(`User ${userId} disconnected`);
        
        // Broadcast to all connected clients that a user went offline
        this.server.emit('user:offline', { userId, status: 'offline' });
        break;
      }
    }
  }

  // User joins with their userId
  @SubscribeMessage('user:join')
  handleUserJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string }
  ) {
    const { userId } = data;
    this.connectedUsers.set(userId, client.id);
    this.logger.log(`User ${userId} joined with socket ${client.id}`);
    
    // Broadcast to all connected clients that a user came online
    this.server.emit('user:online', { userId, status: 'online' });
    
    client.emit('user:joined', { success: true, userId });
  }

  // User enters a conversation (starts viewing it)
  @SubscribeMessage('conversation:enter')
  handleConversationEnter(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string; conversationId: string }
  ) {
    const { userId, conversationId } = data;
    this.activeConversations.set(userId, conversationId);
    this.logger.log(`User ${userId} entered conversation ${conversationId}`);
    
    client.emit('conversation:entered', { success: true, conversationId });
  }

  // User leaves a conversation (stops viewing it)
  @SubscribeMessage('conversation:leave')
  handleConversationLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string }
  ) {
    const { userId } = data;
    const conversationId = this.activeConversations.get(userId);
    this.activeConversations.delete(userId);
    this.logger.log(`User ${userId} left conversation ${conversationId}`);
    
    client.emit('conversation:left', { success: true });
  }

  // Send message via WebSocket
  @SubscribeMessage('message:send')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: CreateMessageDto | any // Accept both new format with user data and legacy format
  ) {
    try {
      // Create a proper CreateMessageDto with all required fields
      const createMessageDto: CreateMessageDto = {
        content: data.content,
        fromId: data.fromId,
        toId: data.toId,
        conversationId: data.conversationId,
        // Include user data if provided (for email notifications)
        senderName: data.senderName,
        senderEmail: data.senderEmail,
        recipientName: data.recipientName,
        recipientEmail: data.recipientEmail,
      };

      this.logger.log(`Received message from ${createMessageDto.fromId} to ${createMessageDto.toId}`);
      console.log('--- [WS] message:send called ---');
      console.log('Payload:', createMessageDto);
      console.log('Connected users:', Array.from(this.connectedUsers.entries()));
      console.log('Active conversations:', Array.from(this.activeConversations.entries()));
      
      // Check if user data is provided for email notifications
      if (createMessageDto.senderEmail && createMessageDto.recipientEmail) {
        console.log('📧 User data provided with WebSocket message - email notifications enabled');
      } else {
        console.log('📧 No user data provided with WebSocket message - email notifications will be skipped');
        console.log('💡 To enable email notifications, include senderName, senderEmail, recipientName, recipientEmail in the WebSocket payload');
      }
      
      // Save message to database using existing service
      const savedMessage = await this.messagingService.sendMessage(createMessageDto);
      console.log('Message saved to DB:', savedMessage);
      
      // Emit to sender (confirmation)
      client.emit('message:sent', savedMessage);
      
      // Emit to recipient if they're online
      const recipientSocketId = this.connectedUsers.get(createMessageDto.toId);
      if (recipientSocketId) {
        console.log(`Recipient ${createMessageDto.toId} is online, socket: ${recipientSocketId}`);
        this.server.to(recipientSocketId).emit('message:received', savedMessage);
        this.logger.log(`Message delivered to recipient ${createMessageDto.toId}`);
        
        // Auto-mark as read if recipient is actively viewing this conversation
        const recipientActiveConversation = this.activeConversations.get(createMessageDto.toId);
        console.log('Recipient active conversation:', recipientActiveConversation);
        if (recipientActiveConversation === savedMessage.conversationId) {
          try {
            console.log('Recipient is actively viewing this conversation, auto-marking as read...');
            await this.messagingService.markMessageAsRead(savedMessage.id, createMessageDto.toId);
            this.logger.log(`Auto-marked message ${savedMessage.id} as read for actively viewing user ${createMessageDto.toId}`);
            
            // Emit read receipt to sender
            client.emit('message:read-receipt', {
              messageId: savedMessage.id,
              readBy: createMessageDto.toId,
              readAt: new Date().toISOString()
            });
            
            // Also emit to recipient that message was auto-marked as read
            this.server.to(recipientSocketId).emit('message:auto-read', {
              messageId: savedMessage.id,
              conversationId: savedMessage.conversationId
            });
            console.log('Auto-read events emitted');
          } catch (error) {
            this.logger.error(`Error auto-marking message as read: ${error.message}`);
            console.error('Error auto-marking as read:', error);
          }
        } else {
          console.log('Recipient is NOT actively viewing this conversation, not auto-marking as read.');
        }
      } else {
        this.logger.log(`Recipient ${createMessageDto.toId} is offline`);
        console.log(`Recipient ${createMessageDto.toId} is offline`);
      }
      
      return { success: true, message: savedMessage };
    } catch (error) {
      this.logger.error(`Error sending message: ${error.message}`);
      console.error('Error in handleSendMessage:', error);
      client.emit('message:error', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  // Mark message as read via WebSocket
  @SubscribeMessage('message:mark-read')
  async handleMarkMessageRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: string; userId: string }
  ) {
    try {
      const { messageId, userId } = data;
      
      // Mark message as read using existing service
      const updatedMessage = await this.messagingService.markMessageAsRead(messageId, userId);
      
      // Emit read receipt to sender if they're online
      const senderSocketId = this.connectedUsers.get(updatedMessage.fromId);
      if (senderSocketId) {
        this.server.to(senderSocketId).emit('message:read-receipt', {
          messageId,
          readBy: userId,
          readAt: updatedMessage.receivedAt
        });
      }
      
      client.emit('message:marked-read', { messageId, success: true });
      
      return { success: true };
    } catch (error) {
      this.logger.error(`Error marking message as read: ${error.message}`);
      client.emit('message:error', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  // Mark conversation as read via WebSocket
  @SubscribeMessage('conversation:mark-read')
  async handleMarkConversationRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; userId: string }
  ) {
    try {
      const { conversationId, userId } = data;
      
      // Mark conversation as read using existing service
      await this.messagingService.markConversationAsRead(conversationId, userId);
      
      // Emit confirmation to the user
      client.emit('conversation:marked-read', { 
        conversationId, 
        success: true 
      });
      
      // Optionally emit to other participants that someone read the conversation
      // (you can implement this if needed for more advanced read receipts)
      
      return { success: true };
    } catch (error) {
      this.logger.error(`Error marking conversation as read: ${error.message}`);
      client.emit('message:error', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  // Get connected users (for debugging)
  @SubscribeMessage('users:online')
  handleGetOnlineUsers(@ConnectedSocket() client: Socket) {
    const onlineUserIds = Array.from(this.connectedUsers.keys());
    client.emit('users:online-list', onlineUserIds);
  }

  // Check if a specific user is online
  isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  // Broadcast confirmation update to both participants in a conversation
  broadcastConfirmationUpdate(conversationId: string, confirmation: any) {
    // Find all users in this conversation
    for (const [userId, activeConvId] of this.activeConversations.entries()) {
      if (activeConvId === conversationId) {
        const socketId = this.connectedUsers.get(userId);
        if (socketId) {
          this.server.to(socketId).emit('confirmation_updated', { conversationId, confirmation });
        }
      }
    }
    this.logger.log(`Broadcasted confirmation update for conversation ${conversationId}`);
  }
}
