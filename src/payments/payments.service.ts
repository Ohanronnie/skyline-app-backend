import {
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { AxiosInstance } from 'axios';
import {
  Payment,
  PaymentDocument,
  PaymentStatus,
  PaymentType,
  PaymentPlan,
} from './payments.schema';
import { PartnersService } from '../partners/partners.service';

@Injectable()
export class PaymentsService {
  constructor(
    @Inject('HUBTEL_HTTP_CLIENT')
    private readonly hubtelClient: AxiosInstance,
    private readonly configService: ConfigService,
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
    private readonly partnersService: PartnersService,
  ) {}

  /**
   * Simple health check to verify Hubtel client configuration.
   */
  async pingHubtel(): Promise<boolean> {
    try {
      await this.hubtelClient.get('/');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generate monthly subscription checkout for a partner
   */
  async initiateCheckout(partnerId: string): Promise<{
    checkoutUrl: string;
    checkoutId: string;
    clientReference: string;
    checkoutDirectUrl?: string;
  }> {
    try {
      // Verify partner exists
      const partner = await this.partnersService.findById(partnerId);
      if (!partner) {
        throw new NotFoundException('Partner not found');
      }

      // Prevent double payment within the same month
      const now = new Date();
      const monthStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        1,
        0,
        0,
        0,
      );
      const monthEnd = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        1,
        0,
        0,
        0,
      );

      const existingPayment = await this.paymentModel.findOne({
        partnerId: new Types.ObjectId(partnerId),
        type: PaymentType.MONTHLY_SUBSCRIPTION,
        // Only a successful payment should block new payments this month
        createdAt: { $gte: monthStart, $lt: monthEnd },
        status: PaymentStatus.SUCCESS,
      });

      if (existingPayment) {
        throw new BadRequestException(
          'You already have a subscription payment for this month',
        );
      }

      // Get monthly subscription amount from config (default to 0 if not set)
      const monthlyAmount = parseFloat(
        this.configService.get<string>('PARTNER_MONTHLY_SUBSCRIPTION_AMOUNT') ||
          '0',
      );

      if (monthlyAmount <= 0) {
        throw new BadRequestException(
          'Monthly subscription amount is not configured',
        );
      }

      // Generate unique client reference (short, random, max 32 chars)
      const clientReference = this.generateClientReference(
        'PARTNER',
        partnerId,
      );

      // Get Hubtel configuration
      const merchantAccountNumber =
        this.configService.get<string>('HUBTEL_POS_ID');
      const callbackUrl = this.configService.get<string>('HUBTEL_CALLBACK_URL');
      const returnUrl = this.configService.get<string>('HUBTEL_RETURN_URL');
      const cancellationUrl = this.configService.get<string>(
        'HUBTEL_CANCELLATION_URL',
      );

      if (!merchantAccountNumber) {
        throw new Error('HUBTEL_POS_ID must be set in environment variables');
      }

      if (!callbackUrl || !returnUrl || !cancellationUrl) {
        throw new Error(
          'HUBTEL_CALLBACK_URL, HUBTEL_RETURN_URL and HUBTEL_CANCELLATION_URL must be set in environment variables',
        );
      }

      // Calculate next month's due date
      const dueDate = new Date();
      dueDate.setMonth(dueDate.getMonth() + 1);

      // Prepare Hubtel payload
      const payload = {
        totalAmount: monthlyAmount.toFixed(2),
        description: `Monthly subscription payment for ${partner.name}`,
        callbackUrl,
        returnUrl,
        cancellationUrl,
        merchantAccountNumber,
        clientReference,
        payeeName: partner.name,
        payeeMobileNumber:  partner.phoneNumber,
        payeeEmail: partner.email,
      };

      // Debug log: outbound payload to Hubtel for basic checkout
      console.log('Hubtel basic checkout payload:', payload);
      console.log('Before');
      // Call Hubtel API
      const response = await this.hubtelClient.post<{
        data: {
          checkoutUrl: string;
          checkoutId: string;
          clientReference: string;
          checkoutDirectUrl?: string;
        };
      }>('/items/initiate', payload);
      console.log('After', response);
      // Create payment record only after successful Hubtel response
      const payment = new this.paymentModel({
        partnerId: new Types.ObjectId(partnerId),
        organization: partner.organization,
        type: PaymentType.MONTHLY_SUBSCRIPTION,
        plan: PaymentPlan.BASIC,
        status: PaymentStatus.PROCESSING,
        amount: monthlyAmount,
        clientReference,
        description: payload.description,
        dueDate,
        checkoutId: response.data.data.checkoutId,
        checkoutUrl: response.data.data.checkoutUrl,
        checkoutDirectUrl: response.data.data.checkoutDirectUrl,
        hubtelResponse: response.data.data,
      });

      await payment.save();

      let responseData = {
        checkoutUrl: response.data.data.checkoutUrl,
        checkoutId: response.data.data.checkoutId,
        clientReference: response.data.data.clientReference,
        checkoutDirectUrl: response.data.data.checkoutDirectUrl,
      };
      console.log('responseData', responseData);
      return responseData;
    } catch (error) {
      const err: any = error;
      let hubtelMessage: string | undefined;
      console.log('error  occurred', error);
      // Prefer logging Hubtel error response body if available
      if (err?.response?.data) {
        console.error(
          'Hubtel basic checkout error response:',
          err.response.data,
        );
        // Try to extract a helpful message from Hubtel payload
        const data = err.response.data as any;
        const firstError =
          Array.isArray(data?.data) && data.data.length > 0
            ? data.data[0]
            : undefined;
        hubtelMessage =
          firstError?.errorMessage ||
          data?.message ||
          data?.status ||
          undefined;
      } else {
        console.error('Error initiating basic subscription checkout:', err);
      }

      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw new BadRequestException(
        hubtelMessage ||
          'Unable to initiate subscription payment, please try again',
      );
    }
  }

  /**
   * Generate professional subscription checkout for a partner (upgrade)
   */
  async initiateProfessionalCheckout(partnerId: string): Promise<{
    checkoutUrl: string;
    checkoutId: string;
    clientReference: string;
    checkoutDirectUrl?: string;
  }> {
    try {
      // Verify partner exists
      const partner = await this.partnersService.findById(partnerId);
      if (!partner) {
        throw new NotFoundException('Partner not found');
      }

      // Check if already has a professional subscription this month
      const now = new Date();
      const monthStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        1,
        0,
        0,
        0,
      );
      const monthEnd = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        1,
        0,
        0,
        0,
      );

      const existingProfessional = await this.paymentModel.findOne({
        partnerId: new Types.ObjectId(partnerId),
        type: PaymentType.MONTHLY_SUBSCRIPTION,
        plan: PaymentPlan.PROFESSIONAL,
        createdAt: { $gte: monthStart, $lt: monthEnd },
        status: PaymentStatus.SUCCESS,
      });

      if (existingProfessional) {
        throw new BadRequestException(
          'You already have a professional subscription payment for this month',
        );
      }

      // Get professional subscription amount from config
      const professionalAmount = parseFloat(
        this.configService.get<string>(
          'PARTNER_PROFESSIONAL_SUBSCRIPTION_AMOUNT',
        ) || '0',
      );

      if (professionalAmount <= 0) {
        throw new BadRequestException(
          'Professional subscription amount is not configured',
        );
      }

      // Generate unique client reference (short, random, max 32 chars)
      const clientReference = this.generateClientReference(
        'PARTNER-PRO',
        partnerId,
      );

      // Get Hubtel configuration
      const merchantAccountNumber =
        this.configService.get<string>('HUBTEL_POS_ID');
      const callbackUrl = this.configService.get<string>('HUBTEL_CALLBACK_URL');
      const returnUrl = this.configService.get<string>('HUBTEL_RETURN_URL');
      const cancellationUrl = this.configService.get<string>(
        'HUBTEL_CANCELLATION_URL',
      );

      if (!merchantAccountNumber) {
        throw new Error('HUBTEL_POS_ID must be set in environment variables');
      }

      if (!callbackUrl || !returnUrl || !cancellationUrl) {
        throw new Error(
          'HUBTEL_CALLBACK_URL, HUBTEL_RETURN_URL and HUBTEL_CANCELLATION_URL must be set in environment variables',
        );
      }

      // Calculate next month's due date
      const dueDate = new Date();
      dueDate.setMonth(dueDate.getMonth() + 1);

      // Prepare Hubtel payload
      const payload = {
        totalAmount: professionalAmount.toFixed(2),
        description: `Professional subscription payment for ${partner.name}`,
        callbackUrl,
        returnUrl,
        cancellationUrl,
        merchantAccountNumber,
        clientReference,
        payeeName: partner.name,
        payeeMobileNumber: partner.phoneNumber,
        payeeEmail: partner.email,
      };

      // Debug log: outbound payload to Hubtel for professional checkout
      console.log('Hubtel professional checkout payload:', payload);

      // Call Hubtel API (expecting nested `data` object like basic checkout)
      const response = await this.hubtelClient.post<{
        data: {
          checkoutUrl: string;
          checkoutId: string;
          clientReference: string;
          checkoutDirectUrl?: string;
        };
      }>('/items/initiate', payload);

      // Create payment record only after successful Hubtel response
      const payment = new this.paymentModel({
        partnerId: new Types.ObjectId(partnerId),
        organization: partner.organization,
        type: PaymentType.MONTHLY_SUBSCRIPTION,
        plan: PaymentPlan.PROFESSIONAL,
        status: PaymentStatus.PROCESSING,
        amount: professionalAmount,
        clientReference,
        description: payload.description,
        dueDate,
        checkoutId: response.data.data.checkoutId,
        checkoutUrl: response.data.data.checkoutUrl,
        checkoutDirectUrl: response.data.data.checkoutDirectUrl,
        hubtelResponse: response.data.data,
      });

      await payment.save();

      const responseData = {
        checkoutUrl: response.data.data.checkoutUrl,
        checkoutId: response.data.data.checkoutId,
        clientReference: response.data.data.clientReference,
        checkoutDirectUrl: response.data.data.checkoutDirectUrl,
      };

      return responseData;
    } catch (error) {
      const err: any = error;
      let hubtelMessage: string | undefined;

      if (err?.response?.data) {
        console.error(
          'Hubtel professional checkout error response:',
          err.response.data,
        );
        const data = err.response.data as any;
        const firstError =
          Array.isArray(data?.data) && data.data.length > 0
            ? data.data[0]
            : undefined;
        hubtelMessage =
          firstError?.errorMessage ||
          data?.message ||
          data?.status ||
          undefined;
      } else {
        console.error(
          'Error initiating professional subscription checkout:',
          err,
        );
      }

      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw new BadRequestException(
        hubtelMessage ||
          'Unable to initiate professional subscription payment, please try again',
      );
    }
  }

  /**
   * Update payment status from Hubtel webhook
   */
  async updatePaymentStatus(
    clientReference: string,
    status: PaymentStatus,
    hubtelData?: Record<string, any>,
  ): Promise<PaymentDocument | null> {
    const payment = await this.paymentModel.findOne({ clientReference }).exec();

    if (!payment) {
      return null;
    }

    payment.status = status;
    if (status === PaymentStatus.SUCCESS) {
      payment.paidAt = new Date();
    }
    if (hubtelData) {
      payment.hubtelResponse = {
        ...payment.hubtelResponse,
        ...hubtelData,
      };
    }

    return payment.save();
  }

  /**
   * Get payment history for a partner
   */
  async getPartnerPayments(partnerId: string): Promise<PaymentDocument[]> {
    return this.paymentModel
      .find({ partnerId: new Types.ObjectId(partnerId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Get current month subscription status for a partner
   */
  async getCurrentSubscriptionStatus(partnerId: string): Promise<{
    isActive: boolean;
    plan: 'none' | PaymentPlan.BASIC | PaymentPlan.PROFESSIONAL;
    lastPayment?: PaymentDocument | null;
  }> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    const monthEnd = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      1,
      0,
      0,
      0,
    );

    const payments = await this.paymentModel
      .find({
        partnerId: new Types.ObjectId(partnerId),
        createdAt: { $gte: monthStart, $lt: monthEnd },
      })
      .sort({ createdAt: -1 })
      .exec();

    if (payments.length === 0) {
      return {
        isActive: false,
        plan: 'none',
        lastPayment: null,
      };
    }

    const successfulProfessional = payments.find(
      (p) =>
        p.status === PaymentStatus.SUCCESS &&
        p.plan === PaymentPlan.PROFESSIONAL,
    );
    const successfulBasic = payments.find(
      (p) => p.status === PaymentStatus.SUCCESS && p.plan === PaymentPlan.BASIC,
    );

    const isActive = !!(successfulProfessional || successfulBasic);
    let plan: 'none' | PaymentPlan.BASIC | PaymentPlan.PROFESSIONAL = 'none';

    if (successfulProfessional) {
      plan = PaymentPlan.PROFESSIONAL;
    } else if (successfulBasic) {
      plan = PaymentPlan.BASIC;
    }

    return {
      isActive,
      plan,
      lastPayment: payments[0],
    };
  }

  /**
   * Generate a short, mostly unique client reference (max 32 chars) for Hubtel
   */
  private generateClientReference(prefix: string, partnerId: string): string {
    const shortId = partnerId.toString().slice(-6);
    const timePart = Date.now().toString(36); // compact timestamp
    const randomPart = Math.random().toString(36).slice(2, 6); // 4 chars
    const raw = `${prefix}-${shortId}-${timePart}-${randomPart}`;
    return raw.slice(0, 32);
  }
}
