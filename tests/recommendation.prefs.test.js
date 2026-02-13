const test = require('node:test');
const assert = require('node:assert/strict');

const {
    computeRelatedScore,
    rankAndDiversifyRelated,
    filterHiddenCandidates
} = require('../js/recommendation.js');

function v(overrides = {}) {
    return {
        id: overrides.id || 'v1',
        channelId: overrides.channelId || 'c1',
        title: overrides.title || 'video analisi tecnologia',
        normalizedTitleTokens: overrides.normalizedTitleTokens || ['video', 'analisi', 'tecnologia'],
        tags: overrides.tags || ['tech'],
        categories: overrides.categories || ['tech'],
        ...overrides
    };
}

test('if likes personalization is off, likes do not modify ranking', () => {
    const current = v({ id: 'current', channelId: 'root', tags: ['tech'] });
    const a = v({ id: 'a', channelId: 'liked-channel', tags: ['tech'] });
    const b = v({ id: 'b', channelId: 'neutral-channel', tags: ['tech'] });

    const scoreWithLikesOffA = computeRelatedScore(a, current, { follows: [], likedByChannel: { 'liked-channel': 20 } }, { useLikeSignals: false });
    const scoreWithLikesOffB = computeRelatedScore(b, current, { follows: [], likedByChannel: {} }, { useLikeSignals: false });
    assert.equal(scoreWithLikesOffA.total, scoreWithLikesOffB.total);

    const ranked = rankAndDiversifyRelated([a, b], {
        currentVideo: current,
        userSignals: { follows: [], likedByChannel: { 'liked-channel': 20 } },
        useLikeSignals: false
    });
    assert.ok(ranked.length === 2);
});

test('hidden channel never appears in candidates', () => {
    const candidates = [
        v({ id: 'x1', channelId: 'hidden-ch' }),
        v({ id: 'x2', channelId: 'visible-ch' })
    ];

    const filtered = filterHiddenCandidates(candidates, [], ['hidden-ch']);
    assert.equal(filtered.some(item => item.channelId === 'hidden-ch'), false);
    assert.equal(filtered.length, 1);
});
