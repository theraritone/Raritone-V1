# Raritone in-app purchases

Raritone subscriptions are native store subscriptions, not Stripe checkout inside the mobile app.

## Product identifiers

| Plan | Monthly price | Apple / Google product ID |
|---|---:|---|
| Free | ₹0 | None |
| Pro | ₹299 | `com.raritone.pro.monthly` |
| VIP | ₹999 | `com.raritone.vip.monthly` |

## Required implementation boundary

1. The native client starts a purchase using Apple StoreKit or Google Play Billing.
2. The client sends the signed transaction/receipt to `POST /api/billing/receipts`.
3. The server validates the receipt with the relevant store.
4. The server persists the verified entitlement and renewal state.
5. The client refreshes `GET /api/billing/entitlement`.

A client response is never sufficient to grant Pro or VIP access.

## Required production configuration

- Apple App Store Connect subscription products and subscription group
- Apple App Store Server API issuer ID, key ID, and private key
- Google Play Console subscriptions and base plans
- Google Play service account with subscription verification access
- Production HTTPS API origin
- Terms of use and privacy policy URLs

## Testing checklist

- Sandbox purchase and cancellation on iOS
- Internal-test purchase and cancellation on Android
- Restore purchases on both platforms
- Expired subscription
- Billing retry and payment failure
- Upgrade Pro → VIP
- Downgrade VIP → Pro
- Duplicate receipt submission
- Receipt from the wrong product or platform
- Offline purchase completion followed by later receipt sync
- Account/device linking before and after purchase

## Current status

The repository contains the shared product contract, subscription UI, client adapter boundary, receipt endpoint, and fail-closed behavior. Native StoreKit/Play Billing adapters and provider-specific receipt verification remain release work because they require store configuration and credentials.
