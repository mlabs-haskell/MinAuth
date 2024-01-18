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
  const [selectedOption, setSelectedOption] =
    useState<string>('No plugin selected');

  useEffect(() => {
    fetch(fetchUrl)
      .then((response) => response.json())
      .then((data) => {
        setOptions(data);
      })
      .catch((error) => {
        logger?.error('Error fetching data:', error);
        onError?.(error);
      });
  }, [fetchUrl, logger, onError]);

  const handleSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedOption(event.target.value);
    onSelectedOptionChange(event.target.value);
  };

  return (
    <select
      className="bg-white bg-opacity-40 p-1 m-2 rounded text-black focus:border-blue"
      value={selectedOption}
      onChange={handleSelectChange}
    >
      <option disabled value="No plugin selected">
        No plugin selected
      </option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
};

export default DropdownComponent;
