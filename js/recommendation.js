(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.Recommendation = factory();
    }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const DEFAULTS = {
        now: null,
        minDurationSeconds: 240,
        recentWindowHours: 24 * 7,
        recencyHalfLifeHours: 24,
        excludeVideoIds: [],
        excludeChannelIds: [],
        channelAppearanceCount: {},
        maxChannelAppearancesBeforePenalty: 1,
        diversityPenaltyPerExtraAppearance: 0.08,
        recencyWeight: 0.38,
        engagementWeight: 0.47,
        personalizationWeight: 0.15,
        followedChannelBonus: 0.12,
        likedChannelBonusMax: 0.12,
        likedChannelBonusStep: 0.04,
        sameChannelPenaltyWhenSidebarShown: 0.08,
        maxConsecutiveSameChannel: 2,
        maxTitleTokens: 12
    };

    const BASIC_STOPWORDS = new Set([
        'el', 'la', 'els', 'les', 'de', 'del', 'dels', 'i', 'a', 'en', 'per', 'amb', 'que', 'un', 'una', 'uns', 'unes',
        'the', 'and', 'for', 'with', 'this', 'that', 'from', 'is', 'are', 'to',
        'y', 'de', 'del', 'con', 'por', 'para', 'una', 'uno', 'los', 'las'
    ]);

    function toNumber(value) {
        const num = Number(value);
        return Number.isFinite(num) ? num : 0;
    }

    function getVideoId(video) {
        return String(video?.id ?? '');
    }

    function getChannelId(video) {
        return String(video?.channelId || video?.snippet?.channelId || '');
    }

    function getDurationSeconds(video) {
        if (!video) return null;
        const directSeconds = Number(video.durationSeconds);
        if (Number.isFinite(directSeconds)) return directSeconds;

        const durationValue = video.contentDetails?.duration || video.duration;
        if (!durationValue || typeof durationValue !== 'string') return null;

        if (durationValue.startsWith('PT')) {
            const match = durationValue.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
            if (!match) return null;
            return (parseInt(match[1] || '0', 10) * 3600)
                + (parseInt(match[2] || '0', 10) * 60)
                + parseInt(match[3] || '0', 10);
        }

        const parts = durationValue.split(':').map(part => Number(part));
        if (parts.some(Number.isNaN)) return null;
        if (parts.length === 3) return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
        if (parts.length === 2) return (parts[0] * 60) + parts[1];
        return null;
    }

    function getPublishedDate(video) {
        const value = video?.publishedAt || video?.uploadDate || video?.snippet?.publishedAt;
        if (!value) return null;
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    function normalizePublishedAgeHours(publishedAt, now) {
        const publishedDate = publishedAt instanceof Date ? publishedAt : new Date(publishedAt);
        const nowDate = now instanceof Date ? now : new Date(now || Date.now());
        if (Number.isNaN(publishedDate.getTime()) || Number.isNaN(nowDate.getTime())) {
            return 0;
        }
        const ageHours = Math.max(0, (nowDate.getTime() - publishedDate.getTime()) / 36e5);
        return 1 / (1 + (ageHours / DEFAULTS.recencyHalfLifeHours));
    }

    function computeEngagementScore(video) {
        const viewCount = toNumber(video?.viewCount ?? video?.statistics?.viewCount ?? video?.views);
        const likeCount = toNumber(video?.likeCount ?? video?.statistics?.likeCount);
        const commentCount = toNumber(video?.commentCount ?? video?.statistics?.commentCount);

        return (Math.log1p(viewCount) * 1.0)
            + (Math.log1p(likeCount) * 0.7)
            + (Math.log1p(commentCount) * 0.45);
    }

    function toSet(value) {
        if (value instanceof Set) return value;
        if (Array.isArray(value)) return new Set(value.map(item => String(item)));
        return new Set();
    }

    function resolveChannelLikeCount(channelId, userSignals) {
        const map = userSignals?.likedByChannel;
        if (!channelId || !map) return 0;
        if (map instanceof Map) return Number(map.get(channelId) || 0);
        return Number(map[channelId] || 0);
    }

    function getCategory(video) {
        const categories = Array.isArray(video?.categories) ? video.categories : [];
        if (categories.length > 0) return String(categories[0]).toLowerCase();
        if (video?.categoryId !== undefined && video?.categoryId !== null) return String(video.categoryId).toLowerCase();
        if (video?.category) return String(video.category).toLowerCase();
        return '';
    }

    function toTokenArray(input, maxTokens = DEFAULTS.maxTitleTokens) {
        if (!input) return [];
        if (Array.isArray(input)) {
            return input
                .map(token => String(token).trim().toLowerCase())
                .filter(token => token && !BASIC_STOPWORDS.has(token))
                .slice(0, maxTokens);
        }

        return String(input)
            .toLowerCase()
            .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
            .split(/\s+/)
            .map(token => token.trim())
            .filter(token => token.length > 1 && !BASIC_STOPWORDS.has(token))
            .slice(0, maxTokens);
    }

    function toTagSet(tags) {
        if (!Array.isArray(tags)) return new Set();
        const normalized = tags
            .map(tag => String(tag).trim().toLowerCase())
            .filter(Boolean);
        return new Set(normalized);
    }

    function jaccard(setA, setB) {
        if (setA.size === 0 || setB.size === 0) return 0;
        let intersection = 0;
        setA.forEach(value => {
            if (setB.has(value)) intersection += 1;
        });
        const union = setA.size + setB.size - intersection;
        return union > 0 ? (intersection / union) : 0;
    }

    function overlapRatio(tokensA, tokensB) {
        if (tokensA.length === 0 || tokensB.length === 0) return 0;
        const setA = new Set(tokensA);
        const setB = new Set(tokensB);
        let intersection = 0;
        setA.forEach(token => {
            if (setB.has(token)) intersection += 1;
        });
        return intersection / Math.max(1, Math.min(setA.size, setB.size));
    }

    function computeFeaturedScore(video, userSignals, context) {
        const cfg = { ...DEFAULTS, ...(context || {}) };
        const now = cfg.now ? new Date(cfg.now) : new Date();
        const publishedDate = getPublishedDate(video);
        const recencyScore = publishedDate ? normalizePublishedAgeHours(publishedDate, now) : 0;

        const rawEngagement = computeEngagementScore(video);
        const normalizedEngagement = rawEngagement / 12;
        const ageHours = publishedDate ? Math.max(0, (now - publishedDate) / 36e5) : Number.POSITIVE_INFINITY;
        const inRecentWindow = Number.isFinite(ageHours) && ageHours <= cfg.recentWindowHours;
        const engagementWindowMultiplier = inRecentWindow ? 1 : 0.35;
        const engagementScore = normalizedEngagement * engagementWindowMultiplier;

        const channelId = getChannelId(video);
        const follows = toSet(userSignals?.follows);
        const followedBonus = follows.has(channelId) ? cfg.followedChannelBonus : 0;
        const likedCount = resolveChannelLikeCount(channelId, userSignals);
        const likedBonus = Math.min(cfg.likedChannelBonusMax, likedCount * cfg.likedChannelBonusStep);
        const personalizationScore = followedBonus + likedBonus;

        const channelAppearancesRaw = cfg.channelAppearanceCount instanceof Map
            ? Number(cfg.channelAppearanceCount.get(channelId) || 0)
            : Number(cfg.channelAppearanceCount?.[channelId] || 0);
        const channelAppearances = Number.isFinite(channelAppearancesRaw) ? channelAppearancesRaw : 0;
        const overLimit = Math.max(0, channelAppearances - cfg.maxChannelAppearancesBeforePenalty);
        const diversityPenalty = overLimit * cfg.diversityPenaltyPerExtraAppearance;

        const total = (recencyScore * cfg.recencyWeight)
            + (engagementScore * cfg.engagementWeight)
            + (personalizationScore * cfg.personalizationWeight)
            - diversityPenalty;

        const reason = engagementScore > recencyScore ? 'engagement' : 'recency';

        return {
            total,
            reason,
            breakdown: {
                recencyScore,
                engagementScore,
                personalizationScore,
                diversityPenalty,
                inRecentWindow
            }
        };
    }

    function computeRelatedScore(candidate, currentVideo, userSignals = {}, options = {}) {
        const cfg = { ...DEFAULTS, ...(options || {}) };
        const candidateTags = toTagSet(candidate?.tags);
        const currentTags = toTagSet(currentVideo?.tags);
        const tagsJaccard = jaccard(candidateTags, currentTags);

        const candidateTokens = toTokenArray(candidate?.normalizedTitleTokens || candidate?.title, cfg.maxTitleTokens);
        const currentTokens = toTokenArray(currentVideo?.normalizedTitleTokens || currentVideo?.title, cfg.maxTitleTokens);
        const tokenOverlap = overlapRatio(candidateTokens, currentTokens);

        const sameCategory = getCategory(candidate) && getCategory(candidate) === getCategory(currentVideo);

        const channelId = getChannelId(candidate);
        const useFollows = options?.useFollowSignals !== false;
        const useLikes = options?.useLikeSignals !== false;
        const follows = useFollows ? toSet(userSignals?.follows) : new Set();
        const followBonus = useFollows && follows.has(channelId) ? 0.18 : 0;
        const likedCount = resolveChannelLikeCount(channelId, userSignals);
        const likedBonus = useLikes ? Math.min(0.16, likedCount * 0.04) : 0;

        const penalizeSameChannel = Boolean(cfg.sidebarChannelShown);
        const sameChannelPenalty = penalizeSameChannel && getChannelId(currentVideo) === channelId
            ? cfg.sameChannelPenaltyWhenSidebarShown
            : 0;

        const total = (tagsJaccard * 0.5)
            + (tokenOverlap * 0.28)
            + (sameCategory ? 0.12 : 0)
            + followBonus
            + likedBonus
            - sameChannelPenalty;

        let dominantReason = 'categoria';
        if (tagsJaccard >= tokenOverlap && tagsJaccard > 0.18) {
            dominantReason = 'tema';
        } else if (tokenOverlap > 0.2) {
            dominantReason = 'titol';
        }
        if (followBonus + likedBonus > 0.2 && (tagsJaccard + tokenOverlap) < 0.25) {
            dominantReason = 'personalitzacio';
        }

        return {
            total,
            reason: dominantReason,
            breakdown: {
                tagsJaccard,
                tokenOverlap,
                sameCategory,
                followBonus,
                likedBonus,
                sameChannelPenalty
            }
        };
    }

    function rankAndDiversifyRelated(candidates, options = {}) {
        if (!Array.isArray(candidates) || candidates.length === 0) return [];
        const cfg = { ...DEFAULTS, ...(options || {}) };
        const currentVideo = cfg.currentVideo || null;
        const userSignals = cfg.userSignals || {};

        const scored = candidates
            .map(video => ({
                video,
                score: computeRelatedScore(video, currentVideo, userSignals, cfg)
            }))
            .sort((a, b) => b.score.total - a.score.total);

        const ranked = [];
        const remaining = [...scored];

        while (remaining.length > 0) {
            let pickIndex = 0;
            if (ranked.length >= cfg.maxConsecutiveSameChannel) {
                const recent = ranked.slice(-cfg.maxConsecutiveSameChannel);
                const recentChannel = getChannelId(recent[0].video);
                const allSame = recent.every(item => getChannelId(item.video) === recentChannel);
                if (allSame) {
                    const alternativeIndex = remaining.findIndex(item => getChannelId(item.video) !== recentChannel);
                    if (alternativeIndex > -1) {
                        pickIndex = alternativeIndex;
                    }
                }
            }
            ranked.push(remaining.splice(pickIndex, 1)[0]);
        }

        return ranked;
    }

    function filterHiddenCandidates(videos, hiddenVideoIds = [], hiddenChannelIds = []) {
        const hiddenVideos = toSet(hiddenVideoIds);
        const hiddenChannels = toSet(hiddenChannelIds);
        return (Array.isArray(videos) ? videos : []).filter(video => {
            const videoId = getVideoId(video);
            const channelId = getChannelId(video);
            if (!videoId) return false;
            if (hiddenVideos.has(videoId)) return false;
            if (channelId && hiddenChannels.has(channelId)) return false;
            return true;
        });
    }

    function pickFeaturedVideo(videos, options) {
        if (!Array.isArray(videos) || videos.length === 0) return null;

        const cfg = { ...DEFAULTS, ...(options || {}) };
        const excludeVideoIds = toSet(cfg.excludeVideoIds);
        const excludeChannelIds = toSet(cfg.excludeChannelIds);
        const userSignals = cfg.userSignals || {};

        let best = null;

        videos.forEach(video => {
            const videoId = getVideoId(video);
            const channelId = getChannelId(video);
            if (!videoId || excludeVideoIds.has(videoId) || excludeChannelIds.has(channelId)) return;
            if (video?.isShort === true) return;

            const seconds = getDurationSeconds(video);
            if (seconds === null || seconds < cfg.minDurationSeconds) return;

            const scored = computeFeaturedScore(video, userSignals, cfg);
            if (!best || scored.total > best.score.total) {
                best = { video, score: scored };
            }
        });

        return best;
    }

    return {
        normalizePublishedAgeHours,
        computeEngagementScore,
        computeFeaturedScore,
        pickFeaturedVideo,
        computeRelatedScore,
        rankAndDiversifyRelated,
        filterHiddenCandidates,
        toTokenArray
    };
}));
