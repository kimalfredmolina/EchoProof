const { env } = require('../config/environment');

function repositorySlug(owner, repository) {
  return `${String(owner || '').trim()}/${String(repository || '').trim()}`.toLowerCase();
}

function isPrivateRepositoryAllowed(owner, repository) {
  if (!env.GITHUB_TOKEN) return false;

  const slug = repositorySlug(owner, repository);
  return env.PRIVATE_REPOSITORY_ALLOWLIST.includes('*')
    || env.PRIVATE_REPOSITORY_ALLOWLIST.includes(slug);
}

function assertRepositoryAccess({ owner, repository, isPrivate }) {
  if (!isPrivate) return;
  if (!isPrivateRepositoryAllowed(owner, repository)) {
    throw new Error('Private repository is not included in PRIVATE_REPOSITORY_ALLOWLIST');
  }
}

module.exports = {
  assertRepositoryAccess,
  isPrivateRepositoryAllowed,
  repositorySlug,
};
