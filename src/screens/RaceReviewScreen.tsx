import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  TextInput,
  Keyboard,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://api.flying-riceball.com/api';
const LIKED_KEY = 'race_review_liked_v1';
const PAGE_SIZE = 5;

type BlogPost = {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  content?: string;
  cover_image_url: string | null;
  category: string;
  tags: string[];
  published_at: string | null;
  race_id: number | null;
};

type LikeMap = Record<string, number>;
type ReferIdMap = Record<number, string>;

function formatDate(dateStr: string | null) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

type ContentPart = { type: 'text'; value: string } | { type: 'image'; url: string };

function parseContent(content: string): ContentPart[] {
  const parts: ContentPart[] = [];
  const regex = /!\[.*?\]\((.*?)\)/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: content.slice(lastIndex, match.index).trim() });
    }
    parts.push({ type: 'image', url: match[1] });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < content.length) {
    parts.push({ type: 'text', value: content.slice(lastIndex).trim() });
  }
  return parts.filter(p => p.type === 'image' || (p.type === 'text' && p.value));
}

function LikeButton({ postId, likes, liked, onLike }: { postId: number; likes: number; liked: boolean; onLike: (id: number) => void }) {
  return (
    <TouchableOpacity style={[s.likeBtn, liked && s.likeBtnActive]} onPress={() => onLike(postId)} activeOpacity={0.7}>
      <Text style={s.likeIcon}>{liked ? '❤️' : '🤍'}</Text>
      <Text style={[s.likeCount, liked && s.likeCountActive]}>{likes}</Text>
    </TouchableOpacity>
  );
}

const GQL_URL = 'https://api.flying-riceball.com/graphql';
const RATING_LABELS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];

type Comment = {
  id: number;
  refer_id: string;
  comments: string;
  user_name: string;
  rating: number | null;
  approved: boolean;
  created_at: string;
};

function Stars({ count, size = 14 }: { count: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 1 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Text key={i} style={{ fontSize: size, color: i <= count ? '#f59e0b' : '#e2e8f0' }}>★</Text>
      ))}
    </View>
  );
}

function CommentsSection({ referId }: { referId: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [nickname, setNickname] = useState('');
  const [comment, setComment] = useState('');
  const [rating, setRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    fetch(GQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `{ comment(id:"${referId}") { id refer_id comments user_name rating approved created_at } }`,
      }),
    })
      .then(r => r.json())
      .then(res => setComments((res.data?.comment ?? []).filter((c: Comment) => c.approved)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [referId]);

  async function handleSubmit() {
    if (!comment.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`${API_URL}/races/comments/${referId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comments: comment,
          ip_address: null,
          user_name: nickname.trim() || 'Anonymous',
          rating: rating > 0 ? rating : null,
        }),
      });
      if (res.ok) {
        setComment('');
        setNickname('');
        setRating(0);
        setSubmitted(true);
        Keyboard.dismiss();
      } else {
        setSubmitError('Failed to submit. Please try again.');
      }
    } catch {
      setSubmitError('Network error. Please check your connection.');
    } finally {
      setSubmitting(false);
    }
  }

  const rated = comments.filter(c => c.rating);
  const avg = rated.length > 0
    ? rated.reduce((sum, c) => sum + (c.rating ?? 0), 0) / rated.length
    : 0;

  function formatCommentDate(ts: string) {
    const d = new Date(parseInt(ts));
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  return (
    <View style={cs.container}>
      {/* Aggregate rating */}
      {avg > 0 && (
        <View style={cs.aggRow}>
          <Text style={cs.aggScore}>{avg.toFixed(1)}</Text>
          <View>
            <Stars count={Math.round(avg)} size={16} />
            <Text style={cs.aggCount}>{rated.length} rating{rated.length !== 1 ? 's' : ''}</Text>
          </View>
        </View>
      )}

      <Text style={cs.heading}>
        {comments.length > 0 ? `${comments.length} Review${comments.length !== 1 ? 's' : ''}` : 'Reviews'}
      </Text>

      {loading ? (
        <ActivityIndicator color="#e11d48" style={{ marginVertical: 16 }} />
      ) : comments.length === 0 ? (
        <Text style={cs.emptyText}>No reviews yet — be the first.</Text>
      ) : (
        comments.map(c => (
          <View key={c.id} style={cs.commentCard}>
            <View style={cs.commentHeader}>
              <Text style={cs.commentAuthor}>{c.user_name || 'Anonymous'}</Text>
              {c.rating ? <Stars count={c.rating} size={12} /> : null}
              <Text style={cs.commentDate}>{formatCommentDate(c.created_at)}</Text>
            </View>
            <Text style={cs.commentBody}>{c.comments}</Text>
          </View>
        ))
      )}

      {/* Submit form */}
      <View style={cs.formBox}>
        <Text style={cs.formLabel}>LEAVE A REVIEW</Text>
        {submitted ? (
          <Text style={cs.successText}>Thanks! Your review will appear once approved.</Text>
        ) : (
          <>
            <TextInput
              style={cs.input}
              placeholder="Nickname (optional)"
              placeholderTextColor="#94a3b8"
              value={nickname}
              onChangeText={setNickname}
              autoCapitalize="words"
            />
            <View style={cs.ratingRow}>
              <Text style={cs.ratingLabel}>Race Rating</Text>
              {[1, 2, 3, 4, 5].map(i => (
                <TouchableOpacity key={i} onPress={() => setRating(rating === i ? 0 : i)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                  <Text style={{ fontSize: 24, color: i <= rating ? '#f59e0b' : '#e2e8f0' }}>★</Text>
                </TouchableOpacity>
              ))}
              {rating > 0 && <Text style={cs.ratingText}>{RATING_LABELS[rating]}</Text>}
            </View>
            <TextInput
              style={[cs.input, cs.textarea]}
              placeholder="Share your experience…"
              placeholderTextColor="#94a3b8"
              value={comment}
              onChangeText={setComment}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            {submitError && <Text style={cs.errorText}>{submitError}</Text>}
            <TouchableOpacity
              style={[cs.submitBtn, (!comment.trim() || submitting) && cs.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={!comment.trim() || submitting}
              activeOpacity={0.7}
            >
              <Text style={cs.submitBtnText}>{submitting ? 'Sending…' : 'Submit'}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

function PostDetail({ slug, postId, referId, likes, liked, onLike, onBack }: {
  slug: string; postId: number; referId: string; likes: number; liked: boolean; onLike: (id: number) => void; onBack: () => void;
}) {
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/blog/${slug}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setPost)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#e11d48" />
      </View>
    );
  }

  if (error || !post) {
    return (
      <View style={s.center}>
        <Text style={s.errorText}>Could not load post.</Text>
        <TouchableOpacity style={s.retryBtn} onPress={onBack}>
          <Text style={s.retryText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={s.detailContainer} contentContainerStyle={s.detailContent}>
      <View style={s.detailHeader}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Text style={s.backText}>← All Reviews</Text>
        </TouchableOpacity>
        <LikeButton postId={postId} likes={likes} liked={liked} onLike={onLike} />
      </View>
      {post.cover_image_url && (
        <Image source={{ uri: post.cover_image_url }} style={s.detailCover} />
      )}
      <Text style={s.detailTitle}>{post.title}</Text>
      <View style={s.detailMeta}>
        {post.published_at && <Text style={s.date}>{formatDate(post.published_at)}</Text>}
        {post.tags?.length > 0 && (
          <View style={s.tags}>
            {post.tags.map(tag => (
              <View key={tag} style={s.tag}>
                <Text style={s.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
      {parseContent(post.content ?? '').map((part, i) =>
        part.type === 'image' ? (
          <Image key={i} source={{ uri: part.url }} style={s.contentImage} resizeMode="contain" />
        ) : (
          <Text key={i} style={s.detailBody}>{part.value}</Text>
        )
      )}
      <CommentsSection referId={referId} />
    </ScrollView>
  );
}

export default function RaceReviewScreen() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [likesMap, setLikesMap] = useState<LikeMap>({});
  const [referIdMap, setReferIdMap] = useState<ReferIdMap>({});
  const [likedSet, setLikedSet] = useState<Set<number>>(new Set());

  useEffect(() => {
    AsyncStorage.getItem(LIKED_KEY).then(val => {
      if (val) setLikedSet(new Set(JSON.parse(val)));
    });
  }, []);

  async function fetchData() {
    try {
      setError(null);
      const [blogRes, racesRes, likesRes] = await Promise.all([
        fetch(`${API_URL}/blog`),
        fetch(`${API_URL}/races`).catch(() => null),
        fetch(`${API_URL}/races/likes/count`).catch(() => null),
      ]);
      if (!blogRes.ok) throw new Error();
      const data: BlogPost[] = await blogRes.json();
      const raceReports = data.filter(p => p.category === 'race-report');
      setPosts(raceReports);

      // Build slug → raceId map from races with blogurl
      const slugToRaceId: Record<string, string> = {};
      if (racesRes?.ok) {
        const races: { id: number; blogurl?: string }[] = await racesRes.json();
        for (const r of races) {
          if (!r.blogurl) continue;
          const match = r.blogurl.match(/\/blog\/([^/?#]+)/);
          if (match) slugToRaceId[match[1]] = String(r.id);
        }
      }

      // Build postId → referId map
      const refMap: ReferIdMap = {};
      for (const p of raceReports) {
        refMap[p.id] = p.race_id
          ? String(p.race_id)
          : slugToRaceId[p.slug] ?? `blog-${p.id}`;
      }
      setReferIdMap(refMap);

      // Build likes map keyed by referId
      if (likesRes?.ok) {
        const allLikes: { refer_id: string; count: string }[] = await likesRes.json();
        const lmap: LikeMap = {};
        for (const l of allLikes) {
          lmap[l.refer_id] = parseInt(l.count, 10) || 0;
        }
        setLikesMap(lmap);
      }
    } catch {
      setError('Could not load race reviews.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  function onRefresh() {
    setRefreshing(true);
    fetchData();
  }

  function getReferId(postId: number) {
    return referIdMap[postId] ?? `blog-${postId}`;
  }

  async function handleLike(postId: number) {
    if (likedSet.has(postId)) return;

    const referId = getReferId(postId);
    const current = likesMap[referId] || 0;
    const newCount = current + 1;

    setLikesMap(prev => ({ ...prev, [referId]: newCount }));
    setLikedSet(prev => {
      const next = new Set(prev);
      next.add(postId);
      AsyncStorage.setItem(LIKED_KEY, JSON.stringify([...next]));
      return next;
    });

    try {
      const checkRes = await fetch(`${API_URL}/races/likes/${referId}/count`);
      const existing = await checkRes.json();
      if (existing.length > 0) {
        await fetch(`${API_URL}/races/likes/${referId}/count`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ count: newCount }),
        });
      } else {
        await fetch(`${API_URL}/races/likes/${referId}/count`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ count: newCount }),
        });
      }
    } catch {}
  }

  if (selectedSlug && selectedPostId !== null) {
    return (
      <PostDetail
        slug={selectedSlug}
        postId={selectedPostId}
        referId={getReferId(selectedPostId)}
        likes={likesMap[getReferId(selectedPostId)] || 0}
        liked={likedSet.has(selectedPostId)}
        onLike={handleLike}
        onBack={() => { setSelectedSlug(null); setSelectedPostId(null); }}
      />
    );
  }

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#e11d48" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={s.center}>
        <Text style={s.errorText}>{error}</Text>
        <TouchableOpacity style={s.retryBtn} onPress={() => { setLoading(true); fetchData(); }}>
          <Text style={s.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (posts.length === 0) {
    return (
      <View style={s.center}>
        <Text style={s.emptyIcon}>📝</Text>
        <Text style={s.emptyText}>No race reviews yet.</Text>
      </View>
    );
  }

  const totalPages = Math.max(1, Math.ceil(posts.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = posts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <FlatList
      data={paginated}
      keyExtractor={p => String(p.id)}
      contentContainerStyle={s.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e11d48" />}
      renderItem={({ item }) => (
        <TouchableOpacity style={s.card} activeOpacity={0.7} onPress={() => { setSelectedSlug(item.slug); setSelectedPostId(item.id); }}>
          {item.cover_image_url && (
            <Image source={{ uri: item.cover_image_url }} style={s.cover} />
          )}
          <View style={s.cardBody}>
            <Text style={s.title}>{item.title}</Text>
            {item.excerpt ? <Text style={s.excerpt} numberOfLines={3}>{item.excerpt}</Text> : null}
            <View style={s.cardFooter}>
              <View style={s.meta}>
                {item.published_at && <Text style={s.date}>{formatDate(item.published_at)}</Text>}
                {item.tags?.length > 0 && (
                  <View style={s.tags}>
                    {item.tags.slice(0, 3).map(tag => (
                      <View key={tag} style={s.tag}>
                        <Text style={s.tagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
              <View style={s.likeBadge}>
                <Text style={s.likeBadgeIcon}>{likedSet.has(item.id) ? '❤️' : '🤍'}</Text>
                <Text style={s.likeBadgeCount}>{likesMap[getReferId(item.id)] || 0}</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      )}
      ListFooterComponent={totalPages > 1 ? (
        <View style={s.pagination}>
          <TouchableOpacity
            style={[s.pageBtn, currentPage === 1 && s.pageBtnDisabled]}
            onPress={() => setPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            <Text style={[s.pageBtnText, currentPage === 1 && s.pageBtnTextDisabled]}>←</Text>
          </TouchableOpacity>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
            <TouchableOpacity
              key={n}
              style={[s.pageNum, n === currentPage && s.pageNumActive]}
              onPress={() => setPage(n)}
            >
              <Text style={[s.pageNumText, n === currentPage && s.pageNumTextActive]}>{n}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[s.pageBtn, currentPage === totalPages && s.pageBtnDisabled]}
            onPress={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            <Text style={[s.pageBtnText, currentPage === totalPages && s.pageBtnTextDisabled]}>→</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    />
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  errorText: { fontSize: 15, color: '#64748b', textAlign: 'center', marginBottom: 16 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, backgroundColor: '#e11d48' },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 15, color: '#94a3b8' },
  list: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E4E8EF',
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cover: { width: '100%', height: 180, backgroundColor: '#f1f5f9' },
  cardBody: { padding: 16 },
  title: { fontSize: 17, fontWeight: '700', color: '#1A1A2E', marginBottom: 6 },
  excerpt: { fontSize: 13, color: '#64748b', lineHeight: 19, marginBottom: 10 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  date: { fontSize: 12, color: '#94a3b8', fontWeight: '600' },
  tags: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', flex: 1 },
  tag: { backgroundColor: '#FFF1F2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  tagText: { fontSize: 11, color: '#e11d48', fontWeight: '600' },
  // Like badge on list cards
  likeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  likeBadgeIcon: { fontSize: 14 },
  likeBadgeCount: { fontSize: 12, color: '#94a3b8', fontWeight: '600' },
  // Like button on detail view
  likeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFF1F2',
    borderWidth: 1.5,
    borderColor: '#FECDD3',
  },
  likeBtnActive: { backgroundColor: '#FFE4E6', borderColor: '#FDA4AF' },
  likeIcon: { fontSize: 16 },
  likeCount: { fontSize: 14, fontWeight: '700', color: '#94a3b8' },
  likeCountActive: { color: '#e11d48' },
  // Detail view
  detailContainer: { flex: 1, backgroundColor: '#F5F7FA' },
  detailContent: { padding: 16, paddingBottom: 60 },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  backBtn: {},
  backText: { fontSize: 15, color: '#e11d48', fontWeight: '600' },
  detailCover: { width: '100%', height: 220, borderRadius: 16, backgroundColor: '#f1f5f9', marginBottom: 16 },
  detailTitle: { fontSize: 22, fontWeight: '800', color: '#1A1A2E', marginBottom: 10 },
  detailMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  detailBody: { fontSize: 16, color: '#334155', lineHeight: 26, marginBottom: 12 },
  contentImage: { width: '100%', height: 250, borderRadius: 12, marginVertical: 12, backgroundColor: '#f1f5f9' },
  // Pagination
  pagination: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 8, paddingBottom: 16 },
  pageBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5, borderColor: '#E4E8EF', backgroundColor: '#fff' },
  pageBtnDisabled: { opacity: 0.4 },
  pageBtnText: { fontSize: 14, fontWeight: '600', color: '#334155' },
  pageBtnTextDisabled: { color: '#cbd5e1' },
  pageNum: { width: 36, height: 36, borderRadius: 8, borderWidth: 1.5, borderColor: '#E4E8EF', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  pageNumActive: { backgroundColor: '#1A1A2E', borderColor: '#1A1A2E' },
  pageNumText: { fontSize: 14, fontWeight: '600', color: '#334155' },
  pageNumTextActive: { color: '#fff' },
});

const cs = StyleSheet.create({
  container: { borderTopWidth: 1, borderTopColor: '#E4E8EF', paddingTop: 24, marginTop: 24 },
  aggRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  aggScore: { fontSize: 32, fontWeight: '800', color: '#0f172a' },
  aggCount: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  heading: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 12 },
  emptyText: { fontSize: 13, color: '#94a3b8', marginBottom: 20 },
  commentCard: {
    borderWidth: 1, borderColor: '#E4E8EF', borderRadius: 10,
    padding: 12, backgroundColor: '#fafafa', marginBottom: 10,
  },
  commentHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  commentAuthor: { fontWeight: '700', fontSize: 13, color: '#334155' },
  commentDate: { fontSize: 12, color: '#94a3b8', marginLeft: 'auto' },
  commentBody: { fontSize: 14, color: '#475569', lineHeight: 21 },
  formBox: {
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#E4E8EF',
    borderRadius: 12, padding: 16, marginTop: 16,
  },
  formLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', letterSpacing: 0.5, marginBottom: 10 },
  input: {
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#e2e8f0',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: '#1A1A2E', marginBottom: 8,
  },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  ratingLabel: { fontSize: 12, color: '#94a3b8', marginRight: 4 },
  ratingText: { fontSize: 12, color: '#94a3b8', marginLeft: 4 },
  errorText: { fontSize: 12, color: '#dc2626', marginBottom: 8 },
  successText: { fontSize: 14, color: '#16a34a' },
  submitBtn: {
    alignSelf: 'flex-end', paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 10, backgroundColor: '#e11d48',
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
