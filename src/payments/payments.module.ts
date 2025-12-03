import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import axios, { AxiosInstance } from 'axios';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { Payment, PaymentSchema } from './payments.schema';
import { PartnersModule } from '../partners/partners.module';
import { ConfigModule } from '../config/config.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Payment.name, schema: PaymentSchema }]),
    PartnersModule,
    ConfigModule,
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    {
      provide: 'HUBTEL_HTTP_CLIENT',
      inject: [ConfigService],
      useFactory: (configService: ConfigService): AxiosInstance => {
        const apiId = configService.get<string>('HUBTEL_API_ID');
        const apiKey = configService.get<string>('HUBTEL_API_KEY');

        if (!apiId || !apiKey) {
          throw new Error(
            'HUBTEL_API_ID and HUBTEL_API_KEY must be set in environment variables',
          );
        }

        const credentials = Buffer.from(`${apiId}:${apiKey}`).toString(
          'base64',
        );

        return axios.create({
          baseURL: 'https://payproxyapi.hubtel.com',
          headers: {
            Authorization: `Basic ${credentials}`,
          },
        });
      },
    },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
