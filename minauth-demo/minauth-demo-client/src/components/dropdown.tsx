import React, { useState, useEffect } from 'react';
import { ILogObj, Logger } from 'tslog';

interface DropdownComponentOptions {
  onSelectedOptionChange: (selectedOption: string) => void;
  fetchUrl: string;
  logger?: Logger<ILogObj>;
  onError?: (error: Error) => void;
}

const DropdownComponent: React.FC<DropdownComponentOptions> = (
  opts: DropdownComponentOptions
) => {
  const [options, setOptions] = useState<string[]>([]);
  const [selectedOption, setSelectedOption] = useState<string>('');

  useEffect(() => {
    // Replace with your API endpoint
    fetch(opts.fetchUrl)
      .then((response) => response.json())
      .then((data) => {
        // Assuming the data is in the format [{value: '1', label: 'Option 1'}, ...]
        setOptions(data);
      })
      .catch((error) => {
        opts.logger?.error('Error fetching data:', error);
        opts.onError?.(error);
      });
  }, [opts]);

  const handleSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedOption(event.target.value);
    opts.onSelectedOptionChange(event.target.value);
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
