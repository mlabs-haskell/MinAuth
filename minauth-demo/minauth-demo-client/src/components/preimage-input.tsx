import React from 'react';
import { WidgetProps } from '@rjsf/utils';

// Define a custom interface for options
interface PreimageInputOptions {
  transformFunction?: (input: string) => string;
}

/**
 * An example widget component to ingest secret preimage data.
 * It hides the input, but diplays the output of `transformFunction`
 * on that data.
 * It is meant to be used with `rjsf`
 */
const PreimageInputWidget: React.FC<WidgetProps> = ({
  id,
  value,
  required,
  disabled,
  readonly,
  onChange,
  options
}) => {
  // Safely cast options to your custom interface
  const customOptions = options as PreimageInputOptions;

  // Extract transformFunction from customOptions
  const transformFunction = customOptions.transformFunction;

  return (
    <div className="flex flex-col space-y-3 p-4 border border-gray-200 rounded-lg shadow-md max-w-md mx-auto my-5">
      <input
        id={id}
        type="password"
        className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        required={required}
        disabled={disabled || readonly}
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
      />
      {transformFunction && value && (
        <label className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-md">
          <strong>{transformFunction(value)}</strong>
        </label>
      )}
    </div>
  );
};

export default PreimageInputWidget;
