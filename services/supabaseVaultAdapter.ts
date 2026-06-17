import { supabase } from './supabaseClient';
import { IVaultStorageAdapter, VaultEnvelopes } from '../zk-vault/types';

const LOCAL_FALLBACK_PREFIX = 'zk-vault:fallback:';

export const supabaseVaultAdapter: IVaultStorageAdapter = {
  loadEnvelopes: async (userId: string): Promise<VaultEnvelopes> => {
    try {
      if (supabase) {
        const { data, error } = await supabase
          .from('vault_envelopes')
          .select('vault_envelope_pin, vault_pin_salt, vault_envelope_passkey, passkey_id')
          .eq('user_id', userId)
          .maybeSingle();

        if (!error && data) {
          return {
            pinEnvelope: data.vault_envelope_pin,
            pinSalt: data.vault_pin_salt,
            passkeyEnvelope: data.vault_envelope_passkey,
            passkeyId: data.passkey_id
          };
        }
      }
    } catch (e) {
      console.warn('Supabase loading error, playing safe and using local fallback container...', e);
    }

    // LocalStorage Fallback (ensures working out-of-the-box in development / sandbox)
    try {
      const fallbackData = localStorage.getItem(`${LOCAL_FALLBACK_PREFIX}${userId}`);
      if (fallbackData) {
        return JSON.parse(fallbackData);
      }
    } catch (err) {
      console.error('LocalStorage load failed', err);
    }

    return {
      pinEnvelope: null,
      pinSalt: null,
      passkeyEnvelope: null,
      passkeyId: null
    };
  },

  saveEnvelopes: async (userId: string, envelopes: Partial<VaultEnvelopes>): Promise<void> => {
    // 1. Prepare updates mapping CamelCase fields to postgres snake_case columns
    const updates: Record<string, string | null> = {};
    if (envelopes.pinEnvelope !== undefined) updates.vault_envelope_pin = envelopes.pinEnvelope;
    if (envelopes.pinSalt !== undefined) updates.vault_pin_salt = envelopes.pinSalt;
    if (envelopes.passkeyEnvelope !== undefined) updates.vault_envelope_passkey = envelopes.passkeyEnvelope;
    if (envelopes.passkeyId !== undefined) updates.passkey_id = envelopes.passkeyId;

    let savedToSupabase = false;

    try {
      if (supabase) {
        // First try to select to see if the row exists, or perform an upsert
        const { error: upsertError } = await supabase
          .from('vault_envelopes')
          .upsert({
            user_id: userId,
            ...updates
          }, { onConflict: 'user_id' });

        if (!upsertError) {
          savedToSupabase = true;
        } else {
          console.warn('Supabase upsert failed, database schema might not exist. Retrying with local fallback...', upsertError);
        }
      }
    } catch (e) {
      console.warn('Could not save to Supabase database container, using local fallback:', e);
    }

    // 2. Always replicate to LocalStorage as fallback so state stays safe
    try {
      const fallbackKey = `${LOCAL_FALLBACK_PREFIX}${userId}`;
      const existingStr = localStorage.getItem(fallbackKey);
      const existing: VaultEnvelopes = existingStr ? JSON.parse(existingStr) : {
        pinEnvelope: null,
        pinSalt: null,
        passkeyEnvelope: null,
        passkeyId: null
      };

      const updatedEnvelopes: VaultEnvelopes = {
        pinEnvelope: envelopes.pinEnvelope !== undefined ? envelopes.pinEnvelope : existing.pinEnvelope,
        pinSalt: envelopes.pinSalt !== undefined ? envelopes.pinSalt : existing.pinSalt,
        passkeyEnvelope: envelopes.passkeyEnvelope !== undefined ? envelopes.passkeyEnvelope : existing.passkeyEnvelope,
        passkeyId: envelopes.passkeyId !== undefined ? envelopes.passkeyId : existing.passkeyId
      };

      localStorage.setItem(fallbackKey, JSON.stringify(updatedEnvelopes));
    } catch (err) {
      console.error('Failed to replicate envelope to local backup storage:', err);
      if (!savedToSupabase) {
        throw new Error('Failed to save cryptographic envelopes to both DB and local storage fallback.');
      }
    }
  }
};
