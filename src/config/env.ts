import dotenv from "dotenv";
dotenv.config();

const requireEnv = (key: string): string => {
    const value = process.env[key];

    if(!value){
        throw new Error(`Missing required environment variable: ${key}`)
    }

    return value;
}

export const env = {
  // Server
  PORT: parseInt(process.env.PORT || '3000'),
  NODE_ENV: process.env.NODE_ENV || 'development',

  // Database
  DATABASE_URL: requireEnv('DATABASE_URL'),

  // JWT
  JWT_SECRET: requireEnv('JWT_SECRET'),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',

  // Redis
  REDIS_URL: requireEnv('REDIS_URL'),
}

// create a TypeScript type called Env that matches the structure (shape) of the env object.
export type Env = typeof env