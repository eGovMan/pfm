import { loadServiceConfig } from '@pfm/shared-config';

const config = loadServiceConfig('ifms-dummy');

export const port = config.port;
export const serviceName = config.serviceName;
export const databaseUrl = config.databaseUrl;

const failRate = process.env.FAIL_RATE;
export const failRateNum = failRate != null && failRate !== '' ? Math.min(1, Math.max(0, parseFloat(failRate))) : 0;

const VOUCHER_DELAY_MS = 2000;
const PAY_DELAY_MS = 3000;
export const voucherDelayMs = process.env.VOUCHER_DELAY_MS ? parseInt(process.env.VOUCHER_DELAY_MS, 10) : VOUCHER_DELAY_MS;
export const payDelayMs = process.env.PAY_DELAY_MS ? parseInt(process.env.PAY_DELAY_MS, 10) : PAY_DELAY_MS;
