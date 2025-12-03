import { Controller, Post, Get, UseGuards, Body } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PaymentStatus } from './payments.schema';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  async createCheckout(@CurrentUser() user: any) {
    // Only partners can create checkout
    if (!user.isPartner) {
      throw new Error('Only partners can create payment checkout');
    }
    return this.paymentsService.initiateCheckout(user.userId);
  }

  @Post('checkout/professional')
  @UseGuards(JwtAuthGuard)
  async createProfessionalCheckout(@CurrentUser() user: any) {
    if (!user.isPartner) {
      throw new Error('Only partners can create payment checkout');
    }
    return this.paymentsService.initiateProfessionalCheckout(user.userId);
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  async getPaymentHistory(@CurrentUser() user: any) {
    // Only partners can view their payment history
    if (!user.isPartner) {
      throw new Error('Only partners can view payment history');
    }
    return this.paymentsService.getPartnerPayments(user.userId);
  }

  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getSubscriptionStatus(@CurrentUser() user: any) {
    if (!user.isPartner) {
      throw new Error('Only partners can view subscription status');
    }
    return this.paymentsService.getCurrentSubscriptionStatus(user.userId);
  }

  @Post('webhook')
  async handleWebhook(@Body() body: any) {
    // Hubtel webhook callback
    // Expected body structure from Hubtel (adjust based on actual webhook format)
    const { clientReference, status, ...hubtelData } = body;

    if (!clientReference) {
      return { success: false, message: 'Missing clientReference' };
    }

    // Map Hubtel status to our PaymentStatus enum
    let paymentStatus: PaymentStatus = PaymentStatus.PENDING;
    if (status === 'success' || status === 'completed') {
      paymentStatus = PaymentStatus.SUCCESS;
    } else if (status === 'failed' || status === 'error') {
      paymentStatus = PaymentStatus.FAILED;
    } else if (status === 'cancelled') {
      paymentStatus = PaymentStatus.CANCELLED;
    } else if (status === 'processing') {
      paymentStatus = PaymentStatus.PROCESSING;
    }

    await this.paymentsService.updatePaymentStatus(
      clientReference,
      paymentStatus,
      hubtelData,
    );

    return { success: true };
  }
}
