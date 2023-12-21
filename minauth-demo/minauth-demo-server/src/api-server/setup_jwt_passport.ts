/**
 * @fileoverview Contains functions for setting up JWT and custom (MinAuth) authentication strategies for Passport.
 * Also contains functions for generating and storing refresh tokens and for retrieving the associated AuthenticationResponse.
 *
 * NOTE: Overal this is an example on how to use MinAuth with JWT token based authentication.
 *       Notice that MinAuth can easily be used differently :)
 */
import crypto from 'crypto';
import passport from 'passport';
import { Strategy as JWTStrategy, ExtractJwt } from 'passport-jwt';
import jwt from 'jsonwebtoken';
import MinAuthStrategy, {
  AuthenticationResponse
} from 'minauth/dist/server/minauthstrategy.js';
import dotenv from 'dotenv';
import { Logger } from 'tslog';
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';

const log = new Logger();

// Load environment variables
const parsed_env = dotenv.config();
log.info('Environment variables:', parsed_env.parsed);

const SECRET_KEY = process.env.SECRET_KEY || 'default_secret_key';
const JWT_EXPIRES_IN = '1h';
const SCRYPT_SALT_LENGTH = 16;
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };
const DATABASE_FILENAME = './tokenstore.db';

/**
 * Open a connection to the SQLite database, creating the database and the required table if they don't exist.
 * @returns {Promise<Database>} A promise that resolves to the SQLite database connection.
 */
const openDB = async (): Promise<Database> => {
  const db = await open({
    filename: DATABASE_FILENAME,
    driver: sqlite3.Database
  });

  // Check if the 'refresh_tokens' table exists and create it if not
  const tableExists = await db.get(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='refresh_tokens';`
  );
  if (!tableExists) {
    await db.run(`
      CREATE TABLE refresh_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token_hash TEXT NOT NULL,
        auth_response TEXT NOT NULL
      );
    `);
  }

  return db;
};

/**
 * Initializes and configures Passport with JWT and custom (MinAuth) authentication strategies.
 *
 * @returns {passport.Authenticator} The configured Passport authenticator instance.
 */
export const setupPassport = (): passport.Authenticator => {
  const jwtOptions = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: SECRET_KEY
  };
  passport
    .use(
      new JWTStrategy(jwtOptions, (jwtPayload, done) => {
        log.info('JWT payload received:', jwtPayload);
        if (jwtPayload) {
          return done(null, jwtPayload);
        } else {
          console.log('JWT verification failed');
          return done(null, false);
        }
      })
    )
    .use(new MinAuthStrategy());

  return passport;
};

export type JWTPayload = { authRespHash: string };

/**
 * Generates a secure random refresh token.
 * @returns The generated refresh token.
 */
const generateRefreshToken = async (): Promise<string> => {
  try {
    return crypto.randomBytes(48).toString('hex');
  } catch (error) {
    const err = error as Error;
    log.error('Error generating refresh token:', err.message);
    throw err; // Rethrowing the exception for further handling
  }
};

/**
 * Stores a hashed version of the refresh token along with the associated AuthenticationResponse in the database.
 * @param authResponse The corresponding AuthenticationResponse object.
 * @returns {Promise<{refreshToken:string}>} A promise that resolves to the generated refresh token.
 */
export const storeAuthResponse = async (
  authResponse: AuthenticationResponse
): Promise<{ refreshToken: string }> => {
  try {
    const refreshToken = await generateRefreshToken();
    const hashed = await hashString(refreshToken);
    const serializedAuthResponse = JSON.stringify(authResponse);
    const db = await openDB();
    await db.run(
      'INSERT INTO refresh_tokens (token_hash, auth_response) VALUES (?, ?)',
      [hashed, serializedAuthResponse]
    );
    return { refreshToken };
  } catch (error) {
    const err = error as Error;
    log.error('Error storing refresh token with auth response:', err.message);
    throw err;
  }
};

/**
 * Retrieves the AuthenticationResponse associated with a given token.
 * @param token The token for which to retrieve the AuthenticationResponse.
 * @returns {Promise<AuthenticationResponse | null>} The associated AuthenticationResponse or null if not found.
 */
export const getAuthResponseByToken = async ({
  refreshToken
}: {
  refreshToken: string;
}): Promise<AuthenticationResponse | null> => {
  try {
    const hashed = await hashString(refreshToken);
    const db = await openDB();
    const row = await db.get(
      'SELECT auth_response FROM refresh_tokens WHERE token_hash = ?',
      hashed
    );
    return row
      ? (JSON.parse(row.auth_response) as AuthenticationResponse)
      : null;
  } catch (error) {
    const err = error as Error;
    log.error('Error retrieving AuthenticationResponse by token:', err.message);
    throw err;
  }
};

/**
 * Hashes a string using scrypt and returns the hash.
 * @param  The string to hash.
 * @returns A promise that resolves to the hash string.
 */
const hashString = async (token: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(SCRYPT_SALT_LENGTH).toString('hex');
    crypto.scrypt(
      token,
      salt,
      SCRYPT_KEY_LENGTH,
      SCRYPT_PARAMS,
      (err, derivedKey) => {
        if (err) {
          log.error('Error hashing string:', err.message);
          reject(err);
        } else {
          resolve(salt + ':' + derivedKey.toString('hex'));
        }
      }
    );
  });
};

/**
 * Removes a row from the database that corresponds to the provided refresh token.
 * @param {string} token - The refresh token to remove.
 * @returns {Promise<void>} A promise that resolves when the operation is complete.
 */
export const invalidateRefreshToken = async (token: string): Promise<void> => {
  try {
    const hashed = await hashString(token);
    const db = await openDB();
    await db.run('DELETE FROM refresh_tokens WHERE token_hash = ?', hashed);

    log.info('Token removed from database:', token); // Logging the action
  } catch (error) {
    const err = error as Error;
    log.error('Error removing token from database:', err.message);
    throw err; // Rethrowing the error for further handling
  }
};

/**
 * Hashes an AuthenticationResponse using scrypt and returns the hash.
 * @param {AuthenticationResponse} authResponse - The authentication response to hash.
 * @returns {Promise<string>} A promise that resolves to the hash string.
 */
export const hashAuthResp = async (
  authResponse: AuthenticationResponse
): Promise<string> => {
  return await hashString(JSON.stringify(authResponse));
};

export const signJWTPayload = (payload: JWTPayload): string =>
  jwt.sign(payload, SECRET_KEY, { expiresIn: JWT_EXPIRES_IN });
