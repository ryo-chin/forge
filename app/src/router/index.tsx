import {
  type AnchorHTMLAttributes,
  Children,
  createContext,
  isValidElement,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

type Location = {
  pathname: string;
};

type NavigateOptions = {
  replace?: boolean;
};

type RouterContextValue = {
  location: Location;
  navigate: (to: string, options?: NavigateOptions) => void;
};

const RouterContext = createContext<RouterContextValue | null>(null);
const OutletContext = createContext<ReactNode>(null);

const normalizePath = (path: string): string => {
  if (!path) {
    return '/';
  }
  const withLeading = path.startsWith('/') ? path : `/${path}`;
  if (withLeading.length === 1) {
    return withLeading;
  }
  return withLeading.replace(/\/+$/, '') || '/';
};

const splitPath = (path: string): string[] => {
  const normalized = normalizePath(path);
  if (normalized === '/') {
    return [];
  }
  return normalized.replace(/^\//, '').split('/');
};

const getWindowPathname = (): string => {
  if (typeof window === 'undefined') {
    return '/';
  }
  return normalizePath(window.location.pathname);
};

export function BrowserRouter({ children }: { children?: ReactNode }): JSX.Element {
  const [location, setLocation] = useState<Location>(() => ({
    pathname: getWindowPathname(),
  }));

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const handlePop = () => {
      setLocation({ pathname: getWindowPathname() });
    };
    window.addEventListener('popstate', handlePop);
    return () => {
      window.removeEventListener('popstate', handlePop);
    };
  }, []);

  const navigate = useCallback<RouterContextValue['navigate']>((to, options = {}) => {
    if (typeof window === 'undefined') {
      return;
    }
    const target = normalizePath(to);
    const replace = options.replace === true;
    if (replace) {
      window.history.replaceState(null, '', target);
    } else {
      window.history.pushState(null, '', target);
    }
    setLocation({ pathname: target });
  }, []);

  const value = useMemo<RouterContextValue>(() => ({ location, navigate }), [location, navigate]);

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

const useRouterContext = (): RouterContextValue => {
  const context = useContext(RouterContext);
  if (!context) {
    throw new Error('BrowserRouter is required to use routing primitives.');
  }
  return context;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useNavigate = (): RouterContextValue['navigate'] => useRouterContext().navigate;

// eslint-disable-next-line react-refresh/only-export-components
export const useLocation = (): Location => useRouterContext().location;

type RouteProps = {
  path?: string;
  index?: boolean;
  element?: ReactNode;
  children?: ReactNode;
};

type RouteObject = {
  path?: string;
  index?: boolean;
  element?: ReactNode;
  children?: RouteObject[];
};

const createRoutesFromChildren = (children?: ReactNode): RouteObject[] => {
  const routes: RouteObject[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement<RouteProps>(child)) {
      return;
    }
    const route: RouteObject = {
      path: child.props.path,
      index: child.props.index,
      element: child.props.element,
    };
    if (child.props.children) {
      route.children = createRoutesFromChildren(child.props.children);
    }
    routes.push(route);
  });
  return routes;
};

const segmentsStartWith = (segments: string[], prefix: string[]): boolean => {
  if (segments.length < prefix.length) {
    return false;
  }
  for (let index = 0; index < prefix.length; index += 1) {
    if (segments[index] !== prefix[index]) {
      return false;
    }
  }
  return true;
};

const wrapWithOutlet = (element?: ReactNode, child?: ReactNode | null): ReactNode => {
  if (child == null) {
    return element ?? null;
  }
  return <OutletContext.Provider value={child}>{element ?? null}</OutletContext.Provider>;
};

const matchRoutes = (
  routes: RouteObject[],
  segments: string[],
  baseSegments: string[],
): ReactNode | null => {
  let fallback: RouteObject | undefined;
  for (const route of routes) {
    if (route.path === '*') {
      fallback = route;
      continue;
    }
    const matched = matchRoute(route, segments, baseSegments);
    if (matched !== null) {
      return matched;
    }
  }
  if (fallback) {
    return matchRoute(fallback, segments, baseSegments);
  }
  return null;
};

const matchRoute = (
  route: RouteObject,
  segments: string[],
  baseSegments: string[],
): ReactNode | null => {
  if (route.path === '*') {
    const child = route.children ? matchRoutes(route.children, segments, segments) : null;
    return wrapWithOutlet(route.element, child);
  }

  if (route.index) {
    if (segments.length === baseSegments.length) {
      const child = route.children ? matchRoutes(route.children, segments, baseSegments) : null;
      return wrapWithOutlet(route.element, child);
    }
    return null;
  }

  const relativeSegments = splitPath(route.path ?? '/');
  const targetSegments = route.path?.startsWith('/')
    ? relativeSegments
    : [...baseSegments, ...relativeSegments];

  if (!segmentsStartWith(segments, targetSegments)) {
    return null;
  }

  const child = route.children ? matchRoutes(route.children, segments, targetSegments) : null;

  if (route.children && child == null && segments.length > targetSegments.length) {
    return null;
  }

  return wrapWithOutlet(route.element, child);
};

export function Routes({ children }: { children?: ReactNode }): ReactNode {
  const { location } = useRouterContext();
  const routes = useMemo(() => createRoutesFromChildren(children), [children]);
  const element = useMemo(
    () => matchRoutes(routes, splitPath(location.pathname), []),
    [routes, location.pathname],
  );
  return element ?? null;
}

export function Route(_props: RouteProps): null {
  void _props;
  return null;
}

export function Outlet(): ReactNode {
  const element = useContext(OutletContext);
  return element ?? null;
}

export function Navigate({ to, replace }: { to: string; replace?: boolean }): null {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const target = normalizePath(to);
    if (location.pathname === target) {
      return;
    }
    navigate(target, { replace });
  }, [to, replace, navigate, location.pathname]);

  return null;
}

type NavLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'className'> & {
  to: string;
  end?: boolean;
  className?: string | ((state: { isActive: boolean }) => string);
};

export function NavLink({
  to,
  end,
  className,
  onClick,
  children,
  ...rest
}: NavLinkProps): JSX.Element {
  const { location, navigate } = useRouterContext();
  const target = normalizePath(to);
  const isExactMatch = location.pathname === target;
  const isActive = end ? isExactMatch : isExactMatch || location.pathname.startsWith(`${target}/`);

  const computedClassName = typeof className === 'function' ? className({ isActive }) : className;

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (onClick) {
      onClick(event);
    }
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      rest.target === '_blank' ||
      event.metaKey ||
      event.altKey ||
      event.ctrlKey ||
      event.shiftKey
    ) {
      return;
    }
    event.preventDefault();
    if (!isExactMatch) {
      navigate(target);
    }
  };

  return (
    <a
      {...rest}
      href={target}
      className={computedClassName}
      aria-current={isActive ? 'page' : undefined}
      onClick={handleClick}
    >
      {children}
    </a>
  );
}
