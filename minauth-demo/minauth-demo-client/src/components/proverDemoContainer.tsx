import React from 'react';
import styles from '@styles/ProverDemoContainer.module.css';
import { useTheme } from '@/contexts/ThemeContext';

interface ProverDemoContainerProps {
  title: string;
  description: string;
  formComponent: React.ReactNode;
  onAction: () => void;
  actionLabel: string;
  output: string;
  footerContent?: React.ReactNode;
}

const ProverDemoContainer: React.FC<ProverDemoContainerProps> = ({
  title,
  description,
  formComponent,
  onAction,
  actionLabel,
  output,
  footerContent
}) => {
  const { theme } = useTheme();

  return (
    <div
      className={`${styles.container} ${
        theme.mode === 'dark' ? styles.dark : styles.light
      }`}
    >
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.description}>{description}</p>
      <div className={styles.formArea}>{formComponent}</div>
      <button className={styles.actionButton} onClick={onAction}>
        {actionLabel}
      </button>
      <div className={styles.output}>
        <pre>{output}</pre>
      </div>
      {footerContent && (
        <footer className={styles.footer}>{footerContent}</footer>
      )}
    </div>
  );
};

export default ProverDemoContainer;
