import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
  Res,
  NotFoundException,
} from '@nestjs/common';
import { type Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs';
import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole, Organization } from '../user/users.schema';
import { CreateDocumentDto } from './dto/create-document.dto';
import { CurrentOrganization } from '../auth/organization.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  async findAll(@CurrentOrganization() organization: Organization) {
    return this.documentsService.findAll(organization);
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/documents',
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
      fileFilter: (req, file, cb) => {
        const allowedMimes = [
          'application/pdf',
          'image/jpeg',
          'image/jpg',
          'image/png',
          'image/gif',
          'image/webp',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ];
        if (allowedMimes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              'Invalid file type. Only PDF, images, Word, and Excel files are allowed.',
            ),
            false,
          );
        }
      },
    }),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
    @CurrentOrganization() organization: Organization,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Create document record
    const documentData: Partial<CreateDocumentDto> = {
      name: body.name,
      type: body.type,
      fileUrl: `/uploads/documents/${file.filename}`,
      fileSize: file.size,
      containerId: body.containerId || undefined,
      shipmentId: body.shipmentId || undefined,
      description: body.description || undefined,
    };

    return this.documentsService.create(documentData, organization);
  }

  @Post()
  async create(
    @Body() dto: CreateDocumentDto,
    @CurrentOrganization() organization: Organization,
  ) {
    return this.documentsService.create(dto, organization);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentOrganization() organization: Organization,
  ) {
    return this.documentsService.findOne(id, organization);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @CurrentOrganization() organization: Organization,
  ) {
    return this.documentsService.remove(id, organization);
  }

  @Get('shipment/:id')
  async forShipment(
    @Param('id') id: string,
    @CurrentOrganization() organization: Organization,
  ) {
    return this.documentsService.forShipment(id, organization);
  }

  @Get('container/:id')
  async forContainer(
    @Param('id') id: string,
    @CurrentOrganization() organization: Organization,
  ) {
    return this.documentsService.forContainer(id, organization);
  }
  @Get('view/:filename')
  async viewFile(
    @Param('filename') filename: string,
    @Res() res: Response,
    @CurrentOrganization() organization: Organization,
  ) {
    // Sanitize filename to prevent directory traversal
    const sanitizedFilename = filename.replace(/^.*[\\\/]/, '');
    const filePath = join(process.cwd(), 'uploads/documents', sanitizedFilename);

    // Verify file exists
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('File not found');
    }

    // Serve file
    return res.sendFile(filePath);
  }
}
