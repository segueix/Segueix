const test = require('node:test');
const assert = require('node:assert/strict');

const {
    pickFeaturedVideo
} = require('../js/recommendation.js');

function mkVideo(overrides = {}) {
    return {
        id: overrides.id || 'v1',
        channelId: overrides.channelId || 'c1',
        publishedAt: overrides.publishedAt || '2026-01-10T00:00:00.000Z',
        durationSeconds: overrides.durationSeconds ?? 600,
        isShort: overrides.isShort ?? false,
        viewCount: overrides.viewCount ?? 1000,
        likeCount: overrides.likeCount ?? 0,
        commentCount: overrides.commentCount ?? 0,
        ...overrides
    };
}

test('older high-engagement video can win within 7-day recency window', () => {
    const now = '2026-01-10T12:00:00.000Z';
    const recentLowEngagement = mkVideo({
        id: 'recent',
        channelId: 'c-recent',
        publishedAt: '2026-01-10T10:00:00.000Z',
        viewCount: 1200,
        likeCount: 10,
        commentCount: 2
    });
    const olderHighEngagement = mkVideo({
        id: 'older',
        channelId: 'c-older',
        publishedAt: '2026-01-05T10:00:00.000Z',
        viewCount: 350000,
        likeCount: 15000,
        commentCount: 1800
    });

    const picked = pickFeaturedVideo([recentLowEngagement, olderHighEngagement], {
        now,
        recentWindowHours: 24 * 7,
        minDurationSeconds: 240,
        userSignals: { follows: new Set(), likedByChannel: {} }
    });

    assert.ok(picked);
    assert.equal(picked.video.id, 'older');
});

test('shorts and too-short videos are never eligible as featured', () => {
    const now = '2026-01-10T12:00:00.000Z';
    const shortVideo = mkVideo({ id: 'short1', isShort: true, durationSeconds: 60, viewCount: 999999 });
    const tooShort = mkVideo({ id: 'tiny', isShort: false, durationSeconds: 120, viewCount: 500000 });

    const picked = pickFeaturedVideo([shortVideo, tooShort], {
        now,
        minDurationSeconds: 240,
        userSignals: { follows: ['c1'], likedByChannel: { c1: 10 } }
    });

    assert.equal(picked, null);
});

test('followed-channel bonus influences but does not always dominate', () => {
    const now = '2026-01-10T12:00:00.000Z';
    const followedLowEngagement = mkVideo({
        id: 'followed-low',
        channelId: 'followed',
        publishedAt: '2026-01-10T09:00:00.000Z',
        viewCount: 1800,
        likeCount: 20,
        commentCount: 1
    });
    const nonFollowedHighEngagement = mkVideo({
        id: 'nonfollowed-high',
        channelId: 'other',
        publishedAt: '2026-01-10T08:30:00.000Z',
        viewCount: 150000,
        likeCount: 8000,
        commentCount: 900
    });

    const picked = pickFeaturedVideo([followedLowEngagement, nonFollowedHighEngagement], {
        now,
        minDurationSeconds: 240,
        userSignals: { follows: ['followed'], likedByChannel: { followed: 3 } }
    });

    assert.ok(picked);
    assert.equal(picked.video.id, 'nonfollowed-high');
});
