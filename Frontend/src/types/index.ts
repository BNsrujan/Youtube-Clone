/**
 * Domain types mirroring the backend's response shapes.
 *
 * The Express API wraps everything in an ApiResponse envelope; these describe
 * what sits inside `data` once the client has unwrapped it.
 */

export interface User {
    _id: string;
    username: string;
    fullName: string;
    email?: string;
    avatar: string;
    coverImage?: string;
    subscribersCount?: number;
    channelsSubscribedToCount?: number;
    isSubscribed?: boolean;
    createdAt?: string;
}

/** Per-signal contribution to a video's score. Keys match the ranker's weights. */
export interface RecommendationBreakdown {
    content?: number;
    collaborative?: number;
    engagement?: number;
    freshness?: number;
    subscription?: number;
    creatorAffinity?: number;
    diversityBonus?: number;
}

export type CandidateSource =
    | "collaborative"
    | "content"
    | "subscription"
    | "trending"
    | "exploration"
    | "same_creator"
    | "hybrid"
    | "explain";

export interface RecommendationMeta {
    score: number;
    sources: CandidateSource[];
    breakdown?: RecommendationBreakdown;
}

export interface Rendition {
    label: string;
    height: number;
    bitrate: number;
    codec: string;
    playlistUrl: string;
}

export type TranscodeStatus = "pending" | "processing" | "ready" | "failed";
export type Visibility = "public" | "unlisted" | "private";

export interface Video {
    _id: string;
    title: string;
    description: string;
    thumbnail: string;
    previewSpriteUrl?: string;
    duration: number;
    views: number;
    likesCount: number;
    commentsCount: number;
    avgWatchRatio: number;
    trendingScore?: number;
    tags: string[];
    category: string;
    isPublished: boolean;
    visibility: Visibility;
    transcodeStatus: TranscodeStatus;
    owner: User;
    createdAt: string;
    isLiked?: boolean;
    /** Present only on items that came out of the recommender. */
    _recommendation?: RecommendationMeta;
    /** Present only on continue-watching items. */
    progress?: number;
    resumeAt?: number;
}

export interface PlaybackManifest {
    videoId: string;
    duration: number;
    masterPlaylistUrl: string;
    renditions: Rendition[];
    previewSpriteUrl?: string;
    playbackToken: string;
    tokenExpiresAt: number;
    resumeAt: number;
    segmentDuration: number;
}

export interface Comment {
    _id: string;
    content: string;
    owner: User;
    likesCount: number;
    isLiked: boolean;
    createdAt: string;
}

export type FeedStrategy = "personalised" | "cold_start" | "fallback";

export interface Feed {
    items: Video[];
    strategy: FeedStrategy;
    candidatePoolSize?: number;
}

export interface Paginated<T> {
    docs: T[];
    totalDocs: number;
    page: number;
    totalPages: number;
    hasNextPage: boolean;
}

export interface WhyExplanation {
    videoId: string;
    title: string;
    score: number;
    breakdown: RecommendationBreakdown;
    matchedTags: string[];
    yourTopTags: { tag: string; weight: number }[];
}

export interface TasteProfile {
    topTags: { key: string; weight: number }[];
    topCategories: { key: string; weight: number }[];
    diversityScore: number;
    interactionCount: number;
    lastRebuiltAt?: string;
}

export interface ChannelStats {
    totalVideos: number;
    publishedVideos: number;
    totalViews: number;
    totalLikes: number;
    totalComments: number;
    totalSubscribers: number;
    totalWatchHours: number;
    avgWatchRatio: number;
    topVideos: Video[];
    byCategory: { _id: string; count: number; views: number }[];
    viewsOverTime: { date: string; views: number; watchHours: number }[];
}
