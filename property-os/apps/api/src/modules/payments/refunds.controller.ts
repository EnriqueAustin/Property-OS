import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { RefundsService } from './refunds.service';
import { PropertyGuard } from '../../common/guards/property.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { Permission } from '../../common/permissions/permissions.enum';
import { CreateRefundDto, ApproveRefundDto, RejectRefundDto } from './dto/refund.dto';

@Controller('properties/:propertyId/refunds')
@UseGuards(PropertyGuard)
export class RefundsController {
  constructor(private readonly refunds: RefundsService) {}

  @Post()
  @RequirePermission(Permission.PAYMENTS_MANAGE)
  create(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Body() dto: CreateRefundDto,
    @Req() req: any,
  ) {
    const userId = req.user?.userId ?? req.user?.sub;
    return this.refunds.createRefund(propertyId, userId, dto);
  }

  @Get()
  @RequirePermission(Permission.PAYMENTS_VIEW)
  list(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Query() query: any,
  ) {
    return this.refunds.listRefunds(propertyId, query);
  }

  @Get(':refundId')
  @RequirePermission(Permission.PAYMENTS_VIEW)
  getOne(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Param('refundId', new ParseUUIDPipe()) refundId: string,
  ) {
    return this.refunds.getRefundById(refundId, propertyId);
  }

  @Patch(':refundId/approve')
  @RequirePermission(Permission.PAYMENTS_MANAGE)
  approve(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Param('refundId', new ParseUUIDPipe()) refundId: string,
    @Body() dto: ApproveRefundDto,
    @Req() req: any,
  ) {
    const userId = req.user?.userId ?? req.user?.sub;
    return this.refunds.approveRefund(refundId, propertyId, userId, dto);
  }

  @Patch(':refundId/reject')
  @RequirePermission(Permission.PAYMENTS_MANAGE)
  reject(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Param('refundId', new ParseUUIDPipe()) refundId: string,
    @Body() dto: RejectRefundDto,
    @Req() req: any,
  ) {
    const userId = req.user?.userId ?? req.user?.sub;
    return this.refunds.rejectRefund(refundId, propertyId, userId, dto);
  }

  @Patch(':refundId/process')
  @RequirePermission(Permission.PAYMENTS_MANAGE)
  process(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Param('refundId', new ParseUUIDPipe()) refundId: string,
    @Req() req: any,
  ) {
    const userId = req.user?.userId ?? req.user?.sub;
    return this.refunds.processRefund(refundId, propertyId, userId);
  }
}
