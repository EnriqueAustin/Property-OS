import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { RefundsService } from './refunds.service';
import { RefundsController } from './refunds.controller';
import { Payment } from './entities/payment.entity';
import { PaymentSettings } from './entities/payment-settings.entity';
import { Refund } from './entities/refund.entity';
import { Invoice } from './entities/invoice.entity';
import { BookingsModule } from '../bookings/bookings.module';
import { PropertiesModule } from '../properties/properties.module';
import { InvoicesService } from './invoices.service';
import { InvoicesController } from './invoices.controller';
import { CurrencyService } from './currency.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, PaymentSettings, Refund, Invoice]),
    forwardRef(() => BookingsModule),
    PropertiesModule,
  ],
  providers: [PaymentsService, RefundsService, InvoicesService, CurrencyService],
  controllers: [PaymentsController, RefundsController, InvoicesController],
  exports: [PaymentsService, RefundsService, InvoicesService, CurrencyService, TypeOrmModule],
})
export class PaymentsModule {}
