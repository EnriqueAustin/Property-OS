import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Request,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { PropertyGuard } from '../../common/guards/property.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { Permission } from '../../common/permissions/permissions.enum';
import { StaffService } from './staff.service';
import { InviteStaffDto, UpdateStaffRoleDto, UpdateStaffPermissionsDto } from './dto/staff.dto';

@Controller('properties/:propertyId/staff')
@UseGuards(PropertyGuard)
export class StaffController {
  constructor(private staffService: StaffService) {}

  @Get()
  @RequirePermission(Permission.STAFF_VIEW)
  list(@Param('propertyId', ParseUUIDPipe) propertyId: string) {
    return this.staffService.listStaff(propertyId);
  }

  @Get('permissions-schema')
  @RequirePermission(Permission.STAFF_VIEW)
  permissionsSchema() {
    return this.staffService.getPermissionSchema();
  }

  @Post()
  @RequirePermission(Permission.STAFF_MANAGE)
  invite(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: InviteStaffDto,
  ) {
    return this.staffService.inviteStaff(propertyId, dto);
  }

  @Patch(':membershipId/role')
  @RequirePermission(Permission.STAFF_MANAGE)
  updateRole(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('membershipId', ParseUUIDPipe) membershipId: string,
    @Body() dto: UpdateStaffRoleDto,
  ) {
    return this.staffService.updateRole(propertyId, membershipId, dto);
  }

  @Patch(':membershipId/permissions')
  @RequirePermission(Permission.STAFF_MANAGE)
  updatePermissions(
    @Request() req,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('membershipId', ParseUUIDPipe) membershipId: string,
    @Body() dto: UpdateStaffPermissionsDto,
  ) {
    return this.staffService.updatePermissions(
      propertyId,
      membershipId,
      dto,
      req.propertyUser,
    );
  }

  @Patch(':membershipId/toggle-active')
  @RequirePermission(Permission.STAFF_MANAGE)
  toggleActive(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('membershipId', ParseUUIDPipe) membershipId: string,
  ) {
    return this.staffService.toggleActive(propertyId, membershipId);
  }

  @Delete(':membershipId')
  @RequirePermission(Permission.STAFF_MANAGE)
  remove(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('membershipId', ParseUUIDPipe) membershipId: string,
  ) {
    return this.staffService.removeStaff(propertyId, membershipId);
  }
}
