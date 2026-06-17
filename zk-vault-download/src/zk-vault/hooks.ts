// src/zk-vault/hooks.ts

import { useContext } from 'react';
import { VaultContext } from './VaultContext';

export function useZkVault() {
  const context = useContext(VaultContext);
  if (!context) {
    throw new Error('useZkVault must be used within a VaultProvider');
  }
  return context;
}
