import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  Req,
} from '@nestjs/common';
import { TrackingService } from './tracking.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WebhookDto } from './dto/webhook.dto';

@UseGuards(JwtAuthGuard)
@Controller('tracking')
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  @Get(':number')
  async track(@Param('number') number: string, @Req() req: any) {
    const organization = req.user?.organization;
    return this.trackingService.trackNumber(number, organization);
  }

  @Get('containers/active')
  async active(@Req() req: any) {
    const organization = req.user?.organization;
    return this.trackingService.activeContainers(organization);
  }

  @Post('webhook')
  async webhook(@Body() dto: WebhookDto) {
    return this.trackingService.webhook(dto);
  }
}
