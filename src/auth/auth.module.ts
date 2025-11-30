import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { UserModule } from '../user/users.module';
import { CustomersModule } from '../customers/customers.module';
import { PartnersModule } from '../partners/partners.module';
import { MailerModule } from '../mailer/mailer.module';
import { LocationFilterService } from './location-filter.service';
import { WarehousesModule } from '../warehouses/warehouses.module';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: '15m' },
      }),
    }),
    UserModule,
    CustomersModule,
    PartnersModule,
    MailerModule,
    WarehousesModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    JwtRefreshStrategy,
    LocationFilterService,
  ],
  exports: [AuthService, LocationFilterService],
})
export class AuthModule {}
