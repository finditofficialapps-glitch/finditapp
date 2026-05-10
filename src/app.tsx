import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Heart, MapPin, MessageCircle, PlusSquare, Search } from 'lucide-react'
import { supabase } from './lib/supabase'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'

type Post = {
  id: string
  user_id: string
  type: 'lost' | 'found'
  title: string
  description: string
  location: string
  image_url: string | null
  status: 'open' | 'resolved'
  created_at: string
}

type Comment = {
  id: string
  post_id: string
  user_id: string
  content: string
  created_at: string
}

type Like = {
  id: string
  post_id: string
  user_id: string
}

export default function App() {
  const [userId, setUserId] = useState<string | null>(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isRegister, setIsRegister] = useState(false)
  const [authMsg, setAuthMsg] = useState('')

  const [posts, setPosts] = useState<Post[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [likes, setLikes] = useState<Like[]>([])

  const [q, setQ] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'lost' | 'found'>('all')

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [type, setType] = useState<'lost' | 'found'>('lost')
  const [imageFile, setImageFile] = useState<File | null>(null)

  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({})

  useEffect(() => {
    supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
  setUserId(data.session?.user?.id ?? null)
})

const { data } = supabase.auth.onAuthStateChange(
  (_e: AuthChangeEvent, session: Session | null) => {
    setUserId(session?.user?.id ?? null)
  },
)

    return () => data.subscription.unsubscribe()
  }, [])

  const loadData = async () => {
    if (!userId) return
    const [p, c, l] = await Promise.all([
      supabase.from('posts').select('*').order('created_at', { ascending: false }),
      supabase.from('comments').select('*'),
      supabase.from('post_likes').select('*'),
    ])
    if (!p.error) setPosts(p.data as Post[])
    if (!c.error) setComments(c.data as Comment[])
    if (!l.error) setLikes(l.data as Like[])
}

useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const filteredPosts = useMemo(() => {
    return posts.filter((p) => {
      const matchQ =
        !q ||
        p.title.toLowerCase().includes(q.toLowerCase()) ||
        p.description.toLowerCase().includes(q.toLowerCase()) ||
        p.location.toLowerCase().includes(q.toLowerCase())
      const matchType = typeFilter === 'all' || p.type === typeFilter
      return matchQ && matchType
    })
  }, [posts, q, typeFilter])

  const handleAuth = async (e: FormEvent) => {
    e.preventDefault()
    setAuthMsg('')
    if (isRegister) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setAuthMsg(error.message)
      else setAuthMsg('Registrasi berhasil. Silakan login.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setAuthMsg(error.message)
    }
  }

  const uploadImage = async () => {
    if (!imageFile || !userId) return null
    const ext = imageFile.name.split('.').pop() || 'jpg'
    const path = `${userId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('post-images').upload(path, imageFile)
    if (error) {
      alert(error.message)
      return null
    }
    const { data } = supabase.storage.from('post-images').getPublicUrl(path)
    return data.publicUrl
  }

const createPost = async (e: FormEvent) => {
    e.preventDefault()
    if (!userId) return
    if (!title || !description || !location) return alert('Lengkapi semua field')
    const imageUrl = await uploadImage()
    const { error } = await supabase.from('posts').insert({
      user_id: userId,
      type,
      title,
      description,
      location,
      image_url: imageUrl,
      status: 'open',
    })
    if (error) return alert(error.message)
    setTitle('')
    setDescription('')
    setLocation('')
    setImageFile(null)
    await loadData()
  }

  const toggleLike = async (postId: string) => {
    if (!userId) return
    const liked = likes.find((l) => l.post_id === postId && l.user_id === userId)
    if (liked) {
      await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', userId)
    } else {
      await supabase.from('post_likes').insert({ post_id: postId, user_id: userId })
    }
    await loadData()
  }

  const sendComment = async (postId: string) => {
    if (!userId) return
    const content = (commentInputs[postId] || '').trim()
    if (!content) return
    const { error } = await supabase.from('comments').insert({ post_id: postId, user_id: userId, content })
    if (error) return alert(error.message)
    setCommentInputs((prev) => ({ ...prev, [postId]: '' }))
    await loadData()
  }

if (!userId) {
    return (
      <div className="min-h-screen bg-zinc-50 grid place-items-center p-4">
        <form onSubmit={handleAuth} className="w-full max-w-sm rounded-2xl border bg-white p-5 space-y-3">
          <h1 className="text-2xl font-bold">FindIt</h1>
          <p className="text-sm text-zinc-500">Login / Register</p>
          <input className="w-full border rounded-lg px-3 py-2" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="w-full border rounded-lg px-3 py-2" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button className="w-full rounded-lg bg-violet-600 text-white py-2">{isRegister ? 'Daftar' : 'Masuk'}</button>
          <button type="button" className="w-full text-sm text-violet-600" onClick={() => setIsRegister((v) => !v)}>
            {isRegister ? 'Sudah punya akun? Masuk' : 'Belum punya akun? Daftar'}
          </button>
          {authMsg && <p className="text-sm text-zinc-600">{authMsg}</p>}
        </form>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="sticky top-0 bg-white border-b z-10">
        <div className="max-w-5xl mx-auto h-14 px-4 flex items-center justify-between">
          <h1 className="font-bold text-xl">FindIt</h1>
          <button
            className="text-sm border rounded-lg px-3 py-1.5"
            onClick={() => supabase.auth.signOut()}
          >
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 space-y-4">
        <form onSubmit={createPost} className="rounded-2xl border bg-white p-4 space-y-2">
          <h2 className="font-semibold inline-flex items-center gap-2"><PlusSquare size={16} /> Buat Laporan</h2>
          <div className="flex gap-2">
            <button type="button" onClick={() => setType('lost')} className={`px-3 py-1.5 rounded-lg text-sm ${type === 'lost' ? 'bg-rose-100 text-rose-700' : 'bg-zinc-100'}`}>Hilang</button>
            <button type="button" onClick={() => setType('found')} className={`px-3 py-1.5 rounded-lg text-sm ${type === 'found' ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100'}`}>Ditemukan</button>
          </div>
          <input className="w-full border rounded-lg px-3 py-2" placeholder="Judul barang" value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea className="w-full border rounded-lg px-3 py-2" placeholder="Deskripsi" value={description} onChange={(e) => setDescription(e.target.value)} />
          <input className="w-full border rounded-lg px-3 py-2" placeholder="Lokasi" value={location} onChange={(e) => setLocation(e.target.value)} />
          <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} />
          <button className="w-full rounded-lg bg-violet-600 text-white py-2">Post</button>
        </form>

        <div className="rounded-2xl border bg-white p-4 space-y-2">
          <div className="flex items-center gap-2 border rounded-lg px-3 py-2">
            <Search size={16} />
            <input className="w-full outline-none" placeholder="Cari..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="flex gap-2">
            {(['all', 'lost', 'found'] as const).map((f) => (
              <button key={f} onClick={() => setTypeFilter(f)} className={`px-3 py-1.5 rounded-lg text-sm ${typeFilter === f ? 'bg-violet-100 text-violet-700' : 'bg-zinc-100'}`}>
                {f === 'all' ? 'Semua' : f === 'lost' ? 'Hilang' : 'Ditemukan'}
              </button>
            ))}
          </div>
        </div>

        {filteredPosts.map((p) => {
          const likesCount = likes.filter((l) => l.post_id === p.id).length
          const myLike = likes.some((l) => l.post_id === p.id && l.user_id === userId)
          const postComments = comments.filter((c) => c.post_id === p.id)

          return (
            <article key={p.id} className="rounded-2xl border bg-white overflow-hidden">
              {p.image_url ? <img src={p.image_url} alt={p.title} className="w-full h-72 object-cover" /> : null}
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{p.title}</h3>
                  <span className={`text-xs px-2 py-1 rounded-full ${p.type === 'lost' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {p.type === 'lost' ? 'Hilang' : 'Ditemukan'}
                  </span>
                </div>
                <p className="text-sm text-zinc-700 mt-1">{p.description}</p>
                <p className="text-xs text-zinc-500 mt-2 inline-flex items-center gap-1"><MapPin size={13} />{p.location}</p>

                <div className="mt-3 flex items-center gap-4">
                  <button onClick={() => toggleLike(p.id)} className="inline-flex items-center gap-1 text-sm">
                    <Heart size={17} className={myLike ? 'fill-rose-500 text-rose-500' : ''} /> {likesCount}
                  </button>
                  <span className="inline-flex items-center gap-1 text-sm">
                    <MessageCircle size={17} /> {postComments.length}
                  </span>
                </div>

                <div className="mt-3 space-y-1">
                  {postComments.slice(-3).map((c) => (
                    <p key={c.id} className="text-sm text-zinc-700">• {c.content}</p>
                  ))}
                </div>

                <div className="mt-3 flex gap-2">
                  <input
                    className="flex-1 border rounded-lg px-3 py-2 text-sm"
                    placeholder="Komentar..."
                    value={commentInputs[p.id] || ''}
                    onChange={(e) => setCommentInputs((prev) => ({ ...prev, [p.id]: e.target.value }))}
                  />
                  <button onClick={() => sendComment(p.id)} className="px-3 py-2 rounded-lg bg-zinc-900 text-white text-sm">
                    Kirim
                  </button>
                </div>
              </div>
            </article>
          )
        })}
      </main>
    </div>
  )
}
