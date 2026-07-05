# Security Specification for Campaign Panel

## Data Invariants
1. **User Identity Invariant**: A user document is writeable only if the document ID matches `request.auth.uid`. No user can edit other users' profile documents.
2. **Balance Integrity Invariant**: Users are strictly forbidden from directly updating their own wallet balances (`balances.main`, `balances.bonus`, `balances.referral`). All reward credits must be audited and processed through tasks verification or state-controlled triggers.
3. **Withdrawal Invariant**: Users can create a withdrawal in 'pending' status but cannot transition it to 'approved' or 'rejected'. Transitioning to 'approved' can only be executed by verified admins.
4. **Task Security Invariant**: Earning tasks details can only be added, updated, or removed by authenticated Administrators.
5. **Anti-Cheat Countermeasures**: Users must have VPN deactivated (`vpnActive == false`) and have a single device ID mapped (`deviceFingerprint` validation).

---

## The "Dirty Dozen" Exploit Payloads
The following payloads must be explicitly blocked with `PERMISSION_DENIED` at the Firestore Rule boundary:

### 1. The "Millionaire" Injection (Balance Tempering)
* **Target collection**: `/users/{userId}`
* **Intent**: Attempt to update the user's wallet fields directly to 999,999.
* **Payload**: `{"balances": {"main": 999999, "bonus": 50000}}`
* **Security Rule Gate**: Immutability check rejecting direct modifications to `balances` fields.

### 2. The "Identity Hijack" (Account Stealing)
* **Target collection**: `/users/{userId}`
* **Intent**: Attack is authenticated as `User_A` but attempts to write to `/users/User_B`.
* **Payload**: `{"displayName": "Attacker"}`
* **Security Rule Gate**: Match rule: `allow write: if request.auth.uid == userId`

### 3. The "Self-Admin Promotion" (Privilege Escalation)
* **Target collection**: `/users/{userId}`
* **Intent**: User claims VIP membership or elevates role fields directly.
* **Payload**: `{"vipMember": true, "userRank": "Diamond"}`
* **Security Rule Gate**: Blocking state-modifying fields unless passed by system-level authorization.

### 4. The "Ghost Completion" (Infinite Coins)
* **Target collection**: `/transactions/{transactionId}`
* **Intent**: Directly creating completed transaction receipts for non-existent activities.
* **Payload**: `{"userId": "my_uid", "amount": 5000, "type": "task", "description": "Free payout"}`
* **Security Rule Gate**: Enforcing transactions to be generated systematically or verified.

### 5. The "Status Overstep" (Withdraw Bypass)
* **Target collection**: `/withdrawals/{withdrawalId}`
* **Intent**: User submits withdrawal request pre-approved without admin assessment.
* **Payload**: `{"userId": "my_uid", "amount": 500, "status": "approved"}`
* **Security Rule Gate**: Strict `status` evaluation on create restricting value to `pending`.

### 6. The "Invisible Man" (PII Scraping)
* **Target collection**: `/users/{userId}`
* **Intent**: Attack queries complete list of users to read private phone numbers and email lists.
* **Payload**: `Query: select * from users where isBanned == false`
* **Security Rule Gate**: `allow list` restrictions enforcing exact user matching `resource.data.uid == request.auth.uid` or admin scopes.

### 7. The "Spoofed Timestamp" (Streak Extension)
* **Target collection**: `/users/{userId}`
* **Intent**: Artificially claiming older daily bonuses by supplying customized `lastCheckIn` date in the past.
* **Payload**: `{"lastCheckIn": "2026-05-24T00:00:00Z"}`
* **Security Rule Gate**: Enforcing strict `request.time` comparison for time records.

### 8. The "Zombie referral" (Direct Invite Exploit)
* **Target collection**: `/referrals/{referralId}`
* **Intent**: Creating circular referral references to self to yield infinite commissions.
* **Payload**: `{"referrerId": "User_A", "refereeId": "User_A"}`
* **Security Rule Gate**: Enforcing `referrerId != refereeId` and verifying uid auth matching.

### 9. The "Ad System Mute" (Disabling Revenue)
* **Target collection**: `/ads_settings` (or ads config)
* **Intent**: Disabling all AdMob banner displays app-wide to block advertising.
* **Payload**: `{"bannerEnabled": false}`
* **Security Rule Gate**: Permitting writes only to authenticated admins.

### 10. The "Denial of Wallet" ID Poisoning
* **Target collection**: `/users/{userId}`
* **Intent**: Flooding document IDs with highly dense 2MB base64 lists to inflate read costs.
* **Payload**: Target document ID is extremely large.
* **Security Rule Gate**: `isValidId()` restricts size limit of string keys to `128` characters.

### 11. The "Fake KYC Override"
* **Target collection**: `/users/{userId}`
* **Intent**: Forcing KYC to display 'Approved' without verifying documentation.
* **Payload**: `{"kycStatus": "Approved"}`
* **Security Rule Gate**: Restricted fields can only change under state-gated validations.

### 12. The "VPN Shield" (Bypassing Regional Limits)
* **Target collection**: `/users/{userId}`
* **Intent**: Forcing `vpnActive` to false to bypass anti-cheat checks.
* **Payload**: `{"vpnActive": false}`
* **Security Rule Gate**: Prohibiting manual reset of fraudulent system-logged fields.
