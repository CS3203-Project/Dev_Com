import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity()
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  fromUserId: string;

  @Column()
  toUserId: string;

  @Column()
  fromName: string;

  @Column()
  message: string;

  @CreateDateColumn()
  createdAt: Date;
}
