import { Entity, PrimaryColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';

@Entity('Message')
export class Message {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  content: string;

  // Remove implicit foreign key constraints by using string type without relations to User
  @Column({ name: 'fromId', type: 'varchar' })
  fromId: string;

  @Column({ name: 'toId', type: 'varchar' })
  toId: string;

  @Column({ name: 'conversationId' })
  conversationId: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  receivedAt: Date | null;

  // Relations (using string-based relation to avoid circular imports)
  @ManyToOne('Conversation', 'messages', { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'conversationId' })
  conversation: any;
}