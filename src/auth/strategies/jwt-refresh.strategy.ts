import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(req: any, payload: any) {
    const refreshToken = ExtractJwt.fromAuthHeaderAsBearerToken()(req);

    // Ensure we have a valid token
    if (!refreshToken) {
      return null;
    }

    // The token is already extracted without the Bearer prefix by passport-jwt
    return {
      userId: payload.sub,
      role: payload.role,
      organization: payload.organization,
      warehouseId: payload.warehouseId ?? null,
      isPartner: payload.isPartner ?? false,
      isCustomer: payload.isCustomer ?? false,
      refreshToken: refreshToken,
    };
  }
}
