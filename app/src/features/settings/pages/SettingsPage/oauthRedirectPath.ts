export const buildOAuthRedirectPath = (
  location: Pick<Location, 'pathname' | 'search' | 'hash'>,
): string => {
  const pathname = location.pathname.startsWith('/') ? location.pathname : '/settings';
  return `${pathname}${location.search}${location.hash}`;
};
