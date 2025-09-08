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
import { EmailModule } from './modules/email/email.module';
import { MessagingModule } from './modules/messeging/messaging.module';
import { ConfirmationModule } from './modules/confirmation/confirmation.module';
import { QueueModule } from './modules/queue/queue.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Makes the ConfigService available throughout the app
    }),
    // TypeORM Configuration - No Auto-Migration Mode
    // This configuration prevents TypeORM from automatically modifying the database schema
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: false,   // ❌ Disable automatic schema synchronization
        migrationsRun: false, // ❌ Disable automatic migration execution
        migrations: [],       // ❌ No migrations array (since you don't want TypeORM to handle them)
        ssl: {
          rejectUnauthorized: false, // Required for NeonDB connections
        },
        logging: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : false, // Optional: Control logging
      }),
    }),
    EmailModule,
    MessagingModule,
    ConfirmationModule,
    QueueModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}