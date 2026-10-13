import {
  Controller,
  Post,
  Delete,
  Param,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { join } from 'path';
import { existsSync, unlinkSync, mkdirSync } from 'fs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Property } from './entities/property.entity';
import { RoomType } from '../inventory/entities/room-type.entity';
import { Room } from '../inventory/entities/room.entity';
import { PropertyGuard } from '../../common/guards/property.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { Permission } from '../../common/permissions/permissions.enum';
import { persistUploadedImages } from './upload-image.util';

const UPLOADS_DIR = join(process.cwd(), 'uploads');
const MAX_FILE_SIZE = 5 * 1024 * 1024;

if (!existsSync(UPLOADS_DIR)) mkdirSync(UPLOADS_DIR, { recursive: true });

// Files are buffered in memory so their real type can be verified from magic
// bytes before anything is written to disk (audit S8). The client MIME type is
// not trusted; the stored extension and random filename are derived server-side
// by `persistUploadedImages`.
const storage = memoryStorage();

@Controller('properties/:propertyId')
@UseGuards(PropertyGuard)
export class UploadController {
  constructor(
    @InjectRepository(Property)
    private propertiesRepo: Repository<Property>,
    @InjectRepository(RoomType)
    private roomTypesRepo: Repository<RoomType>,
    @InjectRepository(Room)
    private roomsRepo: Repository<Room>,
  ) {}

  @Post('photos')
  @RequirePermission(Permission.SETTINGS_MANAGE)
  @UseInterceptors(FilesInterceptor('files', 10, { storage, limits: { fileSize: MAX_FILE_SIZE } }))
  async uploadPropertyPhotos(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files?.length) throw new BadRequestException('No files uploaded');

    const property = await this.propertiesRepo.findOneByOrFail({ id: propertyId });
    const filenames = persistUploadedImages(files, UPLOADS_DIR);
    property.photos = [...(property.photos || []), ...filenames];
    await this.propertiesRepo.save(property);

    return { photos: property.photos };
  }

  @Delete('photos/:filename')
  @RequirePermission(Permission.SETTINGS_MANAGE)
  async deletePropertyPhoto(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('filename') filename: string,
  ) {
    if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
      throw new BadRequestException('Invalid filename');
    }

    const property = await this.propertiesRepo.findOneByOrFail({ id: propertyId });
    property.photos = (property.photos || []).filter((p) => p !== filename);
    await this.propertiesRepo.save(property);

    const filePath = join(UPLOADS_DIR, filename);
    const resolvedPath = require('path').resolve(filePath);
    const resolvedUploads = require('path').resolve(UPLOADS_DIR);
    if (!resolvedPath.startsWith(resolvedUploads)) {
      throw new BadRequestException('Invalid filename');
    }
    if (existsSync(filePath)) unlinkSync(filePath);

    return { photos: property.photos };
  }

  @Post('room-types/:rtId/photos')
  @RequirePermission(Permission.INVENTORY_MANAGE)
  @UseInterceptors(FilesInterceptor('files', 10, { storage, limits: { fileSize: MAX_FILE_SIZE } }))
  async uploadRoomTypePhotos(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('rtId', ParseUUIDPipe) rtId: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files?.length) throw new BadRequestException('No files uploaded');

    const roomType = await this.roomTypesRepo.findOneByOrFail({ id: rtId, property_id: propertyId });
    const filenames = persistUploadedImages(files, UPLOADS_DIR);
    roomType.photos = [...(roomType.photos || []), ...filenames];
    await this.roomTypesRepo.save(roomType);

    return { photos: roomType.photos };
  }

  @Delete('room-types/:rtId/photos/:filename')
  @RequirePermission(Permission.INVENTORY_MANAGE)
  async deleteRoomTypePhoto(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('rtId', ParseUUIDPipe) rtId: string,
    @Param('filename') filename: string,
  ) {
    const roomType = await this.roomTypesRepo.findOneByOrFail({ id: rtId, property_id: propertyId });
    roomType.photos = (roomType.photos || []).filter((p) => p !== filename);
    await this.roomTypesRepo.save(roomType);

    const filePath = join(UPLOADS_DIR, filename);
    if (existsSync(filePath)) unlinkSync(filePath);

    return { photos: roomType.photos };
  }

  @Post('rooms/:roomId/photos')
  @RequirePermission(Permission.INVENTORY_MANAGE)
  @UseInterceptors(FilesInterceptor('files', 10, { storage, limits: { fileSize: MAX_FILE_SIZE } }))
  async uploadRoomPhotos(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files?.length) throw new BadRequestException('No files uploaded');

    const room = await this.roomsRepo.findOneByOrFail({ id: roomId, property_id: propertyId });
    const filenames = persistUploadedImages(files, UPLOADS_DIR);
    room.photos = [...(room.photos || []), ...filenames];
    await this.roomsRepo.save(room);

    return { photos: room.photos };
  }

  @Delete('rooms/:roomId/photos/:filename')
  @RequirePermission(Permission.INVENTORY_MANAGE)
  async deleteRoomPhoto(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Param('filename') filename: string,
  ) {
    if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
      throw new BadRequestException('Invalid filename');
    }

    const room = await this.roomsRepo.findOneByOrFail({ id: roomId, property_id: propertyId });
    room.photos = (room.photos || []).filter((p) => p !== filename);
    await this.roomsRepo.save(room);

    const filePath = join(UPLOADS_DIR, filename);
    const resolvedPath = require('path').resolve(filePath);
    const resolvedUploads = require('path').resolve(UPLOADS_DIR);
    if (!resolvedPath.startsWith(resolvedUploads)) {
      throw new BadRequestException('Invalid filename');
    }
    if (existsSync(filePath)) unlinkSync(filePath);

    return { photos: room.photos };
  }
}
