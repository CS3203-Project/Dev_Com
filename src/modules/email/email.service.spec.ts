import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MailerService } from '@nestjs-modules/mailer';
import { Notification } from './entities/email.entity';
import { EmailService } from './email.service';
import { CreateEmailDto } from './dto/create-email.dto';
import { EmailType } from '../../common/enums/email-type.enum';

describe('EmailService', () => {
  let service: EmailService;
  let mockEmailRepository: any;
  let mockMailerService: any;

  beforeEach(async () => {
    // Mock repository
    mockEmailRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    };

    // Mock mailer service
    mockMailerService = {
      sendMail: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: getRepositoryToken(Notification),
          useValue: mockEmailRepository,
        },
        {
          provide: MailerService,
          useValue: mockMailerService,
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createEmail', () => {
    it('should send email and save to database', async () => {
      // Arrange
      const createEmailDto: CreateEmailDto = {
        userId: 'user-123',
        to: 'test@example.com',
        subject: 'Test Email',
        html: '<h1>Test</h1>',
        emailType: EmailType.OTHER,
        createdAt: new Date(),
      };

      const mockEmailEntity = { id: 1, ...createEmailDto, sentAt: expect.any(Date) };
      
      mockMailerService.sendMail.mockResolvedValue(true);
      mockEmailRepository.create.mockReturnValue(mockEmailEntity);
      mockEmailRepository.save.mockResolvedValue(mockEmailEntity);

      // Act
      const result = await service.createEmail(createEmailDto);

      // Assert
      expect(mockMailerService.sendMail).toHaveBeenCalledWith({
        to: createEmailDto.to,
        subject: createEmailDto.subject,
        html: createEmailDto.html,
      });
      expect(mockEmailRepository.create).toHaveBeenCalled();
      expect(mockEmailRepository.save).toHaveBeenCalled();
      expect(result).toEqual(mockEmailEntity);
    });

    it('should handle email sending failure', async () => {
      // Arrange
      const createEmailDto: CreateEmailDto = {
        userId: 'user-123',
        to: 'invalid-email',
        subject: 'Test Email',
        html: '<h1>Test</h1>',
        emailType: EmailType.OTHER,
        createdAt: new Date(),
      };

      mockMailerService.sendMail.mockRejectedValue(new Error('Failed to send email'));

      // Act & Assert
      await expect(service.createEmail(createEmailDto)).rejects.toThrow('Failed to send email');
    });
  });

  describe('findAllEmails', () => {
    it('should return all emails', async () => {
      // Arrange
      const mockEmails = [
        { id: 1, to: 'test1@example.com', subject: 'Test 1' },
        { id: 2, to: 'test2@example.com', subject: 'Test 2' },
      ];
      mockEmailRepository.find.mockResolvedValue(mockEmails);

      // Act
      const result = await service.findAllEmails();

      // Assert
      expect(result).toEqual(mockEmails);
      expect(mockEmailRepository.find).toHaveBeenCalled();
    });
  });
});
