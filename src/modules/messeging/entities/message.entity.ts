import { Entity, PrimaryColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';

@Entity('Message')
export class Message {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'fromId' })
  fromId: string;

  @Column({ name: 'toId' })
  toId: string;

  @Column({ name: 'conversationId' })
  conversationId: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  receivedAt: Date | null;

  // Relations (using string-based relation to avoid circular imports)
  @ManyToOne('Conversation', 'messages')
  @JoinColumn({ name: 'conversationId' })
  conversation: any;
}