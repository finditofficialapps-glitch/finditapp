import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase env vars: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
src/lib/types.ts
export type Profile = {
  id: string
  full_name: string | null
  username: string | null
  avatar_url: string | null
  created_at: string
}

export type Post = {
  id: string
  user_id: string
  type: 'lost' | 'found'
  title: string
  description: string
  location: string
  image_url: string | null
  status: 'open' | 'resolved'
  created_at: string
  updated_at: string
}

export type Comment = {
  id: string
  post_id: string
  user_id: string
  content: string
  created_at: string
}

export type PostLike = {
  id: string
  post_id: string
  user_id: string
  created_at: string
}
