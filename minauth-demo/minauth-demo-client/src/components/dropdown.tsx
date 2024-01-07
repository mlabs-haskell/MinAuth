import { ILogObj, Logger } from 'tslog';
import React, { useState, useEffect } from 'react';

interface DropdownComponentOptions {
  onSelectedOptionChange: (selectedOption: string) => void;
  fetchUrl: string;
  logger?: Logger<ILogObj>;
  onError?: (error: Error) => void;
}

const DropdownComponent: React.FC<DropdownComponentOptions> = ({
  onSelectedOptionChange,
  fetchUrl,
  logger,
  onError
}) => {
  const [options, setOptions] = useState<string[]>([]);
  const [selectedOption, setSelectedOption] = useState<string>('');

  useEffect(() => {
    fetch(fetchUrl)
      .then((response) => response.json())
      .then((data) => {
        setOptions(data);
        if (data.length > 0) {
          setSelectedOption(data[0]);
          onSelectedOptionChange(data[0]);
        }
      })
      .catch((error) => {
        logger?.error('Error fetching data:', error);
        onError?.(error);
      });
  }, [fetchUrl, logger, onError, onSelectedOptionChange]);

  const handleSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedOption(event.target.value);
    onSelectedOptionChange(event.target.value);
  };

  return (
    <div>
      <select value={selectedOption} onChange={handleSelectChange}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
};

export default DropdownComponent;
