import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Persisted refresh-token session.
 *
 * The row `id` is the refresh JWT's `jti`. Tokens are issued in a rotation
 * "family": every refresh revokes the presented token and issues a new one in
 * the same family. Presenting an already-revoked token is treated as reuse and
 * the whole family is revoked. Only the SHA-256 hash of the token is stored.
 */
@Entity('refresh_tokens')
@Index('idx_refresh_tokens_user', ['user_id'])
@Index('idx_refresh_tokens_family', ['family_id'])
export class RefreshToken {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'uuid' })
  family_id: string;

  @Column({ type: 'varchar', length: 64 })
  token_hash: string;

  @Column({ type: 'timestamp with time zone' })
  expires_at: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  revoked_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  replaced_by: string | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;
}
