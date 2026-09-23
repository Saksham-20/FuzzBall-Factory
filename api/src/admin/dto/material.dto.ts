import { IsBoolean, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { TrimmedString } from '../../common/dto/decorators.js';

export class MaterialInputDto {
  @TrimmedString(1, 200)
  name!: string;

  /** Free text: "skein", "gram", "piece", "metre", ... — materials vary too much for a fixed enum. */
  @TrimmedString(1, 40)
  unit!: string;

  /** Rupees, whole. */
  @IsInt({ message: 'Use a whole number' })
  @Min(0)
  @Max(10_000_000)
  costPerUnit!: number;

  /** Fractional quantity on hand (yarn is tracked in partial skeins/grams). */
  @IsNumber()
  @Min(0)
  qtyOnHand!: number;

  /** Threshold at/below which this material is flagged as running low. Omit for no threshold. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  lowStockAt?: number | null;

  @IsOptional()
  @TrimmedString(0, 500)
  notes?: string | null;

  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}

export class MaterialStockAdjustDto {
  /** Change to `qtyOnHand`; negative to record material used on a piece. */
  @IsNumber()
  delta!: number;

  @IsOptional()
  @TrimmedString(0, 200)
  reason?: string;
}
