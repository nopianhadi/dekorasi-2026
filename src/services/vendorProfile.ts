import { supabase } from '../lib/supabaseClient';
import { VendorProfile } from '../types';

const DEFAULT_PROFILE: Omit<VendorProfile, 'id' | 'created_at' | 'updated_at'> = {
    hero_title: 'Wujudkan Momen Terbaik Anda',
    hero_subtitle: 'Layanan Vendor Dekorasi Profesional',
    whatsapp_number: '',
    info_images: [],
};

export const getVendorProfile = async (): Promise<VendorProfile | null> => {
    // Use maybeSingle() instead of single() to avoid 406 when table is empty
    const { data, error } = await supabase
        .from('vendor_profiles')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error('Error fetching vendor profile:', error);
        return null;
    }

    // If no profile exists yet, create a default one
    if (!data) {
        try {
            const { data: created, error: createError } = await supabase
                .from('vendor_profiles')
                .insert([DEFAULT_PROFILE])
                .select()
                .single();

            if (createError) {
                console.warn('Could not auto-create vendor profile:', createError);
                return null;
            }
            return created;
        } catch (e) {
            return null;
        }
    }

    return data;
};

export const createOrUpdateVendorProfile = async (updates: Partial<VendorProfile>): Promise<VendorProfile> => {
    // Check if exists
    const existing = await getVendorProfile();

    if (existing) {
        const { data, error } = await supabase
            .from('vendor_profiles')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', existing.id)
            .select()
            .single();

        if (error) {
            console.error('Error updating vendor profile:', error);
            throw new Error('Gagal menyimpan profil vendor');
        }
        return data;
    } else {
        const { data, error } = await supabase
            .from('vendor_profiles')
            .insert([{ ...updates }])
            .select()
            .single();

        if (error) {
            console.error('Error creating vendor profile:', error);
            throw new Error('Gagal membuat profil vendor');
        }
        return data;
    }
};

export const uploadVendorImage = async (file: File, path: string): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${path}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
        .from('gallery-images') // reuse existing public bucket for convenience
        .upload(fileName, file);

    if (uploadError) {
        console.error('Error uploading image:', uploadError);
        throw new Error('Gagal mengupload gambar');
    }

    const { data: urlData } = supabase.storage
        .from('gallery-images')
        .getPublicUrl(fileName);

    return urlData.publicUrl;
};
