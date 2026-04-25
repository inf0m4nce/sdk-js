/**
 * Logging example for the Infomance SDK.
 *
 * This example demonstrates:
 * - Implementing a custom logger
 * - Using different log levels (debug, info, warn, error)
 * - Integrating with popular logging libraries
 */

import { InfomanceClient, Logger } from 'infomance';

// Simple console logger
const consoleLogger: Logger = {
  debug: (msg, ...args) => console.log(`[DEBUG] ${msg}`, ...args),
  info: (msg, ...args) => console.info(`[INFO] ${msg}`, ...args),
  warn: (msg, ...args) => console.warn(`[WARN] ${msg}`, ...args),
  error: (msg, ...args) => console.error(`[ERROR] ${msg}`, ...args),
};

// Logger with timestamps
const timestampLogger: Logger = {
  debug: (msg, ...args) =>
    console.log(`[${new Date().toISOString()}] DEBUG: ${msg}`, ...args),
  info: (msg, ...args) =>
    console.info(`[${new Date().toISOString()}] INFO: ${msg}`, ...args),
  warn: (msg, ...args) =>
    console.warn(`[${new Date().toISOString()}] WARN: ${msg}`, ...args),
  error: (msg, ...args) =>
    console.error(`[${new Date().toISOString()}] ERROR: ${msg}`, ...args),
};

// Silent logger (production mode)
const silentLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: (msg, ...args) => console.error(`[ERROR] ${msg}`, ...args), // Only log errors
};

// Debug-only logger
const debugLogger: Logger = {
  debug: (msg, ...args) => {
    if (process.env.DEBUG) {
      console.log(`[DEBUG] ${msg}`, ...args);
    }
  },
  warn: (msg, ...args) => console.warn(`[WARN] ${msg}`, ...args),
  error: (msg, ...args) => console.error(`[ERROR] ${msg}`, ...args),
};

async function main() {
  // Use the console logger for development
  const client = new InfomanceClient({
    apiKey: 'your-api-key',
    logger: consoleLogger,
  });

  // All requests will now be logged
  const municipios = await client.listMunicipalities({ state: 'SP', limit: 5 });
  // Output: [DEBUG] Request: GET https://api.infomance.com.br/api/v1/indicators/municipalities?state=SP&limit=5
  // Output: [DEBUG] Response: 200 https://api.infomance.com.br/api/v1/indicators/municipalities?state=SP&limit=5 (123ms)

  console.log(`Found ${municipios.items.length} municipalities`);
}

// Example: Integration with Winston
/*
import winston from 'winston';

const winstonLogger = winston.createLogger({
  level: 'debug',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()],
});

const winstonAdapter: Logger = {
  debug: (msg, ...args) => winstonLogger.debug(msg, ...args),
  info: (msg, ...args) => winstonLogger.info(msg, ...args),
  warn: (msg, ...args) => winstonLogger.warn(msg, ...args),
  error: (msg, ...args) => winstonLogger.error(msg, ...args),
};

const client = new InfomanceClient({
  apiKey: 'your-api-key',
  logger: winstonAdapter,
});
*/

// Example: Integration with Pino
/*
import pino from 'pino';

const pinoLogger = pino();

const pinoAdapter: Logger = {
  debug: (msg, ...args) => pinoLogger.debug({ args }, msg),
  info: (msg, ...args) => pinoLogger.info({ args }, msg),
  warn: (msg, ...args) => pinoLogger.warn({ args }, msg),
  error: (msg, ...args) => pinoLogger.error({ args }, msg),
};

const client = new InfomanceClient({
  apiKey: 'your-api-key',
  logger: pinoAdapter,
});
*/

main().catch(console.error);
