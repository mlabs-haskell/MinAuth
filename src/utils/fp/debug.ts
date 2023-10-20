/**
 * @deprecated `traceId` remains in code.
 */
export const traceId = <T>(x: T): T => {
  console.log(x);
  return x;
};
