import 'styled-components';

declare module 'styled-components' {
  export interface DefaultTheme {
    mode: 'light' | 'dark';
    // ... you can expand this definition to include other theme-related properties.
  }
}
