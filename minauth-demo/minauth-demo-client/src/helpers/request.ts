/**
 * This file contains the functions for making HTTP requests.
 */
import { z } from 'zod';

// Custom Error Type
export type ErrorResponse = {
  type: 'network-error' | 'validation-error';
  message: string;
  details?: unknown; // Additional details about the error (optional)
};

export async function mkRequest<U extends z.ZodSchema>(
  url: string,
  schema: U,
  opts?: {
    headers?: Record<string, string>;
    body?: unknown;
  }
): Promise<z.infer<U> | ErrorResponse> {
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

    if (!response.ok) {
      return {
        type: 'network-error',
        message: `HTTP error! status: ${response.status}`
      };
    }

    const jsonData = await response.json();

    // Validate the response with Zod schema
    return schema.parse(jsonData);
  } catch (error: unknown) {
    let message = 'An error occurred';
    if (error instanceof z.ZodError) {
      // Handle Zod validation errors
      return {
        type: 'validation-error',
        message: 'Validation error',
        details: error.errors
      };
    } else if (error instanceof Error) {
      // Handle general errors
      message = error.message;
    }
    return {
      type: 'network-error',
      message
    };
  }
}
