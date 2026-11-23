import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Pet } from '../../pets/entities/pet.entity';

export type AlertType = 'ZONE_EXIT' | 'LINK_LOSS';
export type AlertStatus = 'active' | 'resolved';

@Entity('alerts')
export class Alert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  userId: string;

  @Index()
  @Column()
  petId: string;

  @ManyToOne(() => Pet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'petId' })
  pet: Pet;

  @Column()
  deviceId: string;

  @Column({ type: 'text', nullable: true })
  zoneId: string | null;

  @Index()
  @Column({ type: 'text' })
  type: AlertType;

  @Index()
  @Column({ type: 'text', default: 'active' })
  status: AlertStatus;

  @Column({ type: 'boolean', default: false })
  acknowledged: boolean;

  @Column({ type: 'datetime', nullable: true })
  acknowledgedAt: Date | null;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'text', nullable: true })
  detailsJson: string | null;

  @CreateDateColumn()
  triggeredAt: Date;

  @Column({ type: 'datetime', nullable: true })
  resolvedAt: Date | null;
}
