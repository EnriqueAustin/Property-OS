import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, LessThan } from 'typeorm';
import { AccountingConnection, AccountingConnectionStatus } from './entities/accounting-connection.entity';
import { AccountingMapping, AccountingSyncStatus, AccountingEntityType } from './entities/accounting-mapping.entity';
import { AccountingService } from './accounting.service';

@Injectable()
export class AccountingSyncService {
  private readonly logger = new Logger(AccountingSyncService.name);

  constructor(
    @InjectRepository(AccountingConnection)
    private connectionsRepo: Repository<AccountingConnection>,
    @InjectRepository(AccountingMapping)
    private mappingsRepo: Repository<AccountingMapping>,
    private readonly accountingService: AccountingService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async retryFailedSyncs() {
    const activeConnections = await this.connectionsRepo.find({
      where: { status: AccountingConnectionStatus.ACTIVE },
    });

    for (const conn of activeConnections) {
      if (!conn.settings?.auto_sync_enabled) continue;

      const failedMappings = await this.mappingsRepo.find({
        where: {
          connection_id: conn.id,
          sync_status: AccountingSyncStatus.FAILED,
        },
        take: 10,
        order: { updated_at: 'ASC' },
      });

      for (const mapping of failedMappings) {
        try {
          switch (mapping.entity_type) {
            case AccountingEntityType.INVOICE:
              await this.accountingService.syncInvoice(conn.id, mapping.internal_id);
              break;
            case AccountingEntityType.PAYMENT:
              await this.accountingService.syncPayment(conn.id, mapping.internal_id);
              break;
            default:
              break;
          }
        } catch (err: any) {
          this.logger.warn(
            `Retry sync failed for ${mapping.entity_type} ${mapping.internal_id}: ${err.message}`,
          );
        }
      }
    }
  }
}
