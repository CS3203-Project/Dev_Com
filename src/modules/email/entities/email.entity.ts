import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
} from 'typeorm';
import { EmailType } from '../../../common/enums/email-type.enum';

@Entity('email_queue')
export class EmailQueue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'userId' })
  userId: string;

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
}