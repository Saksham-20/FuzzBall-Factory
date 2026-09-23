import { IsBoolean, IsString, MaxLength, MinLength } from 'class-validator';

/** The three values Razorpay Checkout hands to its success handler. */
export class VerifyPaymentDto {
  @IsString()
  @MinLength(5)
  @MaxLength(100)
  razorpay_order_id!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(100)
  razorpay_payment_id!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(200)
  razorpay_signature!: string;
}

export class MockConfirmDto {
  @IsBoolean()
  ok!: boolean;
}
