'use strict';

const NAME = 'facebook';

function isActive() { return false; }

async function search() {
  throw new Error('Facebook provider not implemented (Phase 2)');
}

module.exports = { name: NAME, isActive, search };
