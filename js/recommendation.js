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
        likedChannelBonusStep: 0.04
    };

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
        pickFeaturedVideo
    };
}));
