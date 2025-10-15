# Communication Service Load Testing

This directory contains comprehensive Artillery load testing configurations for the NestJS-based Communication Backend Service.

## 📁 Directory Structure

```
communication/load-tests/
├── artillery/
│   ├── messaging_scenario.yml       # Messaging module load tests
│   ├── email_scenario.yml          # Email module load tests (MOCKED)
│   ├── queue_scenario.yml          # Queue/RabbitMQ module load tests
│   ├── confirmation_scenario.yml   # Confirmation module load tests
│   └── communication-loadtest.yml  # Combined load test (all modules)
└── README.md
```

## 🎯 Test Overview

### Module Distribution
- **Messaging**: 40% of traffic (create conversations, send/receive messages)
- **Email**: 20% of traffic (queue emails - MOCKED, not sent to Gmail)
- **Queue/RabbitMQ**: 20% of traffic (publish events to message queue)
- **Confirmation**: 20% of traffic (broadcast verification codes)

### Total Load Constraints
- **Max 15 requests/second** across all modules (RabbitMQ Cloud tier limits)
- **Environment Variables**: Configure via `COMMUNICATION_URL`
- **Email Operations**: Fully MOCKED - stored in DB but never sent to Gmail

## 🚀 Quick Start

### Prerequisites
1. **Communication service running**: `npm run dev` (port 3001)
2. **Artillery installed**: `npm install -g artillery`
3. **Optional plugins** for advanced metrics:
   ```bash
   npm install -g artillery-plugin-metrics-by-endpoint
   npm install -g artillery-plugin-statsd
   npm install -g artillery-plugin-datadog  # for cloud monitoring
   ```

### Run Individual Module Tests

```bash
# Test messaging module only (5 req/sec max)
artillery run communication/load-tests/artillery/messaging_scenario.yml

# Test email queuing only (2 req/sec max, mocked)
artillery run communication/load-tests/artillery/email_scenario.yml

# Test queue publishing only (3 req/sec max)
artillery run communication/load-tests/artillery/queue_scenario.yml

# Test confirmation broadcasting only (4 req/sec max)
artillery run communication/load-tests/artillery/confirmation_scenario.yml
```

### Run Combined Load Test

```bash
# Full load test across all modules (15 req/sec max total)
artillery run communication/load-tests/artillery/communication-loadtest.yml

# With JSON metrics output
artillery run communication/load-tests/artillery/communication-loadtest.yml --output results.json --output-format json
```

### Environment-Specific Runs

```bash
# Development (shorter test, localhost)
artillery run communication/load-tests/artillery/communication-loadtest.yml --environment development

# Staging environment
COMMUNICATION_STAGING_URL=https://staging-api.company.com artillery run communication/load-tests/artillery/communication-loadtest.yml --environment staging

# Production (disabled by default, careful!)
COMMUNICATION_PRODUCTION_URL=https://api.company.com artillery run communication/load-tests/artillery/communication-loadtest.yml --environment production
```

## 📊 What Each Test Does

### Messaging Scenario (`messaging_scenario.yml`)
- **Load**: 5 req/sec max over 6 minutes
- **Simulates**: Real user messaging patterns
  - Create conversations between users (30% of operations)
  - Send messages in conversations (40% of operations)
  - Read message history (20% of operations)
  - Browse user conversations (10% of operations)

### Email Scenario (`email_scenario.yml`)
- **Load**: 2 req/sec max over 10 minutes
- **Simulates**: Transactional email queuing (MOCKED)
  - Queue booking confirmations (40% of operations)
  - Queue service reminders (25% of operations)
  - Queue modification emails (15% of operations)
  - Check email service status (20% of operations)
- **⚠️ IMPORTANT**: No emails are actually sent to Gmail - all operations are mocked!

### Queue Scenario (`queue_scenario.yml`)
- **Load**: 3 req/sec max over 6 minutes
- **Simulates**: Event publishing to RabbitMQ
  - Broadcast booking confirmations (35% of operations)
  - Publish booking modifications (25% of operations)
  - Send new message notifications (20% of operations)
  - Broadcast service request matches (20% of operations)

### Confirmation Scenario (`confirmation_scenario.yml`)
- **Load**: 4 req/sec max over 5 minutes
- **Simulates**: Code verification broadcasting
  - Email verification codes (50% of operations)
  - Two-factor SMS codes (25% of operations)
  - Registration verification (15% of operations)
  - Cancellation verification (10% of operations)

### Combined Test (`communication-loadtest.yml`)
- **Load**: Up to 15 req/sec distributed across all modules
- **Duration**: 9 minutes total (1+5+2+1 minute phases)
- **Traffic Distribution**:
  - Messaging: 40% (create/send/browse)
  - Email: 20% (queue emails - mocked)
  - Queue: 20% (publish events)
  - Confirmation: 20% (broadcast codes)

## 🎛️ Performance Thresholds

### Overall Service Targets
- **Error Rate**: < 5%
- **Availability**: > 95%
- **Response Time**: < 3 seconds (95th percentile)

### Module-Specific Targets
- **Messaging**: < 1.2 seconds (98th percentile)
- **Email**: < 5 seconds (95th percentile - queuing operations)
- **Queue**: < 2 seconds (97th percentile)
- **Confirmation**: < 1.5 seconds (98th percentile)

## 📈 Metrics & Monitoring

### Built-in Metrics
- Request success rates by module
- Response time percentiles (P50, P95, P99)
- Error rates and availability percentage
- Throughput and concurrency

### Custom Business Metrics
- Messages sent count
- Emails queued count
- Confirmations broadcast count
- Queue publishing success rate

### External Monitoring
- **StatsD**: For real-time dashboards
- **DataDog**: Cloud monitoring integration
- **JSON Reports**: For detailed analysis

## ⚠️ Important Notes

### RabbitMQ Cloud Limits
- **Free Tier**: Max 100 messages/second burst, 1000/day persistent messages
- **Paid Tiers**: Higher limits, recommend upgrading for production

### Gmail Rate Limits
- **Daily Limit**: 500 emails/day (can increase to 1000-2000 with reputation)
- **ALL EMAIL OPERATIONS ARE MOCKED** - no actual Gmail SMTP usage during testing

### Think Times
- Realistic user delays between operations
- Longer delays for email (respect rate limits)
- Shorter delays for real-time operations

## 🔧 Configuration

### Environment Variables
```bash
COMMUNICATION_URL=http://localhost:3001                   # Development
COMMUNICATION_STAGING_URL=https://staging-api.company.com  # Staging
COMMUNICATION_TEST_URL=https://test-api.company.com       # Testing
COMMUNICATION_PRODUCTION_URL=https://api.company.com      # Production (use carefully!)

DATADOG_API_KEY=your_datadog_api_key_here                # Optional monitoring
NODE_ENV=development                                     # Environment flag
```

### Customizing Load Patterns

Edit YAML files to adjust:
- `arrivalRate`: Requests per second
- `weight`: Traffic distribution between scenarios
- `duration`: Test phase lengths
- `think`: Delay between requests (seconds)

## 🐛 Troubleshooting

### Common Issues

**Port 3001 not accessible**
```bash
# Check if communication service is running
curl http://localhost:3001/api/health

# Start service if needed
cd communication && npm run dev
```

**RabbitMQ connection errors**
```bash
# Check RabbitMQ status
docker ps | grep rabbitmq

# Verify connection string in .env
tail communication/.env
```

**High error rates**
- Reduce `arrivalRate` in test configuration
- Add more `think` time between requests
- Check PostgreSQL/database performance

### Debug Mode
```bash
# Run with verbose output
artillery run messaging_scenario.yml --level debug

# Run with custom reporter output
artillery run messaging_scenario.yml --output debug.json --output-format json
```

## 📝 Test Results Interpretation

### Good Results ✅
- P95 response time < 500ms for messaging
- Error rate < 1%
- Queue publish success rate > 99%
- Email queue success rate > 98%

### Warning Signs ⚠️
- P95 response time > 1 second
- Error rate > 3%
- Queue acknowledgment delays > 2 seconds
- Email queuing taking > 3 seconds

### Critical Issues ❌
- P99 response time > 3 seconds
- Error rate > 5%
- Queue connection failures
- Database timeout errors

## 🎓 Best Practices

1. **Start Small**: Begin with development environment tests
2. **Gradual Increase**: Ramp up load incrementally
3. **Monitor Resources**: Watch CPU, memory, and database connections
4. **Isolate Issues**: Test modules individually before running combined tests
5. **Baseline Performance**: Establish performance baselines for regular comparison
6. **Realistic Scenarios**: Use think times and request patterns matching real usage

## 📚 Related Documentation

- [Artillery.io Documentation](https://www.artillery.io/docs)
- [NestJS Performance Tuning](https://docs.nestjs.com/techniques/performance)
- [RabbitMQ Best Practices](https://www.rabbitmq.com/production-checklist.html)
- [PostgreSQL Performance](https://www.postgresql.org/docs/current/performance-tips.html)
