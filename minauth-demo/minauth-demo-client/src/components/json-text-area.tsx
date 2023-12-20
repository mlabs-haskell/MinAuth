import React, { useState, useEffect } from 'react';

interface JsonTextareaProps {
  id?: string;
  json: string;
  onJsonChange?: (json: string) => void;
  readOnly?: boolean;
}

const JsonTextarea: React.FC<JsonTextareaProps> = ({
  id,
  json,
  onJsonChange,
  readOnly
}) => {
  const [text, setText] = useState<string>('');
  const [isValidJson, setIsValidJson] = useState<boolean>(true);

  // Function to validate and format JSON
  const validateAndFormatJson = (inputJson: string): string | null => {
    try {
      // Attempt to parse the input JSON string
      const parsedJson = JSON.parse(inputJson);

      // Reformat the parsed JSON with indentation for readability
      return JSON.stringify(parsedJson, null, 2);
    } catch (error) {
      // Log the error if the JSON is invalid
      console.error('Invalid JSON input:', error);
    }
    return null; // Return null if JSON is invalid
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
      {...(id && { id })} // Conditionally include the id attribute
      id={id}
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
