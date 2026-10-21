import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "../common/auth.guard";
import { CurrentUser } from "../common/current-user.decorator";
import { BillingService } from "./billing.service";

@UseGuards(AuthGuard)
@Controller("billing")
export class BillingController {
  constructor(private svc: BillingService) {}

  @Get("subscription")
  getSubscription(@CurrentUser() u: any) {
    return this.svc.getSubscription(u);
  }

  @Post("checkout")
  checkout(@CurrentUser() u: any, @Body() b: any) {
    return this.svc.checkout(u, b);
  }

  @Get("compliance-status")
  getComplianceStatus(@CurrentUser() u: any) {
    return this.svc.getComplianceStatus(u);
  }

  @Get("compliance-export")
  exportComplianceBundle(@CurrentUser() u: any) {
    return this.svc.exportComplianceBundle(u);
  }

  // Super-admin only endpoints for monitoring payments & client access
  @Get("super-admin/payments")
  getAllPayments(@CurrentUser() u: any) {
    return this.svc.getAllClientPayments(u);
  }

  @Patch("super-admin/tenants/:id/subscription")
  updateClientSubscription(
    @CurrentUser() u: any,
    @Param("id") id: string,
    @Body() b: any,
  ) {
    return this.svc.updateClientSubscriptionAdmin(u, id, b);
  }
}
