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
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, unlinkSync, mkdirSync } from 'fs';
import { randomUUID } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Property } from './entities/property.entity';
import { RoomType } from '../inventory/entities/room-type.entity';
import { PropertyGuard } from '../../common/guards/property.guard';

const UPLOADS_DIR = join(process.cwd(), 'uploads');
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

if (!existsSync(UPLOADS_DIR)) mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = diskStorage({
  destination: UPLOADS_DIR,
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    cb(null, `${randomUUID()}${ext}`);
  },
});

function fileFilter(_req: any, file: Express.Multer.File, cb: any) {
  if (!ALLOWED_MIMES.includes(file.mimetype)) {
    return cb(new BadRequestException('Only jpg, png, and webp images are allowed'), false);
  }
  cb(null, true);
}

@Controller('properties/:propertyId')
@UseGuards(PropertyGuard)
export class UploadController {
  constructor(
    @InjectRepository(Property)
    private propertiesRepo: Repository<Property>,
    @InjectRepository(RoomType)
    private roomTypesRepo: Repository<RoomType>,
  ) {}

  @Post('photos')
  @UseInterceptors(FilesInterceptor('files', 10, { storage, fileFilter, limits: { fileSize: MAX_FILE_SIZE } }))
  async uploadPropertyPhotos(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files?.length) throw new BadRequestException('No files uploaded');

    const property = await this.propertiesRepo.findOneByOrFail({ id: propertyId });
    const filenames = files.map((f) => f.filename);
    property.photos = [...(property.photos || []), ...filenames];
    await this.propertiesRepo.save(property);

    return { photos: property.photos };
  }

  @Delete('photos/:filename')
  async deletePropertyPhoto(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('filename') filename: string,
  ) {
    const property = await this.propertiesRepo.findOneByOrFail({ id: propertyId });
    property.photos = (property.photos || []).filter((p) => p !== filename);
    await this.propertiesRepo.save(property);

    const filePath = join(UPLOADS_DIR, filename);
    if (existsSync(filePath)) unlinkSync(filePath);

    return { photos: property.photos };
  }

  @Post('room-types/:rtId/photos')
  @UseInterceptors(FilesInterceptor('files', 10, { storage, fileFilter, limits: { fileSize: MAX_FILE_SIZE } }))
  async uploadRoomTypePhotos(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('rtId', ParseUUIDPipe) rtId: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files?.length) throw new BadRequestException('No files uploaded');

    const roomType = await this.roomTypesRepo.findOneByOrFail({ id: rtId, property_id: propertyId });
    const filenames = files.map((f) => f.filename);
    roomType.photos = [...(roomType.photos || []), ...filenames];
    await this.roomTypesRepo.save(roomType);

    return { photos: roomType.photos };
  }

  @Delete('room-types/:rtId/photos/:filename')
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
}
