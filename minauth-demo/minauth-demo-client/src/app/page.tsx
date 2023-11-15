'use client';
import Link from 'next/link';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';
import GlobalStyle from '../styles/global';
import styles from '@styles/LandingPage.module.css';

function LandingPage() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className={styles.container}>
      <GlobalStyle theme={theme} />

      {/* Theme Toggle Button */}
      <button onClick={toggleTheme}>
        Switch to {theme.mode === 'light' ? 'dark' : 'light'} mode
      </button>

      <h1>Welcome to Zero-Knowledge Proofs Demo</h1>
      <p>
        This application demonstrates the usage and power of zero-knowledge
        proofs in modern authentication systems. Dive in to understand and
        interact with different proving schemas.
      </p>

      <Link href="/simplePreimage">Go to Schema 1</Link>
      <Link href="/schema2">Go to Schema 2</Link>
      {/* Add more links as necessary */}
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <div id="app">
        <LandingPage />
        {/* rest of your component tree */}
      </div>
    </ThemeProvider>
  );
}
