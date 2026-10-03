import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { OptionalAuth, Public } from '../common/decorators/public.decorator.js';
import type { RequestUser } from '../common/types/auth.types.js';
import { CreateTicketDto, TicketMessageDto, TicketTokenQuery } from './dto/support.dto.js';
import { toTicketDto, type TicketDto } from './support.mapper.js';
import { SupportService } from './support.service.js';

/** Five new tickets an hour per IP: plenty for a real person, and a flood cannot fill the maker's inbox. */
const NEW_TICKETS = { default: { limit: 5, ttl: 60 * 60_000 } };
/** Reading and answering a ticket by its emailed link. */
const BY_LINK = { default: { limit: 30, ttl: 60 * 60_000 } };

/**
 * The public side of the support inbox. Anyone may open a ticket (signed in or not); a guest reads and answers their own
 * through the token in the emailed link; a signed-in customer finds theirs under `/account/tickets`.
 */
@Controller('support/tickets')
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @OptionalAuth()
  @Throttle(NEW_TICKETS)
  @Post()
  async create(@Body() dto: CreateTicketDto, @CurrentUser() user?: RequestUser): Promise<{ number: string; accessToken: string }> {
    if (dto.website?.trim()) {
      // A bot filled the hidden field: answer like a success so it learns nothing, store nothing.
      return { number: 'SUP-0000', accessToken: '0'.repeat(48) };
    }
    const { number, accessToken } = await this.support.createFromForm(dto, user);
    return { number, accessToken };
  }

  @Public()
  @Throttle(BY_LINK)
  @Get(':number')
  async get(@Param('number') number: string, @Query() q: TicketTokenQuery): Promise<TicketDto> {
    return toTicketDto(await this.support.getByToken(number, q.t));
  }

  @Public()
  @Throttle(BY_LINK)
  @HttpCode(201)
  @Post(':number/messages')
  async reply(@Param('number') number: string, @Query() q: TicketTokenQuery, @Body() dto: TicketMessageDto): Promise<TicketDto> {
    const row = await this.support.getByToken(number, q.t);
    return this.support.addCustomerMessage(row, dto, null);
  }
}

/** A signed-in customer's own tickets. Another customer's number is a plain 404. */
@Controller('account/tickets')
export class AccountTicketsController {
  constructor(private readonly support: SupportService) {}

  @Get()
  list(@CurrentUser() user: RequestUser): Promise<TicketDto[]> {
    return this.support.listForUser(user.userId);
  }

  @Get(':number')
  async get(@CurrentUser() user: RequestUser, @Param('number') number: string): Promise<TicketDto> {
    return toTicketDto(await this.support.getForUser(number, user.userId));
  }

  @HttpCode(201)
  @Post(':number/messages')
  async reply(@CurrentUser() user: RequestUser, @Param('number') number: string, @Body() dto: TicketMessageDto): Promise<TicketDto> {
    const row = await this.support.getForUser(number, user.userId);
    return this.support.addCustomerMessage(row, dto, user.userId);
  }
}
