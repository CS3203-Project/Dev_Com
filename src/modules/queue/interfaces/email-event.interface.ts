export interface EmailEvent {
  type: 'BOOKING_CONFIRMATION' | 'BOOKING_REMINDER' | 'BOOKING_CANCELLATION_MODIFICATION' | 'NEW_MESSAGE_OR_REVIEW' | 'OTHER';
  data: {
    conversationId?: string;
    scheduleId?: string;
    customerEmail: string;
    providerEmail: string;
    customerName: string;
    providerName: string;
    serviceName?: string;
    startDate?: string;
    endDate?: string;
    serviceFee?: number;
    currency?: string;
    message?: string;
    reviewData?: any;
    metadata?: Record<string, any>;
  };
  timestamp: string;
}
