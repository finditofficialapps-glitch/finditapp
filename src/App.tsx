import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  Bell,
  CircleUserRound,
  Heart,
  Home,
  LogOut,
  MapPin,
  MessageCircle,
  PlusSquare,
  Search,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { supabase } from './lib/supabase'
import type { Comment, Post, PostLike, Profile } from './lib/types'

type SessionUser = {
  id: string
  email?: string
}

type PostWithMeta = Post & {
  profile?: Profile | null
  likesCount: number
  commentsCount: number
  likedByMe: boolean
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function App() {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loadingAuth, setLoadingAuth] = useState(true)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [isRegister, setIsRegister] = useState(false)
  const [authMessage, setAuthMessage] = useState('')

  const [posts, setPosts] = useState<Post[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [likes, setLikes] = useState<PostLike[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [loadingFeed, setLoadingFeed] = useState(false)

  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'lost' | 'found'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'resolved'>('all')

  const [createType, setCreateType] = useState<'lost' | 'found'>('lost')
  const [createTitle, setCreateTitle] = useState('')
  const [createDescription, setCreateDescription] = useState('')
  const [createLocation, setCreateLocation] = useState('')
  const [createImageFile, setCreateImageFile] = useState<File | null>(null)
  const [creatingPost, setCreatingPost] = useState(false)

  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({})

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession()
      const sessionUser = data.session?.user
      setUser(sessionUser ? { id: sessionUser.id, email: sessionUser.email } : null)
      setLoadingAuth(false)
    }

    init()

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user
      setUser(sessionUser ? { id: sessionUser.id, email: sessionUser.email } : null)
    })

    return () => authListener.subscription.unsubscribe()
  }, [])

  const fetchAll = async () => {
    if (!user) return
    setLoadingFeed(true)

    const [postsRes, profilesRes, likesRes, commentsRes] = await Promise.all([
      supabase.from('posts').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*'),
      supabase.from('post_likes').select('*'),
      supabase.from('comments').select('*'),
    ])

    if (!postsRes.error) setPosts(postsRes.data as Post[])
    if (!profilesRes.error) setProfiles(profilesRes.data as Profile[])
    if (!likesRes.error) setLikes(likesRes.data as PostLike[])
    if (!commentsRes.error) setComments(commentsRes.data as Comment[])

    setLoadingFeed(false)
  }

  useEffect(() => {
    fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel('findit-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_likes' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, fetchAll)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const profileMap = useMemo(() => {
    const map = new Map<string, Profile>()
    profiles.forEach((p) => map.set(p.id, p))
    return map
  }, [profiles])

const postsMeta: PostWithMeta[] = useMemo(() => {
    return posts.map((p) => {
      const likesCount = likes.filter((l) => l.post_id === p.id).length
      const commentsCount = comments.filter((c) => c.post_id === p.id).length
      const likedByMe = !!likes.find((l) => l.post_id === p.id && l.user_id === user?.id)
      return {
        ...p,
        profile: profileMap.get(p.user_id) || null,
        likesCount,
        commentsCount,
        likedByMe,
      }
    })
  }, [posts, likes, comments, profileMap, user?.id])

  const filteredPosts = useMemo(() => {
    return postsMeta.filter((p) => {
      const q = query.toLowerCase()
      const matchQuery =
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.location.toLowerCase().includes(q) ||
        (p.profile?.full_name || '').toLowerCase().includes(q) ||
        (p.profile?.username || '').toLowerCase().includes(q)

      const matchType = typeFilter === 'all' || p.type === typeFilter
      const matchStatus = statusFilter === 'all' || p.status === statusFilter

      return matchQuery && matchType && matchStatus
    })
  }, [postsMeta, query, typeFilter, statusFilter])

const handleAuth = async (e: FormEvent) => {
    e.preventDefault()
    setAuthMessage('')

    if (isRegister) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            username: email.split('@')[0],
          },
        },
      })

      if (error) {
        setAuthMessage(error.message)
      } else {
        setAuthMessage('Registrasi berhasil. Cek email untuk verifikasi bila diminta.')
      }
      return
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setAuthMessage(error.message)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const uploadImage = async (file: File) => {
    if (!user) return null
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${user.id}/${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('post-images')
      .upload(path, file, { upsert: false })

    if (uploadError) {
      alert(`Upload gagal: ${uploadError.message}`)
      return null
    }

    const { data } = supabase.storage.from('post-images').getPublicUrl(path)
    return data.publicUrl
      }

const handleCreatePost = async (e: FormEvent) => {
    e.preventDefault()
    if (!user) return
    if (!createTitle || !createDescription || !createLocation) {
      alert('Isi semua field wajib.')
      return
    }

    setCreatingPost(true)
    let imageUrl: string | null = null

    if (createImageFile) {
      imageUrl = await uploadImage(createImageFile)
    }

    const { error } = await supabase.from('posts').insert({
      user_id: user.id,
      type: createType,
      title: createTitle,
      description: createDescription,
      location: createLocation,
      image_url: imageUrl,
      status: 'open',
    })

    setCreatingPost(false)

    if (error) {
      alert(error.message)
      return
    }

    setCreateTitle('')
    setCreateDescription('')
    setCreateLocation('')
    setCreateImageFile(null)
    await fetchAll()
  }

  const toggleLike = async (postId: string, likedByMe: boolean) => {
    if (!user) return

    if (likedByMe) {
      await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', user.id)
    } else {
      await supabase.from('post_likes').insert({ post_id: postId, user_id: user.id })
    }
    await fetchAll()
      }

const submitComment = async (postId: string) => {
    if (!user) return
    const content = (commentInputs[postId] || '').trim()
    if (!content) return

    const { error } = await supabase.from('comments').insert({
      post_id: postId,
      user_id: user.id,
      content,
    })

    if (error) {
      alert(error.message)
      return
    }

    setCommentInputs((prev) => ({ ...prev, [postId]: '' }))
    await fetchAll()
  }

  const toggleResolve = async (post: Post) => {
    if (!user || post.user_id !== user.id) return
    const next = post.status === 'open' ? 'resolved' : 'open'
    const { error } = await supabase.from('posts').update({ status: next }).eq('id', post.id)
    if (error) {
      alert(error.message)
      return
    }
    await fetchAll()
  }

  const deletePost = async (post: Post) => {
    if (!user || post.user_id !== user.id) return
    const ok = confirm('Hapus post ini?')
    if (!ok) return

    const { error } = await supabase.from('posts').delete().eq('id', post.id)
    if (error) {
      alert(error.message)
      return
    }
    await fetchAll()
  }

  if (loadingAuth) {
    return (
      <div className="min-h-screen grid place-items-center bg-zinc-50">
        <p className="text-zinc-600">Memuat FindIt...</p>
      </div>
    )
  }

if (!user) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="mb-6 text-center">
            <h1 className="text-3xl font-bold tracking-tight">FindIt</h1>
            <p className="text-zinc-500 mt-1">Lost & Found modern social app</p>
          </div>

          <form onSubmit={handleAuth} className="space-y-3">
            {isRegister && (
              <input
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 outline-none focus:ring-2 focus:ring-violet-400"
                placeholder="Nama lengkap"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            )}
            <input
              type="email"
              className="w-full rounded-xl border border-zinc-300 px-3 py-2 outline-none focus:ring-2 focus:ring-violet-400"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              type="password"
              className="w-full rounded-xl border border-zinc-300 px-3 py-2 outline-none focus:ring-2 focus:ring-violet-400"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <button className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-2.5 font-semibold text-white">
              {isRegister ? 'Daftar' : 'Masuk'}
            </button>
          </form>

          {authMessage && <p className="mt-3 text-sm text-zinc-600">{authMessage}</p>}

          <button
            className="mt-4 w-full text-sm text-violet-600 font-medium"
            onClick={() => setIsRegister((s) => !s)}
          >
            {isRegister ? 'Sudah punya akun? Masuk' : 'Belum punya akun? Daftar'}
          </button>
        </div>
      </div>
    )
}

return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-fuchsia-500 via-violet-500 to-cyan-500" />
            <h1 className="text-xl font-semibold">FindIt</h1>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <button className="text-zinc-600"><Bell size={20} /></button>
            <button className="text-zinc-600"><CircleUserRound size={20} /></button>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm"
            >
              <LogOut size={16} /> Keluar
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-3 pb-24 pt-4 sm:px-6 lg:grid-cols-[1fr_320px] lg:pt-8">
        <section className="space-y-5">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm space-y-3">
            <h2 className="font-semibold flex items-center gap-2"><PlusSquare size={18}/> Buat Laporan</h2>
            <form onSubmit={handleCreatePost} className="space-y-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCreateType('lost')}
                  className={`rounded-xl px-3 py-2 text-sm ${createType === 'lost' ? 'bg-rose-100 text-rose-700' : 'bg-zinc-100 text-zinc-600'}`}
                >
                  Hilang
                </button>
                <button
                  type="button"
                  onClick={() => setCreateType('found')}
                  className={`rounded-xl px-3 py-2 text-sm ${createType === 'found' ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-600'}`}
                >
                  Ditemukan
                </button>
              </div>

              <input
                className="w-full rounded-xl border border-zinc-300 px-3 py-2"
                placeholder="Judul barang (contoh: Dompet cokelat)"
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
              />
              <textarea
                className="w-full rounded-xl border border-zinc-300 px-3 py-2"
                placeholder="Deskripsi detail"
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
              />
              <input
                className="w-full rounded-xl border border-zinc-300 px-3 py-2"
                placeholder="Lokasi kejadian"
                value={createLocation}
                onChange={(e) => setCreateLocation(e.target.value)}
              />
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setCreateImageFile(e.target.files?.[0] || null)}
                className="w-full text-sm"
              />
              <button
                disabled={creatingPost}
                className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-2.5 font-semibold text-white disabled:opacity-60"
              >
                {creatingPost ? 'Mengirim...' : 'Publikasikan'}
              </button>
            </form>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-zinc-500">
              <Search size={16} />
              <input
                className="w-full outline-none text-sm"
                placeholder="Cari judul, lokasi, user..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {(['all', 'lost', 'found'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={`rounded-lg px-3 py-1.5 text-sm ${typeFilter === t ? 'bg-violet-100 text-violet-700' : 'bg-zinc-100 text-zinc-600'}`}
                >
                  {t === 'all' ? 'Semua Tipe' : t === 'lost' ? 'Hilang' : 'Ditemukan'}
                </button>
              ))}
              {(['all', 'open', 'resolved'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`rounded-lg px-3 py-1.5 text-sm ${statusFilter === s ? 'bg-cyan-100 text-cyan-700' : 'bg-zinc-100 text-zinc-600'}`}
                >
                  {s === 'all' ? 'Semua Status' : s === 'open' ? 'Aktif' : 'Selesai'}
                </button>
              ))}
            </div>
          </div>

          {loadingFeed ? (
            <div className="text-center text-zinc-500 py-8">Memuat feed...</div>
          ) : filteredPosts.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center text-zinc-500">
              Belum ada data sesuai filter.
            </div>
          ) : (
            filteredPosts.map((post) => {
              const postComments = comments
                .filter((c) => c.post_id === post.id)
                .sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at))

              const owner = post.profile?.full_name || post.profile?.username || 'Pengguna'

              return (
                <article key={post.id} className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
                  <div className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold">{owner}</p>
                      <p className="text-xs text-zinc-500">{formatTime(post.created_at)}</p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        post.type === 'lost' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {post.type === 'lost' ? 'Hilang' : 'Ditemukan'}
                    </span>
                  </div>
post.image_url ? (
                    <img src={post.image_url} alt={post.title} className="h-72 w-full object-cover sm:h-96" />
                  ) : (
                    <div className="h-40 bg-zinc-100 grid place-items-center text-zinc-500">
                      Tidak ada gambar
                    </div>
                  )}

                  <div className="p-4">
                    <h3 className="font-semibold text-lg">{post.title}</h3>
                    <p className="text-sm text-zinc-700 mt-1">{post.description}</p>
                    <p className="text-sm text-zinc-500 mt-2 inline-flex items-center gap-1">
                      <MapPin size={14} /> {post.location}
                    </p>

                    <div className="mt-3 flex items-center gap-4 text-zinc-700">
                      <button className="inline-flex items-center gap-1" onClick={() => toggleLike(post.id, post.likedByMe)}>
                        <Heart size={18} className={post.likedByMe ? 'fill-rose-500 text-rose-500' : ''} />
                        <span className="text-sm">{post.likesCount}</span>
                      </button>
                      <div className="inline-flex items-center gap-1">
                        <MessageCircle size={18} />
                        <span className="text-sm">{post.commentsCount}</span>
                      </div>
                      <span
                        className={`text-xs rounded-full px-2 py-1 ${
                          post.status === 'open' ? 'bg-amber-100 text-amber-700' : 'bg-cyan-100 text-cyan-700'
                        }`}
                      >
                        {post.status === 'open' ? 'Aktif' : 'Selesai'}
                      </span>
                    </div>

                    <div className="mt-3 space-y-2">
                      {postComments.slice(-3).map((c) => {
                        const cp = profileMap.get(c.user_id)
                        const cname = cp?.full_name || cp?.username || 'User'
                        return (
                          <p key={c.id} className="text-sm">
                            <span className="font-semibold">{cname}</span>{' '}
                            <span className="text-zinc-700">{c.content}</span>
                          </p>
                        )
                      })}
                    </div>
<div className="mt-3 flex gap-2">
                      <input
                        className="flex-1 rounded-xl border border-zinc-300 px-3 py-2 text-sm"
                        placeholder="Tulis komentar..."
                        value={commentInputs[post.id] || ''}
                        onChange={(e) =>
                          setCommentInputs((prev) => ({ ...prev, [post.id]: e.target.value }))
                        }
                      />
                      <button
                        onClick={() => submitComment(post.id)}
                        className="rounded-xl bg-zinc-900 px-3 py-2 text-sm text-white"
                      >
                        Kirim
                      </button>
                    </div>

                    {user.id === post.user_id && (
                      <div className="mt-4 flex gap-2">
                        <button
                          onClick={() => toggleResolve(post)}
                          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm inline-flex items-center gap-1"
                        >
                          <ShieldCheck size={14} />
                          {post.status === 'open' ? 'Tandai Selesai' : 'Aktifkan Lagi'}
                        </button>
                        <button
                          onClick={() => deletePost(post)}
                          className="rounded-lg border border-rose-300 text-rose-600 px-3 py-1.5 text-sm inline-flex items-center gap-1"
                        >
                          <Trash2 size={14} /> Hapus
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              )
            })
          )}
        </section>
<aside className="hidden lg:block space-y-4">
          <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-500">Akun Aktif</h2>
            <p className="mt-1 text-sm">{user.email}</p>
            <button
              onClick={handleLogout}
              className="mt-3 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm inline-flex items-center gap-1"
            >
              <LogOut size={14} /> Keluar
            </button>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold">Tips Aman FindIt</h3>
            <ul className="mt-3 space-y-2 text-sm text-zinc-600">
              <li>• Validasi ciri unik barang sebelum serah terima.</li>
              <li>• Gunakan lokasi publik saat bertemu.</li>
              <li>• Tandai “Selesai” jika barang sudah kembali.</li>
            </ul>
          </div>
        </aside>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 backdrop-blur lg:hidden">
        <div className="mx-auto flex h-16 max-w-lg items-center justify-around px-6 text-zinc-700">
          <button className="text-violet-600"><Home size={22} /></button>
          <button><Search size={22} /></button>
          <button className="-mt-6 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-3 text-white shadow-lg">
            <PlusSquare size={22} />
          </button>
          <button><Bell size={22} /></button>
          <button><CircleUserRound size={22} /></button>
        </div>
      </nav>
    </div>
  )
  }
