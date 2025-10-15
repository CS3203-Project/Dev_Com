# Railway Deployment Guide - Communication Service

## Overview
This guide covers deploying the communication service to Railway hosting. The service is a NestJS application that handles messaging, email notifications, and queue processing.

## Prerequisites
- Railway account (https://railway.app)
- Git repository containing this codebase
- External RabbitMQ instance (CloudAMQP, etc.)
- Database instance (Railway or external)

## Docker Configuration
The service is containerized with optimized Docker setup:
- Multi-stage build for smaller production image
- Non-root user for security
- Health checks for Railway monitoring
- Proper signal handling with dumb-init

### Docker Image Details
- **Base Image**: Node.js 22 Alpine Linux
- **Image Size**: ~396MB (production optimized)
- **Security**: Non-root user execution
- **Port**: 3001 (corrected from example 3000)

## Required Environment Variables

Set these variables in your Railway project dashboard under Variables section:

### External Services
```
RABBITMQ_URL=amqps://your-cloudamqp-url
DATABASE_URL=your-database-connection-string
```

### Email Configuration
```
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=your-email@gmail.com
MAIL_PASS=your-gmail-app-password
```

### Runtime Configuration
```
NODE_ENV=production
PORT=3001
```

## Deployment Steps

### 1. Connect Repository to Railway
1. Log into Railway dashboard
2. Click "New Project"
3. Choose "Deploy from GitHub"
4. Select your repository
5. Choose the branch (main/production)

### 2. Configure Environment
Railway will automatically detect the Dockerfile and build the image. Set the environment variables listed above in the Variables section of your service.

### 3. Database Setup
- Railway provides PostgreSQL databases
- Or use external database service
- Ensure `DATABASE_URL` is set correctly

### 4. RabbitMQ Setup
- Use CloudAMQP or other RabbitMQ-as-a-Service
- Ensure HTTPS URL (amqps://...)
- Set `RABBITMQ_URL` in variables

### 5. Monitor Deployment
- Watch build logs in Railway dashboard
- Check health endpoint: `/health` (if implemented)
- Monitor service logs after deployment

## Railway Features Utilized

- **Docker Support**: Builds from your Dockerfile
- **Health Checks**: Monitors service health
- **Environment Management**: Secure variable storage
- **Auto-scaling**: Based on CPU/memory usage
- **Log Management**: Built-in logging interface

## Networking and CORS

The service is configured for CORS access from:
- `http://localhost:5173` (frontend dev)
- `http://localhost:3000` (backend dev)
- Add your production domains in Railway

## Troubleshooting

### Build Issues
- Check Railway build logs
- Ensure all dependencies are in package.json
- Verify .dockerignore excludes unnecessary files

### Runtime Issues
- Check environment variables
- Verify external services (RabbitMQ, Database) connectivity
- Review application logs in Railway dashboard

### Performance
- Image size is optimized (~396MB)
- Health checks ensure proper monitoring
- Non-root user prevents common security issues

## Post-Deployment

1. Test all endpoints
2. Verify email sending
3. Confirm message queue processing
4. Monitor error logs
5. Set up alerts in Railway dashboard

## Environment Variable Examples

```bash
# Production Environment Variables for Railway
NODE_ENV=production
PORT=3001
RABBITMQ_URL=amqps://bunny-123456.rmq.cloudamqp.com/username
DATABASE_URL=postgresql://user:pass@host:5432/dbname
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=noreply@yourservice.com
MAIL_PASS=app-specific-password
```

## Maintenance

- Regularly update Node.js version in Dockerfile
- Monitor Railway costs and usage
- Keep dependencies updated for security
- Review logs for performance issues

---
*Note: This is your first containerization experience - the setup is production-ready and follows Railway best practices!*
