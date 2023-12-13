import { createGlobalStyle } from 'styled-components';

const GlobalStyle = createGlobalStyle`
  body {
    background-color: ${({ theme }) =>
      theme.mode === 'light' ? '#ffffff' : '#1a1a1a'};
    color: ${({ theme }) => (theme.mode === 'light' ? '#1a1a1a' : '#ffffff')};
    // Add other global styles for each theme
  }
`;

export default GlobalStyle;
