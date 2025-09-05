import { Entity, PrimaryColumn, Column, OneToMany } from 'typeorm';

@Entity('Conversation')
export class Conversation {
  @PrimaryColumn('uuid')
  id: string;

  @Column('text', { array: true })
  userIds: string[];

  @Column({ type: 'varchar', nullable: true })
  title: string | null;

  @Column({ type: 'uuid', nullable: true })
  serviceId: string | null;

  // Relations (using string-based relation to avoid circular imports)
  @OneToMany('Message', 'conversation')
  messages: any[];
}
