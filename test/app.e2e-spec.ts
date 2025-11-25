import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { UsersService } from '../src/user/users.service';
import { UserRole } from '../src/user/users.schema';
import * as bcrypt from 'bcryptjs';

describe('Container Backend (e2e)', () => {
  let app: INestApplication<App>;
  let usersService: UsersService;
  let adminToken: string;
  let staffToken: string;
  let adminRefreshToken: string;
  let staffRefreshToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('/api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    usersService = moduleFixture.get<UsersService>(UsersService);
  });

  beforeEach(async () => {
    // Clean up existing users
    await usersService.clearAllUsers();

    // Create test admin user
    const adminUser = await usersService.createStaff({
      name: 'Admin User',
      email: 'admin@test.com',
      password: 'admin123',
      role: UserRole.ADMIN,
    });

    // Create test staff user
    const staffUser = await usersService.createStaff({
      name: 'Staff User',
      email: 'staff@test.com',
      password: 'staff123',
      role: UserRole.GHANA_STAFF,
    });

    // Login to get tokens
    const adminLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'admin123' });

    const staffLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'staff@test.com', password: 'staff123' });

    adminToken = adminLogin.body.accessToken;
    adminRefreshToken = adminLogin.body.refreshToken;
    staffToken = staffLogin.body.accessToken;
    staffRefreshToken = staffLogin.body.refreshToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Auth (e2e)', () => {
    describe('/api/auth/login (POST)', () => {
      it('should login with valid admin credentials', () => {
        return request(app.getHttpServer())
          .post('/api/auth/login')
          .send({ email: 'admin@test.com', password: 'admin123' })
          .expect(201)
          .expect((res) => {
            expect(res.body).toHaveProperty('accessToken');
            expect(res.body).toHaveProperty('refreshToken');
            expect(res.body).toHaveProperty('user');
            expect(res.body.user.email).toBe('admin@test.com');
            expect(res.body.user.role).toBe('admin');
          });
      });

      it('should login with valid staff credentials', () => {
        return request(app.getHttpServer())
          .post('/api/auth/login')
          .send({ email: 'staff@test.com', password: 'staff123' })
          .expect(201)
          .expect((res) => {
            expect(res.body).toHaveProperty('accessToken');
            expect(res.body).toHaveProperty('refreshToken');
            expect(res.body).toHaveProperty('user');
            expect(res.body.user.email).toBe('staff@test.com');
            expect(res.body.user.role).toBe('staff');
          });
      });

      it('should reject invalid email', () => {
        return request(app.getHttpServer())
          .post('/api/auth/login')
          .send({ email: 'invalid@test.com', password: 'admin123' })
          .expect(401)
          .expect((res) => {
            expect(res.body.message).toBe('Invalid credentials');
          });
      });

      it('should reject invalid password', () => {
        return request(app.getHttpServer())
          .post('/api/auth/login')
          .send({ email: 'admin@test.com', password: 'wrongpassword' })
          .expect(401)
          .expect((res) => {
            expect(res.body.message).toBe('Invalid credentials');
          });
      });

      it('should validate email format', () => {
        return request(app.getHttpServer())
          .post('/api/auth/login')
          .send({ email: 'invalid-email', password: 'admin123' })
          .expect(400);
      });

      it('should validate password length', () => {
        return request(app.getHttpServer())
          .post('/api/auth/login')
          .send({ email: 'admin@test.com', password: '123' })
          .expect(400);
      });
    });

    describe('/api/auth/refresh (POST)', () => {
      it('should refresh token with valid refresh token', () => {
        return request(app.getHttpServer())
          .post('/api/auth/refresh')
          .set('Authorization', `Bearer ${adminRefreshToken}`)
          .expect(201)
          .expect((res) => {
            expect(res.body).toHaveProperty('accessToken');
            expect(res.body).toHaveProperty('refreshToken');
          });
      });

      it('should reject invalid refresh token', () => {
        return request(app.getHttpServer())
          .post('/api/auth/refresh')
          .set('Authorization', 'Bearer invalid-token')
          .expect(401);
      });

      it('should reject request without refresh token', () => {
        return request(app.getHttpServer())
          .post('/api/auth/refresh')
          .expect(401);
      });
    });
  });

  describe('Users (e2e)', () => {
    describe('/api/users/me (GET)', () => {
      it('should return current admin user profile', () => {
        return request(app.getHttpServer())
          .get('/api/users/me')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200)
          .expect((res) => {
            expect(res.body.email).toBe('admin@test.com');
            expect(res.body.role).toBe('admin');
            expect(res.body.name).toBe('Admin User');
            expect(res.body).not.toHaveProperty('passwordHash');
            expect(res.body).not.toHaveProperty('refreshTokenHash');
          });
      });

      it('should return current staff user profile', () => {
        return request(app.getHttpServer())
          .get('/api/users/me')
          .set('Authorization', `Bearer ${staffToken}`)
          .expect(200)
          .expect((res) => {
            expect(res.body.email).toBe('staff@test.com');
            expect(res.body.role).toBe('staff');
            expect(res.body.name).toBe('Staff User');
          });
      });

      it('should reject unauthenticated request', () => {
        return request(app.getHttpServer()).get('/api/users/me').expect(401);
      });

      it('should reject invalid token', () => {
        return request(app.getHttpServer())
          .get('/api/users/me')
          .set('Authorization', 'Bearer invalid-token')
          .expect(401);
      });
    });

    describe('/api/users (GET)', () => {
      it('should list users for admin', () => {
        return request(app.getHttpServer())
          .get('/api/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200)
          .expect((res) => {
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body).toHaveLength(2);
            expect(res.body[0]).not.toHaveProperty('passwordHash');
            expect(res.body[0]).not.toHaveProperty('refreshTokenHash');
          });
      });

      it('should reject staff access to user list', () => {
        return request(app.getHttpServer())
          .get('/api/users')
          .set('Authorization', `Bearer ${staffToken}`)
          .expect(403);
      });

      it('should reject unauthenticated request', () => {
        return request(app.getHttpServer()).get('/api/users').expect(401);
      });
    });

    describe('/api/users (POST)', () => {
      it('should create user for admin', () => {
        return request(app.getHttpServer())
          .post('/api/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: 'New Staff',
            email: 'newstaff@test.com',
            password: 'newstaff123',
            role: 'staff',
          })
          .expect(201)
          .expect((res) => {
            expect(res.body.name).toBe('New Staff');
            expect(res.body.email).toBe('newstaff@test.com');
            expect(res.body.role).toBe('staff');
            expect(res.body).not.toHaveProperty('passwordHash');
            expect(res.body).not.toHaveProperty('refreshTokenHash');
          });
      });

      it('should create user with default staff role', () => {
        return request(app.getHttpServer())
          .post('/api/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: 'Default Staff',
            email: 'default@test.com',
            password: 'default123',
          })
          .expect(201)
          .expect((res) => {
            expect(res.body.role).toBe('staff');
          });
      });

      it('should reject duplicate email', () => {
        return request(app.getHttpServer())
          .post('/api/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: 'Duplicate',
            email: 'admin@test.com',
            password: 'duplicate123',
          })
          .expect(409);
      });

      it('should validate required fields', () => {
        return request(app.getHttpServer())
          .post('/api/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: 'Incomplete',
          })
          .expect(400);
      });

      it('should validate email format', () => {
        return request(app.getHttpServer())
          .post('/api/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: 'Invalid Email',
            email: 'invalid-email',
            password: 'password123',
          })
          .expect(400);
      });

      it('should validate password length', () => {
        return request(app.getHttpServer())
          .post('/api/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: 'Short Password',
            email: 'short@test.com',
            password: '123',
          })
          .expect(400);
      });

      it('should reject staff access to user creation', () => {
        return request(app.getHttpServer())
          .post('/api/users')
          .set('Authorization', `Bearer ${staffToken}`)
          .send({
            name: 'Unauthorized',
            email: 'unauthorized@test.com',
            password: 'unauthorized123',
          })
          .expect(403);
      });

      it('should reject unauthenticated request', () => {
        return request(app.getHttpServer())
          .post('/api/users')
          .send({
            name: 'No Auth',
            email: 'noauth@test.com',
            password: 'noauth123',
          })
          .expect(401);
      });
    });
  });

  describe('App Controller (e2e)', () => {
    it('/ (GET)', () => {
      return request(app.getHttpServer())
        .get('/')
        .expect(200)
        .expect('Hello World!');
    });
  });
});
