import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountingConnection } from './entities/accounting-connection.entity';
import { AccountingMapping } from './entities/accounting-mapping.entity';
import { AccountingSyncLog } from './entities/accounting-sync-log.entity';
import { AccountingService } from './accounting.service';
import { AccountingController } from './accounting.controller';
import { AccountingEventListener } from './accounting-event.listener';
import { AccountingSyncService } from './accounting-sync.service';
import { AccountingProviderRegistry } from './providers/accounting-provider.registry';
import { XeroProvider } from './providers/xero/xero.provider';
import { SageProvider } from './providers/sage/sage.provider';
import { QuickBooksProvider } from './providers/quickbooks/quickbooks.provider';
import { ZohoProvider } from './providers/zoho/zoho.provider';
import { FreshBooksProvider } from './providers/freshbooks/freshbooks.provider';
import { Invoice } from '../payments/entities/invoice.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { Guest } from '../bookings/entities/guest.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AccountingConnection,
      AccountingMapping,
      AccountingSyncLog,
      Invoice,
      Payment,
      Booking,
      Guest,
    ]),
  ],
  providers: [
    XeroProvider,
    SageProvider,
    QuickBooksProvider,
    ZohoProvider,
    FreshBooksProvider,
    AccountingProviderRegistry,
    AccountingService,
    AccountingEventListener,
    AccountingSyncService,
  ],
  controllers: [AccountingController],
  exports: [AccountingService],
})
export class AccountingModule {}
