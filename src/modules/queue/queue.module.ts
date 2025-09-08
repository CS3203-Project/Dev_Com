import { Module } from '@nestjs/common';
import { QueueService } from './queue.service.js';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [EmailModule],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
