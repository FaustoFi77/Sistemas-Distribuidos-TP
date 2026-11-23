import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';

@Entity('pets')
export class Pet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  name: string;

  @Column()
  species: string;

  @Column({ type: 'text', nullable: true })
  breed: string | null;

  @Column({ type: 'text', nullable: true })
  birthDate: string | null;

  @Column({ type: 'text', nullable: true })
  photoUrl: string | null;

  @Index()
  @Column({ type: 'text', nullable: true, unique: true })
  deviceId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
