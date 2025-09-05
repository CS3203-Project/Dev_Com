import { Controller, Post, Body } from '@nestjs/common';
import { MessagingGateway } from '../messeging/messaging.gateway';

@Controller('api/confirmation')
export class ConfirmationBroadcastController {
  constructor(private readonly messagingGateway: MessagingGateway) {}

  @Post('broadcast')
  broadcastConfirmation(@Body() body: { conversationId: string; confirmation: any }) {
    const { conversationId, confirmation } = body;
    this.messagingGateway.broadcastConfirmationUpdate(conversationId, confirmation);
    return { success: true };
  }
}
