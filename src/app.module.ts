// import { Module } from '@nestjs/common';
// import { AppController } from './app.controller';
// import { AppService } from './app.service';

// @Module({
//   imports: [],
//   controllers: [AppController],
//   providers: [AppService],
// })
// export class AppModule {}

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EmailQueue } from './email.entity';
import { ClientsModule, Transport } from '@nestjs/microservices';

import { MailerModule } from '@nestjs-modules/mailer';




@Module({
  

  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Makes the ConfigService available throughout the app
    }),
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        transport: {
          host: configService.get('MAIL_HOST'),
          port: configService.get('MAIL_PORT'),
          secure: true, // true for 465, false for other ports
          auth: {
            user: configService.get('MAIL_USER'),
            pass: configService.get('MAIL_PASS'),
          },
        },
        defaults: {
          from: configService.get('MAIL_FROM'),
        },
      }),
    }),
    // ClientsModule.registerAsync([
    //   {
    //     name: 'EMAIL_SERVICE',
    //     imports: [ConfigModule],
    //     useFactory: (configService: ConfigService) => {
    //       const url = configService.get<string>('RABBITMQ_URL');
    //       const queue = configService.get<string>('RABBITMQ_EMAIL_QUEUE');
    //       if (!url) {
    //         throw new Error('RABBITMQ_URL is not defined');
    //       }
    //       if (!queue) {
    //         throw new Error('RABBITMQ_EMAIL_QUEUE is not defined');
    //       }
    //       return {
    //         transport: Transport.RMQ,
    //         options: {
    //           urls: [url],
    //           queue: queue,
    //           queueOptions: {
    //             durable: true,
    //           },
    //         },
    //       };
    //     },
    //     inject: [ConfigService],
    //   },
    // ]),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: true, // In development, this syncs your entities with the DB. Disable for production.
        ssl: {
          rejectUnauthorized: false, // Required for NeonDB connections
        },
      }),
    }),
    TypeOrmModule.forFeature([EmailQueue]),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}