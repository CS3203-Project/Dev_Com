import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  PrimaryColumn,
} from 'typeorm';
import { EmailType } from '../../../common/enums/email-type.enum';

@Entity('notification')
export class Notification {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'userId', nullable: true })
  userId?: string;

  @Column()
  to: string;

  @Column()
  subject: string;

  @Column({ type: 'text' })
  html: string;

  @Column({
    type: 'enum',
    enum: EmailType,
  })
  emailType: EmailType;

  @Column({ type: 'timestamp', nullable: true })
  sentAt: Date;

  @Column({ type: 'timestamp' })
  createdAt: Date;

  @Column({ type: 'boolean', default: false })
  isRead: boolean;
}