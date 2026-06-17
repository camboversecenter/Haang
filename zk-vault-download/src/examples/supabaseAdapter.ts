// src/examples/supabaseAdapter.ts

import { supabase } from '../lib/supabaseClient'; 
import { IVaultStorageAdapter } from '../zk-vault/types';

export const supabaseVaultAdapter: IVaultStorageAdapter = {
  
  loadEnvelopes: async (userId: string) => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('vault_envelope_pin, vault_pin_salt, vault_envelope_passkey, passkey_id')
      .eq('id', userId)
      .single();

    if (error || !data) {
      return { 
        pinEnvelope: null, 
        pinSalt: null, 
        passkeyEnvelope: null, 
        passkeyId: null 
      };
    }

    return {
      pinEnvelope: data.vault_envelope_pin,
      pinSalt: data.vault_pin_salt,
      passkeyEnvelope: data.vault_envelope_passkey,
      passkeyId: data.passkey_id
    };
  },
  
  saveEnvelopes: async (userId: string, envelopes) => {
    const updates: Record<string, string | null> = {};
    
    // The Context passes only the fields that need updating, preventing accidental overwrites
    if (envelopes.pinEnvelope !== undefined) updates.vault_envelope_pin = envelopes.pinEnvelope;
    if (envelopes.pinSalt !== undefined) updates.vault_pin_salt = envelopes.pinSalt;
    if (envelopes.passkeyEnvelope !== undefined) updates.vault_envelope_passkey = envelopes.passkeyEnvelope;
    if (envelopes.passkeyId !== undefined) updates.passkey_id = envelopes.passkeyId;

    // This single update call guarantees database atomicity
    const { error } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('id', userId);

    if (error) {
      console.error('Failed to save vault envelopes:', error.message);
      throw error;
    }
  }
};
