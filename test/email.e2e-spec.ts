import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { EmailType } from '../src/common/enums/email-type.enum';

describe('Email API (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('/email (POST)', () => {
    it('should send email successfully', () => {
      const createEmailDto = {
        userId: 'test-user-123',
        to: 'test@example.com',
        subject: 'Test Email Subject',
        html: '<h1>Hello Test</h1><p>This is a test email.</p>',
        emailType: EmailType.OTHER,
        createdAt: new Date().toISOString(),
      };

      return request(app.getHttpServer())
        .post('/email')
        .send(createEmailDto)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.to).toBe(createEmailDto.to);
          expect(res.body.subject).toBe(createEmailDto.subject);
          expect(res.body).toHaveProperty('sentAt');
        });
    });

    it('should reject invalid email format', () => {
      const invalidEmailDto = {
        userId: 'test-user-123',
        to: 'invalid-email-format',
        subject: 'Test Subject',
        html: '<h1>Test</h1>',
        emailType: EmailType.OTHER,
        createdAt: new Date().toISOString(),
      };

      return request(app.getHttpServer())
        .post('/email')
        .send(invalidEmailDto)
        .expect(400);
    });
  });

  describe('/email/all (GET)', () => {
    it('should retrieve all sent emails', () => {
      return request(app.getHttpServer())
        .get('/email/all')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });
  });
});
