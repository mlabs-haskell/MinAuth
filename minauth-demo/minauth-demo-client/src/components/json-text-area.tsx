import React, { useState, useEffect } from 'react';

interface JsonTextareaProps {
  json: string;
  onJsonChange?: (json: string) => void;
  readOnly?: boolean;
}

const JsonTextarea: React.FC<JsonTextareaProps> = ({
  json,
  onJsonChange,
  readOnly
}) => {
  const [text, setText] = useState<string>('');
  const [isValidJson, setIsValidJson] = useState<boolean>(true);

  // Function to validate and format JSON
  const validateAndFormatJson = (inputJson: string): string | null => {
    try {
      const parsedJson = JSON.parse(inputJson);
      if (
        typeof parsedJson === 'object' &&
        parsedJson !== null &&
        !Array.isArray(parsedJson)
      ) {
        const safeJson = JSON.parse(
          JSON.stringify(parsedJson, Object.keys(parsedJson))
        );
        return JSON.stringify(safeJson, null, 2);
      }
    } catch (error) {
      // Invalid JSON
    }
    return null;
  };

  useEffect(() => {
    const formattedJson = validateAndFormatJson(json);
    if (formattedJson !== null) {
      setText(formattedJson);
      setIsValidJson(true);
    } else {
      setIsValidJson(false);
    }
  }, [json]);

  useEffect(() => {
    if (isValidJson && onJsonChange !== undefined) {
      onJsonChange(text);
    }
  }, [text, isValidJson, onJsonChange]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setText(newValue);

    const formattedJson = validateAndFormatJson(newValue);
    if (formattedJson !== null) {
      setIsValidJson(true);
      if (onJsonChange !== undefined) onJsonChange(formattedJson);
    } else {
      setIsValidJson(false);
    }
  };

  return (
    <textarea
      value={text}
      onChange={handleChange}
      style={{
        border: isValidJson ? '1px solid black' : '1px solid red',
        width: '100%',
        height: '200px'
      }}
      readOnly={readOnly}
    />
  );
};

export default JsonTextarea;
