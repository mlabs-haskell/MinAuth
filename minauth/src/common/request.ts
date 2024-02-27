/**
 * This file contains the functions for making HTTP requests.
 */
import { z } from 'zod';
import { Logger } from 'tslog';
import * as TE from 'fp-ts/lib/TaskEither.js';
import { TaskEither } from 'fp-ts/lib/TaskEither.js';
import { fromFailablePromise } from '../utils/fp/taskeither.js';
import { pipe } from 'fp-ts/lib/function.js';

const log = new Logger();

// Define a Zod schema for ErrorResponse
export const ErrorResponseSchema = z.object({
  type: z.union([z.literal('network-error'), z.literal('validation-error')]),
  message: z.string(),
  server_response: z.unknown().optional(),
  details: z.unknown().optional()
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const OkResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    type: z.literal('ok'),
    data: dataSchema,
    server_response: z.unknown()
  });

export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.union([OkResponseSchema(dataSchema), ErrorResponseSchema]);

// Infer types from the schemas
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
export type OkResponse<T extends z.ZodTypeAny> = z.infer<
  ReturnType<typeof OkResponseSchema<T>>
>;
export type ApiResponse<T extends z.ZodTypeAny> = z.infer<
  ReturnType<typeof ApiResponseSchema<T>>
>;

function isOkResponse<T extends z.ZodTypeAny>(
  response: ApiResponse<T>
): response is OkResponse<T> {
  return response.type === 'ok';
}
export function mkRequestTE<U extends z.ZodSchema>(
  url: string,
  schema: U,
  opts?: {
    headers?: Record<string, string>;
    body?: unknown;
  }
): TaskEither<ErrorResponse, OkResponse<U>> {
  return pipe(
    fromFailablePromise(() => mkRequest(url, schema, opts)),
    TE.fold(
      (e): TaskEither<ErrorResponse, OkResponse<U>> => {
        log.error('mkRequest error:', e);
        return TE.left(fallbackError(e));
      },
      (r): TaskEither<ErrorResponse, OkResponse<U>> => {
        // Assert the type based on runtime check
        if (isOkResponse(r)) {
          // Ensure TypeScript understands r as OkResponse
          return TE.right(r);
        } else {
          // Ensure TypeScript understands r as ErrorResponse
          const errorResponse: ErrorResponse = r as ErrorResponse;
          return TE.left(errorResponse);
        }
      }
    )
  );
}

export async function mkRequest<U extends z.ZodSchema>(
  url: string,
  schema: U,
  opts?: {
    headers?: Record<string, string>;
    body?: unknown;
  }
): Promise<ApiResponse<U>> {
  let { headers } = opts ?? {};
  const { body } = opts ?? {};
  try {
    if (headers == undefined) {
      headers = {
        'Content-Type': 'application/json'
      };
    } else {
      if (!headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }
    }

    log.debug('mkRequest: url:', url, 'headers:', headers, 'body:', body);

    const response =
      body == undefined
        ? await fetch(url, {
            method: 'GET',
            headers: headers
          })
        : await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body)
          });
    // actually fetch will throw an error if the request fails

    const respbody = await response.json();
    // Extract headers
    const respheaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      respheaders[key] = value;
    });

    const respObj = {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: respheaders,
      redirected: response.redirected,
      url: response.url,
      body: respbody
    };

    if (!respObj.ok) {
      return {
        type: 'network-error',
        message: `HTTP error! status: ${response.status}`,
        server_response: respObj
      };
    }

    const parseRes = schema.safeParse(respObj.body);
    if (!parseRes.success) {
      return {
        type: 'validation-error',
        message: 'Validation error',
        details: parseRes.error.errors,
        server_response: respObj
      };
    } else {
      return { data: parseRes.data, server_response: respObj, type: 'ok' };
    }
  } catch (error: unknown) {
    return fallbackError(error);
  }
}

const fallbackError = (error: unknown): ErrorResponse => {
  let message = 'An error occurred';
  log.debug('error:', error);
  // handle schema.parse errors
  if (error instanceof Error) {
    // Handle general errors
    message = error.message;
  }
  return {
    type: 'network-error',
    message
  };
};
