# PFM Stack Demo – Data Models

Concise reference. Full details in [SPECIFICATIONS.md](SPECIFICATIONS.md).

## Proof Envelope (signed JSON)

- `proofId`, `proofType` (WorkCompletionProof | VendorEligibilityProof), `issuerId`, `issuedAt`, `validFrom`, `validUntil`, `statusEndpoint`, `claims`, `signature` (alg, keyId, value).

## WorkCompletionProof claims

- `workId`, `milestoneId`, `completionDate`; optional: `measurementBookRef`, `amountCertified`, `evidenceRef`.

## VendorEligibilityProof claims

- `canonicalVendorId`, `bankValidated`, `blacklisted`; optional: `mappedIds`, `taxStatus`, `complianceFlags`.

## Payment Passport (connector input)

- `caseId`, `amount`, `budgetHead`, `vendorId`, `workId`, `milestoneId`, `rulebookId`, `rulebookVersion`, `proofRefs[]`, `reservationId`, `decision` (APPROVE), `decisionHash`, `issuedAt`.

## Budget

- **BudgetHead**: budgetHead (id), total, committed, reserved.
- **Reservation**: id, caseId, budgetHeadId, amount, status (RESERVED|CONFIRMED|RELEASED|EXPIRED), expiresAt.

## Audit

- **DecisionRecord**: caseId, rulebookId, rulebookVersion, evaluatedAt, decision, reasonsJson, proofRefsJson, proofChecksJson, reservationId?, decisionHash, previousHash, recordHash.
- **StatusEvent**: caseId, source, eventType, eventTime, refsJson, previousHash, eventHash.
- Hash chain: `recordHash = SHA256(previousHash + "|" + caseId + "|" + RFC8785_canonical(payload))`.

## Exceptions

- **Appeal**: caseId, reason, raisedBy.
- **Override**: caseId, reasonCodesOverridden[], justification; requires redressal_authority; policy from rulebook (overrideAllowed per code).
